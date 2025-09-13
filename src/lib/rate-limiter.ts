import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"
import { NextRequest, NextResponse } from "next/server"
import { UserRole, SecurityAction } from "@prisma/client"
import { headers } from "next/headers"
import { prisma } from "./db"
import { logSecurityEvent } from "./security"
import {
  RateLimitConfig,
  getRateLimitConfig,
  OPERATION_RATE_LIMITS,
  RATE_LIMIT_WHITELIST,
  EMERGENCY_BYPASS_HEADER,
  RateLimitSeverity,
  ENDPOINT_SEVERITY
} from "./rate-limit-config"

// Initialize Redis client with fallback handling
let redis: Redis | null = null
let redisError: string | null = null

try {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  })
} catch (error) {
  redisError = `Redis initialization failed: ${error}`
  console.error(redisError)
}

// Rate limiter instances cache
const rateLimiters = new Map<string, Ratelimit>()

// Get or create rate limiter for a specific config
function getRateLimiter(config: RateLimitConfig): Ratelimit | null {
  if (!redis) {
    console.warn("Redis not available, rate limiting disabled")
    return null
  }

  const key = config.identifier

  if (rateLimiters.has(key)) {
    return rateLimiters.get(key)!
  }

  // Use the first rule for the primary rate limiter
  const primaryRule = config.rules[0]

  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(primaryRule.requests, primaryRule.window),
    analytics: true,
    prefix: `ratelimit:${key}`,
  })

  rateLimiters.set(key, limiter)
  return limiter
}

export interface RateLimitContext {
  userId?: string
  userRole?: UserRole
  ip: string
  userAgent: string
  endpoint: string
  operationType?: string
}

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number
  blocked?: boolean
  blockUntil?: number
  retryAfter?: number
  error?: string
}

// Check if IP is whitelisted
function isWhitelisted(ip: string): boolean {
  // For simplicity, exact match. In production, use CIDR matching
  return RATE_LIMIT_WHITELIST.includes(ip)
}

// Get client IP from request
export function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for")
  const realIP = request.headers.get("x-real-ip")
  const remoteAddr = request.ip

  if (forwarded) {
    return forwarded.split(",")[0].trim()
  }

  return realIP || remoteAddr || "unknown"
}

// Main rate limiting function
export async function checkRateLimit(
  context: RateLimitContext,
  configKey: string,
  customConfig?: RateLimitConfig
): Promise<RateLimitResult> {
  try {
    // Check for emergency bypass
    const headersList = await headers()
    const emergencyBypass = headersList.get(EMERGENCY_BYPASS_HEADER)
    if (emergencyBypass === process.env.EMERGENCY_BYPASS_TOKEN) {
      return {
        success: true,
        limit: Infinity,
        remaining: Infinity,
        reset: Date.now() + 60000
      }
    }

    // Check if IP is whitelisted
    if (isWhitelisted(context.ip)) {
      return {
        success: true,
        limit: Infinity,
        remaining: Infinity,
        reset: Date.now() + 60000
      }
    }

    // Get rate limit configuration
    const config = customConfig ||
                  OPERATION_RATE_LIMITS[configKey] ||
                  getRateLimitConfig(configKey as any, context.userRole)

    // Check if user is currently blocked
    const blockStatus = await checkBlockStatus(context, config)
    if (blockStatus.blocked) {
      await logRateLimitViolation(context, config, "blocked", blockStatus.blockUntil)
      return {
        success: false,
        limit: config.rules[0].requests,
        remaining: 0,
        reset: blockStatus.blockUntil!,
        blocked: true,
        blockUntil: blockStatus.blockUntil,
        retryAfter: Math.ceil((blockStatus.blockUntil! - Date.now()) / 1000)
      }
    }

    // If Redis is not available, use database fallback
    if (!redis) {
      return await checkRateLimitDatabase(context, config)
    }

    // Use Upstash rate limiter
    const limiter = getRateLimiter(config)
    if (!limiter) {
      throw new Error("Failed to create rate limiter")
    }

    // Create identifier based on context
    const identifier = createRateLimitIdentifier(context)

    // Check rate limit
    const result = await limiter.limit(identifier)

    if (!result.success) {
      // Log the violation
      await logRateLimitViolation(context, config, "exceeded")

      // Check if we should block the user
      await handleRateLimitBlock(context, config)

      return {
        success: false,
        limit: result.limit,
        remaining: result.remaining,
        reset: result.reset,
        retryAfter: Math.ceil((result.reset - Date.now()) / 1000)
      }
    }

    return {
      success: true,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset
    }

  } catch (error) {
    console.error("Rate limiting error:", error)

    // Log the error but don't block the request
    await logSecurityEvent({
      userId: context.userId,
      action: SecurityAction.RATE_LIMIT_EXCEEDED,
      details: {
        endpoint: context.endpoint,
        error: error instanceof Error ? error.message : "Unknown error",
        ip: context.ip
      },
      ip: context.ip,
      userAgent: context.userAgent,
      success: false
    })

    // Fail open - allow the request but log the error
    return {
      success: true,
      limit: 1000,
      remaining: 999,
      reset: Date.now() + 60000,
      error: "Rate limiting temporarily unavailable"
    }
  }
}

// Create rate limit identifier
function createRateLimitIdentifier(context: RateLimitContext): string {
  // For authenticated users, use user ID + IP for extra security
  if (context.userId) {
    return `user:${context.userId}:${context.ip}`
  }

  // For unauthenticated requests, use IP only
  return `ip:${context.ip}`
}

