import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"
import { NextRequest } from "next/server"
import { getClientIP } from "./auth"
import { prisma } from "@/lib/db"
import { logSecurityEvent } from "@/lib/security"
import { SecurityAction } from "@prisma/client"

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!
})

// Different rate limits for different endpoints
export const rateLimits = {
  // General API rate limiting
  api: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, "1 h"), // 100 requests per hour
    analytics: true,
  }),

  // Authentication endpoints
  auth: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "15 m"), // 10 attempts per 15 minutes
    analytics: true,
  }),

  // Profile updates
  profile: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "1 h"), // 5 updates per hour
    analytics: true,
  }),

  // Admin actions
  admin: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(50, "1 h"), // 50 admin actions per hour
    analytics: true,
  }),
}

export interface RateLimitResult {
  success: boolean
  remaining: number
  reset: number
  limit: number
}

export async function checkRateLimit(
  request: NextRequest,
  userId: string | null,
  endpoint: string,
  rateLimitType: keyof typeof rateLimits = "api"
): Promise<RateLimitResult> {
  const ip = getClientIP(request)
  const identifier = userId || ip
  const rateLimit = rateLimits[rateLimitType]

  const result = await rateLimit.limit(`${rateLimitType}:${identifier}`)

  // Log rate limit entry to database for tracking
  const windowStart = new Date(Date.now() - (60 * 60 * 1000)) // 1 hour window
  const expiresAt = new Date(result.reset)

  try {
    await prisma.rateLimitEntry.upsert({
      where: {
        userId_endpoint: {
          userId: userId || "",
          endpoint
        }
      },
      update: {
        attempts: result.limit - result.remaining,
        windowStart,
        expiresAt
      },
      create: {
        userId,
        ip,
        endpoint,
        attempts: result.limit - result.remaining,
        windowStart,
        expiresAt
      }
    })
  } catch (error) {
    console.error("Failed to log rate limit entry:", error)
  }

  // Log rate limit exceeded events
  if (!result.success && userId) {
    await logSecurityEvent({
      userId,
      action: SecurityAction.RATE_LIMIT_EXCEEDED,
      details: {
        endpoint,
        limit: result.limit,
        remaining: result.remaining,
        reset: result.reset
      },
      success: false
    })
  }

  return {
    success: result.success,
    remaining: result.remaining,
    reset: result.reset,
    limit: result.limit
  }
}

export async function getRateLimitStatus(
  userId: string | null,
  endpoint: string
): Promise<RateLimitResult | null> {
  try {
    const entry = await prisma.rateLimitEntry.findFirst({
      where: {
        OR: [
          { userId },
          { ip: "current" } // This would need to be resolved in actual usage
        ],
        endpoint
      },
      orderBy: { updatedAt: "desc" }
    })

    if (!entry || entry.expiresAt < new Date()) {
      return null
    }

    return {
      success: entry.attempts < 100, // Default limit
      remaining: Math.max(0, 100 - entry.attempts),
      reset: entry.expiresAt.getTime(),
      limit: 100
    }
  } catch (error) {
    console.error("Failed to get rate limit status:", error)
    return null
  }
}

export async function resetRateLimit(userId: string, endpoint: string): Promise<boolean> {
  try {
    await prisma.rateLimitEntry.deleteMany({
      where: {
        userId,
        endpoint
      }
    })

    // Also clear from Redis
    const rateLimit = rateLimits.api
    await redis.del(`api:${userId}`)

    return true
  } catch (error) {
    console.error("Failed to reset rate limit:", error)
    return false
  }
}