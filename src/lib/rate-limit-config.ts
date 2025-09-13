import { UserRole } from "@prisma/client"

export interface RateLimitRule {
  requests: number
  window: string // e.g., "15 m", "1 h", "1 d"
  windowMs: number // window in milliseconds
}

export interface RateLimitConfig {
  identifier: string
  rules: RateLimitRule[]
  blockDuration?: string // How long to block after exceeding limit
  blockDurationMs?: number
}

// Rate limiting configurations for different endpoints and user types
export const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
  // Authentication endpoints - very restrictive
  "auth_login": {
    identifier: "auth:login",
    rules: [
      { requests: 5, window: "15 m", windowMs: 15 * 60 * 1000 }
    ],
    blockDuration: "30 m",
    blockDurationMs: 30 * 60 * 1000
  },

  "auth_register": {
    identifier: "auth:register",
    rules: [
      { requests: 3, window: "1 h", windowMs: 60 * 60 * 1000 }
    ],
    blockDuration: "1 h",
    blockDurationMs: 60 * 60 * 1000
  },

  "auth_password_reset": {
    identifier: "auth:password_reset",
    rules: [
      { requests: 3, window: "1 h", windowMs: 60 * 60 * 1000 }
    ],
    blockDuration: "1 h",
    blockDurationMs: 60 * 60 * 1000
  },

  // API endpoints - role-based limits
  "api_user": {
    identifier: "api:user",
    rules: [
      { requests: 100, window: "1 h", windowMs: 60 * 60 * 1000 }
    ],
    blockDuration: "15 m",
    blockDurationMs: 15 * 60 * 1000
  },

  "api_admin": {
    identifier: "api:admin",
    rules: [
      { requests: 1000, window: "1 h", windowMs: 60 * 60 * 1000 }
    ],
    blockDuration: "5 m",
    blockDurationMs: 5 * 60 * 1000
  },

  "api_security_lead": {
    identifier: "api:security_lead",
    rules: [
      { requests: 2000, window: "1 h", windowMs: 60 * 60 * 1000 }
    ],
    blockDuration: "5 m",
    blockDurationMs: 5 * 60 * 1000
  },

  // Security-sensitive operations
  "security_sensitive": {
    identifier: "security:sensitive",
    rules: [
      { requests: 10, window: "1 h", windowMs: 60 * 60 * 1000 }
    ],
    blockDuration: "1 h",
    blockDurationMs: 60 * 60 * 1000
  },

  // Public endpoints
  "public": {
    identifier: "public",
    rules: [
      { requests: 20, window: "1 m", windowMs: 60 * 1000 }
    ],
    blockDuration: "5 m",
    blockDurationMs: 5 * 60 * 1000
  }
}

// Get rate limit config based on user role and endpoint type
export function getRateLimitConfig(
  endpointType: keyof typeof RATE_LIMIT_CONFIGS,
  userRole?: UserRole | null
): RateLimitConfig {
  // For API endpoints, use role-specific limits
  if (endpointType === "api_user") {
    switch (userRole) {
      case UserRole.SECURITY_LEAD:
        return RATE_LIMIT_CONFIGS.api_security_lead
      case UserRole.ADMIN:
        return RATE_LIMIT_CONFIGS.api_admin
      case UserRole.USER:
      default:
        return RATE_LIMIT_CONFIGS.api_user
    }
  }

  return RATE_LIMIT_CONFIGS[endpointType] || RATE_LIMIT_CONFIGS.public
}

// Additional rate limit configurations for specific operations
export const OPERATION_RATE_LIMITS: Record<string, RateLimitConfig> = {
  "profile_update": {
    identifier: "op:profile_update",
    rules: [
      { requests: 5, window: "1 h", windowMs: 60 * 60 * 1000 }
    ],
    blockDuration: "30 m",
    blockDurationMs: 30 * 60 * 1000
  },

  "password_change": {
    identifier: "op:password_change",
    rules: [
      { requests: 3, window: "24 h", windowMs: 24 * 60 * 60 * 1000 }
    ],
    blockDuration: "1 h",
    blockDurationMs: 60 * 60 * 1000
  },

  "email_change": {
    identifier: "op:email_change",
    rules: [
      { requests: 2, window: "24 h", windowMs: 24 * 60 * 60 * 1000 }
    ],
    blockDuration: "2 h",
    blockDurationMs: 2 * 60 * 60 * 1000
  },

  "mfa_operations": {
    identifier: "op:mfa",
    rules: [
      { requests: 5, window: "1 h", windowMs: 60 * 60 * 1000 }
    ],
    blockDuration: "30 m",
    blockDurationMs: 30 * 60 * 1000
  }
}

// Whitelist for IPs that should bypass rate limiting (use cautiously)
export const RATE_LIMIT_WHITELIST: string[] = [
  // Add trusted IPs here, e.g., internal services
  // "192.168.1.0/24",
  // "10.0.0.0/8"
]

// Emergency bypass token (should be stored in env vars)
export const EMERGENCY_BYPASS_HEADER = "x-emergency-bypass"

// Rate limiting severity levels
export enum RateLimitSeverity {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical"
}

// Map endpoint types to severity levels
export const ENDPOINT_SEVERITY: Record<string, RateLimitSeverity> = {
  "auth_login": RateLimitSeverity.CRITICAL,
  "auth_register": RateLimitSeverity.HIGH,
  "auth_password_reset": RateLimitSeverity.HIGH,
  "security_sensitive": RateLimitSeverity.CRITICAL,
  "api_user": RateLimitSeverity.MEDIUM,
  "api_admin": RateLimitSeverity.LOW,
  "api_security_lead": RateLimitSeverity.LOW,
  "public": RateLimitSeverity.MEDIUM
}