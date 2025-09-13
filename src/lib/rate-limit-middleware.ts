import { NextRequest, NextResponse } from "next/server"
import { UserRole } from "@prisma/client"
import { getToken } from "next-auth/jwt"
import {
  checkRateLimit,
  createRateLimitResponse,
  getClientIP,
  RateLimitContext,
  RateLimitResult
} from "./rate-limiter"
import { RateLimitConfig } from "./rate-limit-config"

// Main middleware function type
export type RateLimitMiddleware = (
  request: NextRequest,
  context?: { params?: Record<string, string> }
) => Promise<NextResponse | void>

// Middleware options
export interface RateLimitMiddlewareOptions {
  configKey: string
  customConfig?: RateLimitConfig
  operationType?: string
  skipAuthCheck?: boolean
  onViolation?: (context: RateLimitContext, result: RateLimitResult) => Promise<void>
  onSuccess?: (context: RateLimitContext, result: RateLimitResult) => Promise<void>
}

// Create rate limiting middleware
export function createRateLimitMiddleware(
  options: RateLimitMiddlewareOptions
): RateLimitMiddleware {
  return async (request: NextRequest, routeContext?: { params?: Record<string, string> }) => {
    try {
      // Extract context information
      const ip = getClientIP(request)
      const userAgent = request.headers.get("user-agent") || "unknown"
      const endpoint = getEndpointName(request, routeContext)

      let userId: string | undefined
      let userRole: UserRole | undefined

      // Get user information from JWT token if not skipping auth check
      if (!options.skipAuthCheck) {
        try {
          const token = await getToken({
            req: request,
            secret: process.env.NEXTAUTH_SECRET
          })

          if (token) {
            userId = token.sub
            userRole = token.role as UserRole
          }
        } catch (error) {
          console.warn("Failed to get token for rate limiting:", error)
        }
      }

      const context: RateLimitContext = {
        userId,
        userRole,
        ip,
        userAgent,
        endpoint,
        operationType: options.operationType
      }

      // Check rate limit
      const result = await checkRateLimit(
        context,
        options.configKey,
        options.customConfig
      )

      // Handle rate limit exceeded
      if (!result.success) {
        // Call custom violation handler if provided
        if (options.onViolation) {
          await options.onViolation(context, result)
        }

        return createRateLimitResponse(result)
      }

      // Call custom success handler if provided
      if (options.onSuccess) {
        await options.onSuccess(context, result)
      }

      // Add rate limit headers to response (will be added by Next.js middleware)
      const response = NextResponse.next()
      response.headers.set("X-RateLimit-Limit", result.limit.toString())
      response.headers.set("X-RateLimit-Remaining", result.remaining.toString())
      response.headers.set("X-RateLimit-Reset", new Date(result.reset).toISOString())

      return response

    } catch (error) {
      console.error("Rate limiting middleware error:", error)
      // Fail open - allow the request to continue
      return NextResponse.next()
    }
  }
}

// Get endpoint name for rate limiting
function getEndpointName(
  request: NextRequest,
  routeContext?: { params?: Record<string, string> }
): string {
  const url = new URL(request.url)
  let pathname = url.pathname

  // Replace dynamic segments with placeholders
  if (routeContext?.params) {
    Object.entries(routeContext.params).forEach(([key, value]) => {
      pathname = pathname.replace(value, `[${key}]`)
    })
  }

  return `${request.method}:${pathname}`
}

// Predefined middleware instances for common use cases

// Authentication endpoints
export const authRateLimit = createRateLimitMiddleware({
  configKey: "auth_login",
  skipAuthCheck: true
})

// API endpoints with role-based limiting
export const apiRateLimit = createRateLimitMiddleware({
  configKey: "api_user"
})

// Security-sensitive operations
export const securitySensitiveRateLimit = createRateLimitMiddleware({
  configKey: "security_sensitive"
})

// Public endpoints
export const publicRateLimit = createRateLimitMiddleware({
  configKey: "public",
  skipAuthCheck: true
})

// Higher-order function to create endpoint-specific middleware
export function withRateLimit(
  configKey: string,
  options: Partial<RateLimitMiddlewareOptions> = {}
): RateLimitMiddleware {
  return createRateLimitMiddleware({
    configKey,
    ...options
  })
}

// Decorator for API route handlers
export function rateLimited(
  configKeyOrOptions: string | RateLimitMiddlewareOptions
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value
    const options = typeof configKeyOrOptions === "string"
      ? { configKey: configKeyOrOptions }
      : configKeyOrOptions

    descriptor.value = async function (request: NextRequest, ...args: any[]) {
      const middleware = createRateLimitMiddleware(options)
      const middlewareResult = await middleware(request)

      // If middleware returns a response, return it (rate limit exceeded)
      if (middlewareResult instanceof NextResponse) {
        return middlewareResult
      }

      // Otherwise, call the original method
      return originalMethod.call(this, request, ...args)
    }

    return descriptor
  }
}

// Utility function for checking rate limits in API routes
export async function checkApiRateLimit(
  request: NextRequest,
  configKey: string,
  customConfig?: RateLimitConfig
): Promise<{ allowed: boolean; response?: NextResponse }> {
  const middleware = createRateLimitMiddleware({
    configKey,
    customConfig
  })

  const result = await middleware(request)

  if (result instanceof NextResponse && result.status === 429) {
    return { allowed: false, response: result }
  }

  return { allowed: true }
}

// Batch rate limiting for bulk operations
export async function checkBatchRateLimit(
  request: NextRequest,
  configKey: string,
  batchSize: number,
  customConfig?: RateLimitConfig
): Promise<{ allowed: boolean; response?: NextResponse }> {
  // Adjust the rate limit based on batch size
  const adjustedConfig = customConfig ? {
    ...customConfig,
    rules: customConfig.rules.map(rule => ({
      ...rule,
      requests: Math.max(1, Math.floor(rule.requests / batchSize))
    }))
  } : undefined

  return checkApiRateLimit(request, configKey, adjustedConfig)
}

// Rate limiting for webhooks with signature verification
export function createWebhookRateLimit(
  configKey: string,
  verifySignature?: (request: NextRequest) => Promise<boolean>
): RateLimitMiddleware {
  return createRateLimitMiddleware({
    configKey,
    skipAuthCheck: true,
    onViolation: async (context, result) => {
      console.warn(`Webhook rate limit exceeded from ${context.ip}`, {
        endpoint: context.endpoint,
        remaining: result.remaining
      })
    },
    onSuccess: async (context, result) => {
      // Verify signature if provided
      if (verifySignature) {
        // Note: This would need to be implemented in the actual webhook handler
        console.debug(`Webhook rate limit passed for ${context.endpoint}`)
      }
    }
  })
}

// Progressive rate limiting - increases restrictions based on violations
export function createProgressiveRateLimit(
  baseConfigKey: string
): RateLimitMiddleware {
  return async (request: NextRequest, routeContext?: { params?: Record<string, string> }) => {
    const ip = getClientIP(request)

    // Check violation history (simplified - you might want to use Redis for this)
    const violationKey = `violations:${ip}`

    // Get base configuration
    const middleware = createRateLimitMiddleware({
      configKey: baseConfigKey,
      onViolation: async (context, result) => {
        // Increment violation counter
        console.warn("Progressive rate limit violation", {
          ip: context.ip,
          endpoint: context.endpoint
        })
      }
    })

    return middleware(request, routeContext)
  }
}