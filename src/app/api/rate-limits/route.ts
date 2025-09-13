import { NextRequest } from "next/server"
import { prisma } from "@/lib/db"
import { requireAuth, requireAdmin, getClientIP } from "@/lib/api/auth"
import { checkRateLimit, getRateLimitStatus } from "@/lib/api/rate-limit"
import { createSuccessResponse, handleApiError, createErrorResponse, parseQueryParams } from "@/lib/api/response"
import { rateLimitQuerySchema } from "@/lib/api/validation"
import { logSecurityEvent } from "@/lib/security"
import { SecurityAction, UserRole } from "@prisma/client"

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const currentUser = await requireAuth()()

    // Check rate limiting
    const rateLimit = await checkRateLimit(request, currentUser.id, "/api/rate-limits", "api")
    if (!rateLimit.success) {
      return createErrorResponse("Rate limit exceeded", 429)
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const query = rateLimitQuerySchema.parse({
      endpoint: searchParams.get("endpoint"),
      userId: searchParams.get("userId")
    })

    // Build where clause
    const whereClause: any = {}

    // Non-admin users can only see their own rate limits
    if (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.SECURITY_LEAD) {
      whereClause.userId = currentUser.id
    } else if (query.userId) {
      whereClause.userId = query.userId
    }

    if (query.endpoint) {
      whereClause.endpoint = query.endpoint
    }

    // Only show active rate limit entries (not expired)
    whereClause.expiresAt = { gte: new Date() }

    // Get current rate limit entries
    const rateLimitEntries = await prisma.rateLimitEntry.findMany({
      where: whereClause,
      select: {
        id: true,
        userId: true,
        ip: true,
        endpoint: true,
        attempts: true,
        windowStart: true,
        expiresAt: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      },
      orderBy: { updatedAt: "desc" }
    })

    // Get summary statistics
    const stats = await getRateLimitStats(currentUser.id, currentUser.role)

    // Add status information to each entry
    const entriesWithStatus = rateLimitEntries.map(entry => {
      const isNearLimit = entry.attempts >= 80 // 80% of typical limit
      const timeRemaining = Math.max(0, entry.expiresAt.getTime() - Date.now())

      return {
        ...entry,
        status: {
          isActive: entry.expiresAt > new Date(),
          isNearLimit,
          timeRemaining,
          remainingAttempts: Math.max(0, 100 - entry.attempts) // Assuming 100 as default limit
        }
      }
    })

    // Log access to rate limit data
    await logSecurityEvent({
      userId: currentUser.id,
      action: SecurityAction.PROFILE_UPDATE, // Using closest available action
      details: {
        action: "view_rate_limits",
        filters: query,
        resultCount: entriesWithStatus.length
      }
    })

    return createSuccessResponse(
      {
        rateLimits: entriesWithStatus,
        stats
      },
      `Retrieved ${entriesWithStatus.length} rate limit entries`
    )

  } catch (error) {
    return handleApiError(error)
  }
}

async function getRateLimitStats(currentUserId: string, userRole: UserRole) {
  const baseWhere: any = {
    expiresAt: { gte: new Date() }
  }

  // Non-admin users can only see their own stats
  if (userRole !== UserRole.ADMIN && userRole !== UserRole.SECURITY_LEAD) {
    baseWhere.userId = currentUserId
  }

  const [
    totalActive,
    nearLimitCount,
    topEndpoints,
    recentExceeded
  ] = await Promise.all([
    // Total active rate limit entries
    prisma.rateLimitEntry.count({
      where: baseWhere
    }),

    // Entries near their limits (>= 80 attempts)
    prisma.rateLimitEntry.count({
      where: {
        ...baseWhere,
        attempts: { gte: 80 }
      }
    }),

    // Top endpoints by rate limit usage
    prisma.rateLimitEntry.groupBy({
      by: ['endpoint'],
      where: baseWhere,
      _count: { endpoint: true },
      _sum: { attempts: true },
      orderBy: { _sum: { attempts: 'desc' } },
      take: 5
    }),

    // Recent rate limit exceeded events
    prisma.securityLog.count({
      where: {
        action: SecurityAction.RATE_LIMIT_EXCEEDED,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Last 24 hours
        ...(userRole !== UserRole.ADMIN && userRole !== UserRole.SECURITY_LEAD
          ? { userId: currentUserId }
          : {}
        )
      }
    })
  ])

  return {
    totalActive,
    nearLimitCount,
    recentExceeded,
    topEndpoints: topEndpoints.map(endpoint => ({
      endpoint: endpoint.endpoint,
      count: endpoint._count.endpoint,
      totalAttempts: endpoint._sum.attempts
    }))
  }
}