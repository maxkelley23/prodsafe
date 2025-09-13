import { NextRequest } from "next/server"
import { prisma } from "@/lib/db"
import { requireAdmin, requireAuth } from "@/lib/api/auth"
import { checkRateLimit } from "@/lib/api/rate-limit"
import { createSuccessResponse, handleApiError, createErrorResponse } from "@/lib/api/response"
import { updateUserSchema, validateId } from "@/lib/api/validation"
import { logSecurityEvent } from "@/lib/security"
import { SecurityAction } from "@prisma/client"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
    const currentUser = await requireAuth()()

    // Validate user ID format
    if (!validateId(params.id)) {
      return createErrorResponse("Invalid user ID format", 400)
    }

    // Check if user is requesting their own data or is admin
    const isOwnData = currentUser.id === params.id
    if (!isOwnData) {
      await requireAdmin()()
    }

    // Check rate limiting
    const rateLimit = await checkRateLimit(
      request,
      currentUser.id,
      `/api/users/${params.id}`,
      isOwnData ? "api" : "admin"
    )
    if (!rateLimit.success) {
      return createErrorResponse("Rate limit exceeded", 429)
    }

    // Fetch user data
    const user = await prisma.user.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        profile: {
          select: {
            bio: true,
            website: true,
            location: true,
            company: true,
            githubUsername: true,
            linkedinUsername: true,
            twitterUsername: true,
            timezone: true,
            language: true,
            theme: true,
            emailNotifications: true,
            securityAlerts: true,
            marketingEmails: true,
            createdAt: true,
            updatedAt: true
          }
        },
        _count: {
          select: {
            sessions: true,
            accounts: true,
            rateLimitEntries: true
          }
        }
      }
    })

    if (!user) {
      return createErrorResponse("User not found", 404)
    }

    // Log security event
    await logSecurityEvent({
      userId: currentUser.id,
      action: SecurityAction.PROFILE_UPDATE, // Using closest available action
      details: {
        action: "view_user_details",
        targetUserId: params.id,
        isOwnData
      }
    })

    return createSuccessResponse(user, "User details retrieved successfully")

  } catch (error) {
    return handleApiError(error)
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication and authorization (admin only for user updates)
    const currentUser = await requireAdmin()()

    // Validate user ID format
    if (!validateId(params.id)) {
      return createErrorResponse("Invalid user ID format", 400)
    }

    // Check rate limiting
    const rateLimit = await checkRateLimit(request, currentUser.id, `/api/users/${params.id}`, "admin")
    if (!rateLimit.success) {
      return createErrorResponse("Rate limit exceeded", 429)
    }

    // Parse and validate request body
    const body = await request.json()
    const validatedData = updateUserSchema.parse(body)

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: params.id },
      select: { id: true, role: true, isActive: true }
    })

    if (!existingUser) {
      return createErrorResponse("User not found", 404)
    }

    // Prevent admin from deactivating themselves
    if (params.id === currentUser.id && validatedData.isActive === false) {
      return createErrorResponse("Cannot deactivate your own account", 400)
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: params.id },
      data: validatedData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        updatedAt: true
      }
    })

    // Log security event
    await logSecurityEvent({
      userId: currentUser.id,
      action: SecurityAction.PROFILE_UPDATE,
      details: {
        action: "update_user",
        targetUserId: params.id,
        changes: validatedData,
        previousValues: {
          role: existingUser.role,
          isActive: existingUser.isActive
        }
      }
    })

    // If user was deactivated, log additional security event
    if (validatedData.isActive === false && existingUser.isActive === true) {
      await logSecurityEvent({
        userId: params.id,
        action: SecurityAction.ACCOUNT_LOCKED,
        details: { lockedBy: currentUser.id }
      })
    }

    // If user was reactivated, log additional security event
    if (validatedData.isActive === true && existingUser.isActive === false) {
      await logSecurityEvent({
        userId: params.id,
        action: SecurityAction.ACCOUNT_UNLOCKED,
        details: { unlockedBy: currentUser.id }
      })
    }

    return createSuccessResponse(updatedUser, "User updated successfully")

  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication and authorization (admin only)
    const currentUser = await requireAdmin()()

    // Validate user ID format
    if (!validateId(params.id)) {
      return createErrorResponse("Invalid user ID format", 400)
    }

    // Prevent admin from deleting themselves
    if (params.id === currentUser.id) {
      return createErrorResponse("Cannot deactivate your own account", 400)
    }

    // Check rate limiting
    const rateLimit = await checkRateLimit(request, currentUser.id, `/api/users/${params.id}`, "admin")
    if (!rateLimit.success) {
      return createErrorResponse("Rate limit exceeded", 429)
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: params.id },
      select: { id: true, isActive: true }
    })

    if (!existingUser) {
      return createErrorResponse("User not found", 404)
    }

    // Soft delete - deactivate user instead of hard delete
    const deactivatedUser = await prisma.user.update({
      where: { id: params.id },
      data: { isActive: false },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        updatedAt: true
      }
    })

    // Log security event
    await logSecurityEvent({
      userId: currentUser.id,
      action: SecurityAction.PROFILE_UPDATE,
      details: {
        action: "deactivate_user",
        targetUserId: params.id
      }
    })

    await logSecurityEvent({
      userId: params.id,
      action: SecurityAction.ACCOUNT_LOCKED,
      details: {
        reason: "admin_deactivation",
        deactivatedBy: currentUser.id
      }
    })

    return createSuccessResponse(deactivatedUser, "User deactivated successfully")

  } catch (error) {
    return handleApiError(error)
  }
}