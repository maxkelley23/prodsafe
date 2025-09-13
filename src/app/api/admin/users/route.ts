import { NextRequest, NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"
import { checkApiRateLimit } from "@/lib/rate-limit-middleware"
import { UserRole } from "@prisma/client"
import { prisma } from "@/lib/db"

// GET all users - admin only with elevated rate limits
export async function GET(request: NextRequest) {
  try {
    // Get user from token first to determine role
    const token = await getToken({ req: request })
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user has admin privileges
    if (token.role !== UserRole.ADMIN && token.role !== UserRole.SECURITY_LEAD) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Use role-based rate limiting
    const configKey = token.role === UserRole.SECURITY_LEAD ? "api_security_lead" : "api_admin"
    const rateCheck = await checkApiRateLimit(request, configKey)

    if (!rateCheck.allowed) {
      return rateCheck.response!
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get("page") || "1")
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100)
    const search = searchParams.get("search")

    // Build where clause
    const where = search
      ? {
          OR: [
            { email: { contains: search, mode: "insensitive" as const } },
            { name: { contains: search, mode: "insensitive" as const } }
          ]
        }
      : {}

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.user.count({ where })
    ])

    return NextResponse.json({
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })

  } catch (error) {
    console.error("Admin get users error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// POST create user - admin only
export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request })
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (token.role !== UserRole.ADMIN && token.role !== UserRole.SECURITY_LEAD) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Use security-sensitive rate limiting for user creation
    const rateCheck = await checkApiRateLimit(request, "security_sensitive")
    if (!rateCheck.allowed) {
      return rateCheck.response!
    }

    const body = await request.json()
    const { email, name, role = UserRole.USER } = body

    if (!email || !name) {
      return NextResponse.json(
        { error: "Email and name are required" },
        { status: 400 }
      )
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 409 }
      )
    }

    // Only SECURITY_LEAD can create ADMIN or SECURITY_LEAD users
    if (role !== UserRole.USER && token.role !== UserRole.SECURITY_LEAD) {
      return NextResponse.json(
        { error: "Insufficient permissions to create privileged users" },
        { status: 403 }
      )
    }

    const newUser = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        name,
        role,
        isActive: true
      }
    })

    return NextResponse.json({
      success: true,
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        isActive: newUser.isActive,
        createdAt: newUser.createdAt
      }
    })

  } catch (error) {
    console.error("Admin create user error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}