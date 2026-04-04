import { NextResponse } from 'next/server'

/**
 * Standardized API response helpers.
 * Success: { data: T }
 * Error: { error: string, details?: unknown }
 */

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status })
}

export function apiError(message: string, status = 500, details?: unknown) {
  return NextResponse.json({ error: message, ...(details !== undefined && { details }) }, { status })
}

export function apiValidationError(message: string, details?: unknown) {
  return apiError(message, 400, details)
}

export function apiNotFound(message = 'Not found') {
  return apiError(message, 404)
}
