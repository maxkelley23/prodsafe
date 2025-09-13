import { NextRequest, NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"
import { checkApiRateLimit } from "@/lib/rate-limit-middleware"
import { logSecurityEvent } from "@/lib/security"
import { SecurityAction, UserRole } from "@prisma/client"
import { prisma } from "@/lib/db"

// GET user profile with API rate limiting
export async function GET(request: NextRequest) {
  try {
    // Check rate limit
    const rateCheck = await checkApiRateLimit(request, "api_user")
    if (!rateCheck.allowed) {
      return rateCheck.response!
    }

    // Get user from token
    const token = await getToken({ req: request })
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: token.sub },
      include: { profile: true }
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    return NextResponse.json({ user })

  } catch (error) {
    console.error("Get profile error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// PUT update user profile with security-sensitive rate limiting
export async function PUT(request: NextRequest) {
  try {
    // Use security-sensitive rate limiting for profile updates
    const rateCheck = await checkApiRateLimit(request, "security_sensitive", {
      identifier: "op:profile_update",
      rules: [
        { requests: 5, window: "1 h", windowMs: 60 * 60 * 1000 }
      ],
      blockDuration: "30 m",
      blockDurationMs: 30 * 60 * 1000
    })

    if (!rateCheck.allowed) {
      return rateCheck.response!
    }

    // Get user from token
    const token = await getToken({ req: request })
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const {
      name,
      bio,
      website,
      location,
      company,
      githubUsername,
      linkedinUsername,
      twitterUsername,
      timezone,
      language,
      theme
    } = body

    // Update user profile
    const updatedUser = await prisma.user.update({
      where: { id: token.sub },
      data: {
        name,
        profile: {
          upsert: {
            create: {
              bio,
              website,
              location,
              company,
              githubUsername,
              linkedinUsername,
              twitterUsername,
              timezone,
              language,
              theme
            },
            update: {
              bio,
              website,
              location,
              company,
              githubUsername,
              linkedinUsername,
              twitterUsername,
              timezone,
              language,
              theme
            }
          }
        }
      },
      include: { profile: true }
    })

    // Log profile update
    await logSecurityEvent({
      userId: token.sub,
      action: SecurityAction.PROFILE_UPDATE,
      details: {
        updatedFields: Object.keys(body).filter(key => body[key] !== undefined)
      },
      success: true
    })

    return NextResponse.json({
      success: true,
      user: updatedUser
    })

  } catch (error) {
    console.error("Update profile error:", error)

    await logSecurityEvent({
      userId: (await getToken({ req: request }))?.sub,
      action: SecurityAction.PROFILE_UPDATE,
      details: { error: error instanceof Error ? error.message : "Unknown" },
      success: false
    })

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}