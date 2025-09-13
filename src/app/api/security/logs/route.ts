import { NextRequest } from "next/server"
import { prisma } from "@/lib/db"
import { requireAuth, requireAdmin } from "@/lib/api/auth"
import { checkRateLimit } from "@/lib/api/rate-limit"
import { createSuccessResponse, handleApiError, createPaginationMeta, createErrorResponse } from "@/lib/api/response"
import { createSecurityLogSchema, securityLogsQuerySchema, validateAndParseDate } from "@/lib/api/validation"
import { logSecurityEvent } from "@/lib/security"
import { SecurityAction, UserRole } from "@prisma/client"

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const currentUser = await requireAuth()()

    // Check rate limiting
    const rateLimit = await checkRateLimit(request, currentUser.id, "/api/security/logs", "api")
    if (!rateLimit.success) {
      return createErrorResponse("Rate limit exceeded", 429)
    }

    // Parse and validate query parameters
    const searchParams = request.nextUrl.searchParams
    const query = securityLogsQuerySchema.parse({
      page: searchParams.get("page"),
      limit: searchParams.get("limit"),
      sort: searchParams.get("sort"),
      order: searchParams.get("order"),
      userId: searchParams.get("userId"),
      action: searchParams.get("action"),
      success: searchParams.get("success") ? searchParams.get("success") === "true" : undefined,
      startDate: searchParams.get("startDate"),
      endDate: searchParams.get("endDate"),
      ip: searchParams.get("ip")
    })

    // Build where clause
    const whereClause: any = {}

    // Non-admin users can only see their own logs
    if (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.SECURITY_LEAD) {
      whereClause.userId = currentUser.id
    } else if (query.userId) {
      whereClause.userId = query.userId
    }

    if (query.action) {
      whereClause.action = query.action
    }

    if (query.success !== undefined) {
      whereClause.success = query.success
    }

    if (query.ip) {
      whereClause.ip = { contains: query.ip, mode: "insensitive" }
    }

    // Date filtering
    if (query.startDate || query.endDate) {
      whereClause.createdAt = {}
      if (query.startDate) {
        whereClause.createdAt.gte = validateAndParseDate(query.startDate)
      }
      if (query.endDate) {
        whereClause.createdAt.lte = validateAndParseDate(query.endDate)
      }
    }

    // Get total count for pagination
    const total = await prisma.securityLog.count({ where: whereClause })

    // Get security logs with pagination
    const logs = await prisma.securityLog.findMany({
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
      orderBy: { [query.sort]: query.order },
      skip: (query.page - 1) * query.limit,
      take: query.limit
    })

    // Parse JSON details for response
    const processedLogs = logs.map(log => ({
      ...log,
      details: log.details ? JSON.parse(log.details as string) : null
    }))

    // Log access to security logs
    await logSecurityEvent({
      userId: currentUser.id,
      action: SecurityAction.PROFILE_UPDATE, // Using closest available action
      details: {
        action: "view_security_logs",
        filters: query,
        resultCount: logs.length
      }
    })

    const meta = createPaginationMeta(total, query.page, query.limit)

    return createSuccessResponse(
      processedLogs,
      `Retrieved ${processedLogs.length} security logs`,
      meta
    )

  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication and authorization (admin only for creating logs)
    const currentUser = await requireAdmin()()

    // Check rate limiting
    const rateLimit = await checkRateLimit(request, currentUser.id, "/api/security/logs", "admin")
    if (!rateLimit.success) {
      return createErrorResponse("Rate limit exceeded", 429)
    }

    // Parse and validate request body
    const body = await request.json()
    const validatedData = createSecurityLogSchema.parse(body)

    // Create security log entry
    const securityLog = await prisma.securityLog.create({
      data: {
        userId: validatedData.userId,
        action: validatedData.action,
        details: validatedData.details ? JSON.stringify(validatedData.details) : null,
        ip: validatedData.ip,
        userAgent: validatedData.userAgent,
        success: validatedData.success
      },
      select: {
        id: true,
        userId: true,
        action: true,
        details: true,
        ip: true,
        userAgent: true,
        success: true,
        createdAt: true
      }
    })

    // Log the creation of this security log entry
    await logSecurityEvent({
      userId: currentUser.id,
      action: SecurityAction.PROFILE_UPDATE, // Using closest available action
      details: {
        action: "create_security_log",
        targetLogId: securityLog.id,
        logAction: validatedData.action
      }
    })

    // Parse details for response
    const processedLog = {
      ...securityLog,
      details: securityLog.details ? JSON.parse(securityLog.details as string) : null
    }

    return createSuccessResponse(processedLog, "Security log created successfully")

  } catch (error) {
    return handleApiError(error)
  }
}