// Database fallback for rate limiting when Redis is unavailable
async function checkRateLimitDatabase(
  context: RateLimitContext,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const rule = config.rules[0]
  const windowStart = new Date(Date.now() - rule.windowMs)

  try {
    // Check existing rate limit entry
    const existing = await prisma.rateLimitEntry.findFirst({
      where: {
        OR: [
          { userId: context.userId },
          { ip: context.ip }
        ],
        endpoint: context.endpoint,
        expiresAt: { gt: new Date() }
      }
    })

    if (existing && existing.attempts >= rule.requests) {
      await logRateLimitViolation(context, config, "exceeded_database")

      return {
        success: false,
        limit: rule.requests,
        remaining: 0,
        reset: existing.expiresAt.getTime(),
        retryAfter: Math.ceil((existing.expiresAt.getTime() - Date.now()) / 1000)
      }
    }

    // Update or create rate limit entry
    await prisma.rateLimitEntry.upsert({
      where: {
        id: existing?.id || "new"
      },
      update: {
        attempts: { increment: 1 },
        updatedAt: new Date()
      },
      create: {
        userId: context.userId,
        ip: context.ip,
        endpoint: context.endpoint,
        attempts: 1,
        windowStart,
        expiresAt: new Date(Date.now() + rule.windowMs)
      }
    })

    const currentAttempts = (existing?.attempts || 0) + 1

    return {
      success: true,
      limit: rule.requests,
      remaining: Math.max(0, rule.requests - currentAttempts),
      reset: Date.now() + rule.windowMs
    }

  } catch (error) {
    console.error("Database rate limiting error:", error)
    // Fail open
    return {
      success: true,
      limit: rule.requests,
      remaining: rule.requests - 1,
      reset: Date.now() + rule.windowMs,
      error: "Database rate limiting error"
    }
  }
}

// Check if user/IP is currently blocked
async function checkBlockStatus(
  context: RateLimitContext,
  config: RateLimitConfig
): Promise<{ blocked: boolean; blockUntil?: number }> {
  if (!config.blockDurationMs) {
    return { blocked: false }
  }

  try {
    const blockKey = `block:${createRateLimitIdentifier(context)}`

    if (redis) {
      const blockUntil = await redis.get(blockKey)
      if (blockUntil && typeof blockUntil === "number" && blockUntil > Date.now()) {
        return { blocked: true, blockUntil }
      }
    } else {
      // Database fallback for block status
      const recentViolations = await prisma.securityLog.count({
        where: {
          OR: [
            { userId: context.userId },
          ],
          action: SecurityAction.RATE_LIMIT_EXCEEDED,
          createdAt: { gte: new Date(Date.now() - config.blockDurationMs) },
          details: {
            path: ["endpoint"],
            equals: context.endpoint
          }
        }
      })

      if (recentViolations >= 3) {
        const blockUntil = Date.now() + config.blockDurationMs
        return { blocked: true, blockUntil }
      }
    }

    return { blocked: false }
  } catch (error) {
    console.error("Error checking block status:", error)
    return { blocked: false }
  }
}

// Handle rate limit blocking
async function handleRateLimitBlock(
  context: RateLimitContext,
  config: RateLimitConfig
): Promise<void> {
  if (!config.blockDurationMs) return

  try {
    const blockKey = `block:${createRateLimitIdentifier(context)}`
    const blockUntil = Date.now() + config.blockDurationMs

    if (redis) {
      await redis.setex(blockKey, Math.ceil(config.blockDurationMs / 1000), blockUntil)
    }

    // Log the block
    await logSecurityEvent({
      userId: context.userId,
      action: SecurityAction.RATE_LIMIT_EXCEEDED,
      details: {
        endpoint: context.endpoint,
        action: "blocked",
        blockDuration: config.blockDuration,
        blockUntil: new Date(blockUntil).toISOString()
      },
      ip: context.ip,
      userAgent: context.userAgent,
      success: false
    })
  } catch (error) {
    console.error("Error handling rate limit block:", error)
  }
}

// Log rate limit violation
async function logRateLimitViolation(
  context: RateLimitContext,
  config: RateLimitConfig,
  violationType: string,
  blockUntil?: number
): Promise<void> {
  await logSecurityEvent({
    userId: context.userId,
    action: SecurityAction.RATE_LIMIT_EXCEEDED,
    details: {
      endpoint: context.endpoint,
      config: config.identifier,
      violationType,
      severity: ENDPOINT_SEVERITY[config.identifier] || RateLimitSeverity.MEDIUM,
      blockUntil: blockUntil ? new Date(blockUntil).toISOString() : undefined,
      userAgent: context.userAgent
    },
    ip: context.ip,
    userAgent: context.userAgent,
    success: false
  })
}

// Create rate limit response
export function createRateLimitResponse(result: RateLimitResult): NextResponse {
  const response = NextResponse.json(
    {
      error: "Rate limit exceeded",
      message: result.blocked
        ? `You are temporarily blocked. Try again after ${Math.ceil(result.retryAfter! / 60)} minutes.`
        : `Too many requests. Try again in ${result.retryAfter} seconds.`,
      retryAfter: result.retryAfter
    },
    { status: 429 }
  )

  // Add rate limit headers
  response.headers.set("X-RateLimit-Limit", result.limit.toString())
  response.headers.set("X-RateLimit-Remaining", result.remaining.toString())
  response.headers.set("X-RateLimit-Reset", new Date(result.reset).toISOString())

  if (result.retryAfter) {
    response.headers.set("Retry-After", result.retryAfter.toString())
  }

  if (result.blocked) {
    response.headers.set("X-RateLimit-Blocked", "true")
    if (result.blockUntil) {
      response.headers.set("X-RateLimit-Block-Until", new Date(result.blockUntil).toISOString())
    }
  }

  return response
}