import { NextRequest } from "next/server"
import { prisma } from "@/lib/db"
import { requireAuth } from "@/lib/api/auth"
import { checkRateLimit } from "@/lib/api/rate-limit"
import { createSuccessResponse, handleApiError, createErrorResponse, createPaginationMeta } from "@/lib/api/response"
import { parseQueryParams } from "@/lib/api/response"
import { logSecurityEvent } from "@/lib/security"
import { SecurityAction, UserRole } from "@prisma/client"

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const currentUser = await requireAuth()()

    // Check rate limiting
    const rateLimit = await checkRateLimit(request, currentUser.id, "/api/security/suspicious", "api")
    if (!rateLimit.success) {
      return createErrorResponse("Rate limit exceeded", 429)
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const { page, limit, sort, order } = parseQueryParams(searchParams)
    const severity = searchParams.get("severity") || "all"
    const timeRange = searchParams.get("timeRange") || "24h"

    // Calculate time range
    let startDate: Date
    switch (timeRange) {
      case "1h":
        startDate = new Date(Date.now() - 60 * 60 * 1000)
        break
      case "24h":
        startDate = new Date(Date.now() - 24 * 60 * 60 * 1000)
        break
      case "7d":
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        break
      case "30d":
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        break
      default:
        startDate = new Date(Date.now() - 24 * 60 * 60 * 1000)
    }

    // Build where clause for suspicious activity
    const whereClause: any = {
      createdAt: { gte: startDate },
      OR: [
        { action: SecurityAction.SUSPICIOUS_ACTIVITY },
        { action: SecurityAction.RATE_LIMIT_EXCEEDED },
        { action: SecurityAction.LOGIN_FAILED, success: false },
        { action: SecurityAction.ACCOUNT_LOCKED }
      ]
    }

    // Non-admin users can only see their own logs
    if (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.SECURITY_LEAD) {
      whereClause.userId = currentUser.id
    }

    // Get total count
    const total = await prisma.securityLog.count({ where: whereClause })

    // Get suspicious activity logs
    const suspiciousLogs = await prisma.securityLog.findMany({
      where: whereClause,
      select: {
        id: true,
        userId: true,
        action: true,
        details: true,
        ip: true,
        userAgent: true,
        success: true,
        createdAt: true
      },
      orderBy: { createdAt: order },
      skip: (page - 1) * limit,
      take: limit
    })

    // Process logs and categorize by severity
    const processedLogs = suspiciousLogs.map(log => {
      const details = log.details ? JSON.parse(log.details as string) : null
      let severityLevel = "low"

      // Determine severity based on action and details
      switch (log.action) {
        case SecurityAction.SUSPICIOUS_ACTIVITY:
          severityLevel = details?.reason === "multiple_failed_logins" ? "high" : "medium"
          break
        case SecurityAction.RATE_LIMIT_EXCEEDED:
          severityLevel = "medium"
          break
        case SecurityAction.LOGIN_FAILED:
          severityLevel = "low"
          break
        case SecurityAction.ACCOUNT_LOCKED:
          severityLevel = "high"
          break
      }

      return {
        ...log,
        details,
        severity: severityLevel,
        description: generateDescription(log.action, details)
      }
    })

    // Filter by severity if specified
    const filteredLogs = severity === "all"
      ? processedLogs
      : processedLogs.filter(log => log.severity === severity)

    // Get summary statistics
    const stats = await getSuspiciousActivityStats(currentUser.id, startDate, currentUser.role)

    // Log access to suspicious activity data
    await logSecurityEvent({
      userId: currentUser.id,
      action: SecurityAction.PROFILE_UPDATE, // Using closest available action
      details: {
        action: "view_suspicious_activity",
        timeRange,
        severity,
        resultCount: filteredLogs.length
      }
    })

    const meta = createPaginationMeta(filteredLogs.length, page, limit)

    return createSuccessResponse(
      {
        logs: filteredLogs,
        stats
      },
      `Retrieved ${filteredLogs.length} suspicious activity alerts`,
      meta
    )

  } catch (error) {
    return handleApiError(error)
  }
}

function generateDescription(action: SecurityAction, details: any): string {
  switch (action) {
    case SecurityAction.SUSPICIOUS_ACTIVITY:
      if (details?.reason === "multiple_failed_logins") {
        return `Multiple failed login attempts (${details.count} attempts)`
      }
      if (details?.reason === "excessive_activity") {
        return `Excessive activity detected (${details.count} actions)`
      }
      return "Suspicious activity detected"

    case SecurityAction.RATE_LIMIT_EXCEEDED:
      return `Rate limit exceeded for ${details?.endpoint || "unknown endpoint"}`

    case SecurityAction.LOGIN_FAILED:
      return `Failed login attempt${details?.reason ? ` (${details.reason})` : ""}`

    case SecurityAction.ACCOUNT_LOCKED:
      return `Account locked${details?.reason ? ` (${details.reason})` : ""}`

    default:
      return "Security event"
  }
}

async function getSuspiciousActivityStats(
  currentUserId: string,
  startDate: Date,
  userRole: UserRole
) {
  const baseWhere: any = {
    createdAt: { gte: startDate }
  }

  // Non-admin users can only see their own stats
  if (userRole !== UserRole.ADMIN && userRole !== UserRole.SECURITY_LEAD) {
    baseWhere.userId = currentUserId
  }

  const [
    totalSuspicious,
    failedLogins,
    rateLimitExceeded,
    accountsLocked,
    uniqueIPs
  ] = await Promise.all([
    // Total suspicious activities
    prisma.securityLog.count({
      where: {
        ...baseWhere,
        action: SecurityAction.SUSPICIOUS_ACTIVITY
      }
    }),

    // Failed login attempts
    prisma.securityLog.count({
      where: {
        ...baseWhere,
        action: SecurityAction.LOGIN_FAILED,
        success: false
      }
    }),

    // Rate limit exceeded events
    prisma.securityLog.count({
      where: {
        ...baseWhere,
        action: SecurityAction.RATE_LIMIT_EXCEEDED
      }
    }),

    // Account locked events
    prisma.securityLog.count({
      where: {
        ...baseWhere,
        action: SecurityAction.ACCOUNT_LOCKED
      }
    }),

    // Unique IPs with suspicious activity
    prisma.securityLog.findMany({
      where: {
        ...baseWhere,
        OR: [
          { action: SecurityAction.SUSPICIOUS_ACTIVITY },
          { action: SecurityAction.RATE_LIMIT_EXCEEDED }
        ],
        ip: { not: null }
      },
      select: { ip: true },
      distinct: ["ip"]
    })
  ])

  return {
    totalSuspicious,
    failedLogins,
    rateLimitExceeded,
    accountsLocked,
    uniqueIPsCount: uniqueIPs.length,
    severityBreakdown: {
      high: totalSuspicious + accountsLocked,
      medium: rateLimitExceeded,
      low: failedLogins
    }
  }
}