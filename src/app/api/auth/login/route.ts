import { NextRequest, NextResponse } from "next/server"
import { checkApiRateLimit } from "@/lib/rate-limit-middleware"
import { logSecurityEvent } from "@/lib/security"
import { SecurityAction } from "@prisma/client"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/db"
import { validateEmail } from "@/lib/security"

export async function POST(request: NextRequest) {
  try {
    // Check rate limit first
    const rateCheck = await checkApiRateLimit(request, "auth_login")
    if (!rateCheck.allowed) {
      return rateCheck.response!
    }

    const body = await request.json()
    const { email, password } = body

    // Validate input
    if (!email || !password) {
      await logSecurityEvent({
        action: SecurityAction.LOGIN_FAILED,
        details: { reason: "missing_credentials", email },
        success: false
      })

      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      )
    }

    if (!validateEmail(email)) {
      await logSecurityEvent({
        action: SecurityAction.LOGIN_FAILED,
        details: { reason: "invalid_email", email },
        success: false
      })

      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      )
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { profile: true }
    })

    if (!user) {
      await logSecurityEvent({
        action: SecurityAction.LOGIN_FAILED,
        details: { reason: "user_not_found", email },
        success: false
      })

      // Generic error message to prevent user enumeration
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      )
    }

    if (!user.isActive) {
      await logSecurityEvent({
        userId: user.id,
        action: SecurityAction.LOGIN_FAILED,
        details: { reason: "account_inactive", email },
        success: false
      })

      return NextResponse.json(
        { error: "Account is inactive" },
        { status: 401 }
      )
    }

    // For demo purposes - in real app, you'd have a password field
    // This assumes you have authentication setup with NextAuth or similar
    const isValidPassword = await bcrypt.compare(password, user.email) // placeholder

    if (!isValidPassword) {
      await logSecurityEvent({
        userId: user.id,
        action: SecurityAction.LOGIN_FAILED,
        details: { reason: "invalid_password", email },
        success: false
      })

      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      )
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    })

    // Log successful login
    await logSecurityEvent({
      userId: user.id,
      action: SecurityAction.LOGIN_SUCCESS,
      details: { email },
      success: true
    })

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    })

  } catch (error) {
    console.error("Login error:", error)

    await logSecurityEvent({
      action: SecurityAction.LOGIN_FAILED,
      details: { reason: "server_error", error: error instanceof Error ? error.message : "Unknown" },
      success: false
    })

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}