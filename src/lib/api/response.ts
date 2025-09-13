import { NextResponse } from "next/server"
import { ZodError } from "zod"

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
  meta?: {
    total?: number
    page?: number
    limit?: number
    hasNext?: boolean
    hasPrev?: boolean
  }
}

export interface ApiError {
  message: string
  code?: string
  status: number
  details?: any
}

export function createSuccessResponse<T>(
  data: T,
  message?: string,
  meta?: ApiResponse<T>["meta"]
): NextResponse {
  const response: ApiResponse<T> = {
    success: true,
    data,
    message,
    meta
  }

  return NextResponse.json(response)
}

export function createErrorResponse(
  error: ApiError | string,
  status: number = 500
): NextResponse {
  const errorObj = typeof error === "string"
    ? { message: error, status }
    : { ...error, status: error.status || status }

  const response: ApiResponse = {
    success: false,
    error: errorObj.message,
    message: errorObj.message
  }

  return NextResponse.json(response, { status: errorObj.status })
}

export function handleApiError(error: unknown): NextResponse {
  console.error("API Error:", error)

  if (error instanceof ZodError) {
    return createErrorResponse(
      {
        message: "Validation error",
        code: "VALIDATION_ERROR",
        status: 400,
        details: error.errors
      }
    )
  }

  if (error instanceof Error) {
    if (error.message === "Authentication required") {
      return createErrorResponse(
        {
          message: "Authentication required",
          code: "UNAUTHORIZED",
          status: 401
        }
      )
    }

    if (error.message === "Insufficient permissions") {
      return createErrorResponse(
        {
          message: "Insufficient permissions",
          code: "FORBIDDEN",
          status: 403
        }
      )
    }

    if (error.message === "Account is inactive") {
      return createErrorResponse(
        {
          message: "Account is inactive",
          code: "ACCOUNT_INACTIVE",
          status: 403
        }
      )
    }

    return createErrorResponse(
      {
        message: error.message,
        code: "INTERNAL_ERROR",
        status: 500
      }
    )
  }

  return createErrorResponse(
    {
      message: "Internal server error",
      code: "INTERNAL_ERROR",
      status: 500
    }
  )
}

export function createPaginationMeta(
  total: number,
  page: number,
  limit: number
) {
  const totalPages = Math.ceil(total / limit)

  return {
    total,
    page,
    limit,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1
  }
}

export function parseQueryParams(searchParams: URLSearchParams) {
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "10")))
  const sort = searchParams.get("sort") || "createdAt"
  const order = (searchParams.get("order")?.toLowerCase() === "asc") ? "asc" : "desc"

  return { page, limit, sort, order }
}