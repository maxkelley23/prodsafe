import { NextRequest } from "next/server"
import { prisma } from "@/lib/db"
import { requireAuth } from "@/lib/api/auth"
import { checkRateLimit } from "@/lib/api/rate-limit"
import { createSuccessResponse, handleApiError, createErrorResponse } from "@/lib/api/response"
import { updateProfileSchema, sanitizeString } from "@/lib/api/validation"
import { logSecurityEvent } from "@/lib/security"
import { SecurityAction } from "@prisma/client"

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const currentUser = await requireAuth()()

    // Check rate limiting
    const rateLimit = await checkRateLimit(request, currentUser.id, "/api/profile", "api")
    if (!rateLimit.success) {
      return createErrorResponse("Rate limit exceeded", 429)
    }

    // Fetch user profile with user data
    const userWithProfile = await prisma.user.findUnique({
      where: { id: currentUser.id },
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
            id: true,
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
        }
      }
    })

    if (!userWithProfile) {
      return createErrorResponse("User not found", 404)
    }

    // If no profile exists, create a default one
    if (!userWithProfile.profile) {
      const newProfile = await prisma.userProfile.create({
        data: {
          userId: currentUser.id,
          timezone: "UTC",
          language: "en",
          theme: "system",
          emailNotifications: true,
          securityAlerts: true,
          marketingEmails: false
        },
        select: {
          id: true,
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
      })

      userWithProfile.profile = newProfile

      // Log profile creation
      await logSecurityEvent({
        userId: currentUser.id,
        action: SecurityAction.PROFILE_UPDATE,
        details: { action: "profile_created" }
      })
    }

    // Log profile access
    await logSecurityEvent({
      userId: currentUser.id,
      action: SecurityAction.PROFILE_UPDATE,
      details: { action: "profile_viewed" }
    })

    return createSuccessResponse(userWithProfile, "Profile retrieved successfully")

  } catch (error) {
    return handleApiError(error)
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Check authentication
    const currentUser = await requireAuth()()

    // Check rate limiting with stricter limits for profile updates
    const rateLimit = await checkRateLimit(request, currentUser.id, "/api/profile", "profile")
    if (!rateLimit.success) {
      return createErrorResponse("Rate limit exceeded. Please wait before updating your profile again.", 429)
    }

    // Parse and validate request body
    const body = await request.json()
    const validatedData = updateProfileSchema.parse(body)

    // Sanitize string inputs
    const sanitizedData = {
      ...validatedData,
      bio: sanitizeString(validatedData.bio),
      location: sanitizeString(validatedData.location),
      company: sanitizeString(validatedData.company),
      githubUsername: sanitizeString(validatedData.githubUsername),
      linkedinUsername: sanitizeString(validatedData.linkedinUsername),
      twitterUsername: sanitizeString(validatedData.twitterUsername)
    }

    // Remove empty strings and convert to null
    Object.keys(sanitizedData).forEach(key => {
      if (sanitizedData[key as keyof typeof sanitizedData] === "") {
        (sanitizedData as any)[key] = null
      }
    })

    // Get existing profile to track changes
    const existingProfile = await prisma.userProfile.findUnique({
      where: { userId: currentUser.id }
    })

    // Update or create profile
    const updatedProfile = await prisma.userProfile.upsert({
      where: { userId: currentUser.id },
      create: {
        userId: currentUser.id,
        ...sanitizedData,
        // Set defaults for required fields if not provided
        timezone: sanitizedData.timezone || "UTC",
        language: sanitizedData.language || "en",
        theme: sanitizedData.theme || "system",
        emailNotifications: sanitizedData.emailNotifications ?? true,
        securityAlerts: sanitizedData.securityAlerts ?? true,
        marketingEmails: sanitizedData.marketingEmails ?? false
      },
      update: sanitizedData,
      select: {
        id: true,
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
        updatedAt: true
      }
    })

    // Determine what changed for security logging
    const changes: Record<string, any> = {}
    if (existingProfile) {
      Object.keys(sanitizedData).forEach(key => {
        const newValue = (sanitizedData as any)[key]
        const oldValue = (existingProfile as any)[key]
        if (newValue !== oldValue) {
          changes[key] = { from: oldValue, to: newValue }
        }
      })
    } else {
      changes.action = "profile_created"
    }

    // Log security event
    await logSecurityEvent({
      userId: currentUser.id,
      action: SecurityAction.PROFILE_UPDATE,
      details: {
        action: existingProfile ? "profile_updated" : "profile_created",
        changes: Object.keys(changes),
        changesDetail: changes
      }
    })

    // Also get updated user data
    const userWithProfile = await prisma.user.findUnique({
      where: { id: currentUser.id },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        updatedAt: true
      }
    })

    const response = {
      user: userWithProfile,
      profile: updatedProfile
    }

    return createSuccessResponse(response, "Profile updated successfully")

  } catch (error) {
    return handleApiError(error)
  }
}