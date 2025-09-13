import { z } from "zod"
import { UserRole, SecurityAction } from "@prisma/client"

// User validation schemas
export const updateUserSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  role: z.nativeEnum(UserRole).optional(),
  isActive: z.boolean().optional()
})

export const userQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
  sort: z.enum(["createdAt", "name", "email", "lastLoginAt"]).default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
  role: z.nativeEnum(UserRole).optional(),
  isActive: z.boolean().optional(),
  search: z.string().optional()
})

// Profile validation schemas
export const updateProfileSchema = z.object({
  bio: z.string().max(500).optional(),
  website: z.string().url().max(255).optional().or(z.literal("")),
  location: z.string().max(100).optional(),
  company: z.string().max(100).optional(),
  githubUsername: z.string().max(50).optional(),
  linkedinUsername: z.string().max(50).optional(),
  twitterUsername: z.string().max(50).optional(),
  timezone: z.string().max(50).optional(),
  language: z.string().max(10).optional(),
  theme: z.enum(["light", "dark", "system"]).optional(),
  emailNotifications: z.boolean().optional(),
  securityAlerts: z.boolean().optional(),
  marketingEmails: z.boolean().optional()
})

// Security log validation schemas
export const createSecurityLogSchema = z.object({
  userId: z.string().optional(),
  action: z.nativeEnum(SecurityAction),
  details: z.record(z.any()).optional(),
  ip: z.string().optional(),
  userAgent: z.string().optional(),
  success: z.boolean().default(true)
})

export const securityLogsQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
  sort: z.enum(["createdAt", "action", "success"]).default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
  userId: z.string().optional(),
  action: z.nativeEnum(SecurityAction).optional(),
  success: z.boolean().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  ip: z.string().optional()
})

// Rate limit validation schemas
export const rateLimitQuerySchema = z.object({
  endpoint: z.string().optional(),
  userId: z.string().optional()
})

export const resetRateLimitSchema = z.object({
  userId: z.string(),
  endpoint: z.string().optional()
})

// Common validation helpers
export function validateId(id: string): boolean {
  // Validate CUID format (starts with 'c' and contains only alphanumeric characters)
  return /^c[a-z0-9]{24}$/i.test(id)
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function sanitizeString(str: string | undefined): string | undefined {
  if (!str) return undefined
  return str.trim().replace(/\s+/g, " ")
}

export function validateAndParseDate(dateString: string | undefined): Date | undefined {
  if (!dateString) return undefined

  const date = new Date(dateString)
  if (isNaN(date.getTime())) {
    throw new Error("Invalid date format")
  }

  return date
}

// Type inference helpers
export type UpdateUserInput = z.infer<typeof updateUserSchema>
export type UserQueryInput = z.infer<typeof userQuerySchema>
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
export type CreateSecurityLogInput = z.infer<typeof createSecurityLogSchema>
export type SecurityLogsQueryInput = z.infer<typeof securityLogsQuerySchema>
export type RateLimitQueryInput = z.infer<typeof rateLimitQuerySchema>
export type ResetRateLimitInput = z.infer<typeof resetRateLimitSchema>