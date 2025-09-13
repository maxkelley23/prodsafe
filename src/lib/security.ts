import { SecurityAction } from "@prisma/client"
import { prisma } from "./db"
import { headers } from "next/headers"

interface SecurityEventData {
  userId?: string
  action: SecurityAction
  details?: Record<string, any>
  ip?: string
  userAgent?: string
  success?: boolean
}

export async function logSecurityEvent({
  userId,
  action,
  details,
  ip,
  userAgent,
  success = true
}: SecurityEventData) {
  try {
    // Get IP and User Agent from headers if not provided
    if (!ip || !userAgent) {
      const headersList = await headers()
      ip = ip || headersList.get("x-forwarded-for") || headersList.get("x-real-ip") || "unknown"
      userAgent = userAgent || headersList.get("user-agent") || "unknown"
    }

    await prisma.securityLog.create({
      data: {
        userId,
        action,
        details: details ? JSON.stringify(details) : null,
        ip,
        userAgent,
        success
      }
    })
  } catch (error) {
    console.error("Failed to log security event:", error)
  }
}

export async function getSecurityLogs(userId: string, limit = 50) {
  try {
    return await prisma.securityLog.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit
    })
  } catch (error) {
    console.error("Failed to fetch security logs:", error)
    return []
  }
}

export async function detectSuspiciousActivity(userId: string): Promise<boolean> {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)

    // Check for multiple failed login attempts
    const failedLogins = await prisma.securityLog.count({
      where: {
        userId,
        action: SecurityAction.LOGIN_FAILED,
        createdAt: { gte: oneHourAgo },
        success: false
      }
    })

    if (failedLogins >= 5) {
      await logSecurityEvent({
        userId,
        action: SecurityAction.SUSPICIOUS_ACTIVITY,
        details: { reason: "multiple_failed_logins", count: failedLogins }
      })
      return true
    }

    // Check for rapid succession of different activities
    const recentActivities = await prisma.securityLog.count({
      where: {
        userId,
        createdAt: { gte: oneHourAgo }
      }
    })

    if (recentActivities >= 50) {
      await logSecurityEvent({
        userId,
        action: SecurityAction.SUSPICIOUS_ACTIVITY,
        details: { reason: "excessive_activity", count: recentActivities }
      })
      return true
    }

    return false
  } catch (error) {
    console.error("Failed to detect suspicious activity:", error)
    return false
  }
}

export function generateSecretKey(): string {
  const crypto = require("crypto")
  return crypto.randomBytes(64).toString("hex")
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function validatePassword(password: string): {
  isValid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (password.length < 12) {
    errors.push("Password must be at least 12 characters long")
  }

  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter")
  }

  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter")
  }

  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number")
  }

  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push("Password must contain at least one special character")
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}