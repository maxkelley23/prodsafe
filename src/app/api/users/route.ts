import { NextRequest } from "next/server"
import { prisma } from "@/lib/db"
import { requireAdmin } from "@/lib/api/auth"
import { checkRateLimit } from "@/lib/api/rate-limit"
import { createSuccessResponse, handleApiError, createPaginationMeta } from "@/lib/api/response"
import { userQuerySchema } from "@/lib/api/validation"
import { logSecurityEvent } from "@/lib/security"
import { SecurityAction } from "@prisma/client"

export async function GET(request: NextRequest) {
  try {
    // Check authentication and authorization
    const currentUser = await requireAdmin()()

    // Check rate limiting
    const rateLimit = await checkRateLimit(request, currentUser.id, "/api/users", "admin")
    if (!rateLimit.success) {
      return createSuccessResponse(
        { error: "Rate limit exceeded" },
        "Rate limit exceeded",
      )
    }

    // Parse and validate query parameters
    const searchParams = request.nextUrl.searchParams
    const query = userQuerySchema.parse({
      page: searchParams.get("page"),
      limit: searchParams.get("limit"),
      sort: searchParams.get("sort"),
      order: searchParams.get("order"),
      role: searchParams.get("role"),
      isActive: searchParams.get("isActive") ? searchParams.get("isActive") === "true" : undefined,
      search: searchParams.get("search")
    })

    // Build where clause
    const whereClause: any = {}

    if (query.role) {
      whereClause.role = query.role
    }

    if (query.isActive !== undefined) {
      whereClause.isActive = query.isActive
    }

    if (query.search) {
      whereClause.OR = [
        { name: { contains: query.search, mode: "insensitive" } },
        { email: { contains: query.search, mode: "insensitive" } }
      ]
    }

    // Get total count for pagination
    const total = await prisma.user.count({ where: whereClause })

    // Get users with pagination
    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            sessions: true,
            rateLimitEntries: true
          }
        }
      },
      orderBy: { [query.sort]: query.order },
      skip: (query.page - 1) * query.limit,
      take: query.limit
    })

    // Log security event
    await logSecurityEvent({
      userId: currentUser.id,
      action: SecurityAction.PROFILE_UPDATE, // Using closest available action
      details: {
        action: "view_users",
        filters: query,
        resultCount: users.length
      }
    })

    const meta = createPaginationMeta(total, query.page, query.limit)

    return createSuccessResponse(
      users,
      `Retrieved ${users.length} users`,
      meta
    )

  } catch (error) {
    return handleApiError(error)
  }
}