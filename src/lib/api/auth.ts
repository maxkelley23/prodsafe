import { auth } from "@/lib/auth"
import { UserRole } from "@prisma/client"
import { NextRequest } from "next/server"

export interface AuthenticatedUser {
  id: string
  email: string
  name?: string | null
  role: UserRole
  isActive: boolean
}

export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  const session = await auth()

  if (!session?.user) {
    return null
  }

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role,
    isActive: session.user.isActive
  }
}

export function requireAuth() {
  return async (): Promise<AuthenticatedUser> => {
    const user = await getAuthenticatedUser()
    if (!user) {
      throw new Error("Authentication required")
    }
    if (!user.isActive) {
      throw new Error("Account is inactive")
    }
    return user
  }
}

export function requireRole(roles: UserRole | UserRole[]) {
  const allowedRoles = Array.isArray(roles) ? roles : [roles]

  return async (): Promise<AuthenticatedUser> => {
    const user = await requireAuth()()
    if (!allowedRoles.includes(user.role)) {
      throw new Error("Insufficient permissions")
    }
    return user
  }
}

export function requireAdmin() {
  return requireRole([UserRole.ADMIN, UserRole.SECURITY_LEAD])
}

export function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for")
  const realIP = request.headers.get("x-real-ip")
  const remoteAddr = request.headers.get("x-vercel-forwarded-for")

  if (forwarded) {
    return forwarded.split(",")[0].trim()
  }
  if (realIP) {
    return realIP
  }
  if (remoteAddr) {
    return remoteAddr
  }

  return "unknown"
}

export function getUserAgent(request: NextRequest): string {
  return request.headers.get("user-agent") || "unknown"
}