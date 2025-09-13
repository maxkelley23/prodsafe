import { SecurityAction } from "@prisma/client"
import { logSecurityEvent } from "./security"

interface AuthLogDetails {
  provider?: string
  error?: string
  reason?: string
  userAgent?: string
  ip?: string
  redirectUrl?: string
}

export async function logAuthEvent({
  userId,
  action,
  details,
  success = true,
}: {
  userId?: string
  action: SecurityAction
  details?: AuthLogDetails
  success?: boolean
}) {
  try {
    await logSecurityEvent({
      userId,
      action,
      details: details ? {
        ...details,
        timestamp: new Date().toISOString(),
        source: "auth_pages"
      } : undefined,
      success,
    })
  } catch (error) {
    console.error("Failed to log auth event:", error)
  }
}

export async function logSignInAttempt(provider: string, success: boolean, userId?: string, error?: string) {
  await logAuthEvent({
    userId,
    action: success ? SecurityAction.LOGIN_SUCCESS : SecurityAction.LOGIN_FAILED,
    details: {
      provider,
      ...(error && { error, reason: error })
    },
    success,
  })
}

export async function logSignOutAttempt(userId: string) {
  await logAuthEvent({
    userId,
    action: SecurityAction.LOGOUT,
    details: { source: "manual_signout" },
    success: true,
  })
}

export async function logAuthError(error: string, details?: AuthLogDetails) {
  await logAuthEvent({
    action: SecurityAction.LOGIN_FAILED,
    details: {
      error,
      reason: "auth_error_page_visited",
      ...details
    },
    success: false,
  })
}