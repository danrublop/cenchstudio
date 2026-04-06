import { NextResponse } from 'next/server'

/**
 * Standardized API response helpers.
 *
 * apiJson: pass-through — returns the object as-is (matches existing API contract)
 * apiError: returns { error: string, details?: unknown }
 */

export function apiJson<T extends Record<string, unknown>>(body: T, status = 200) {
  return NextResponse.json(body, { status })
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

/**
 * Extract a safe error message from an unknown error.
 * Strips API keys, URLs, and stack traces to prevent information leaks.
 */
export function safeErrorMessage(err: unknown, fallback = 'Internal error'): string {
  if (!(err instanceof Error)) return fallback
  let msg = err.message
  // Strip long alphanumeric strings that could be API keys/tokens
  msg = msg.replace(/[a-zA-Z0-9_\-]{20,}/g, '[REDACTED]')
  // Strip URLs that may contain keys in query params
  msg = msg.replace(/https?:\/\/\S+/g, '[URL]')
  // Strip file paths
  msg = msg.replace(/\/[\w./-]{10,}/g, '[PATH]')
  // Cap length
  return msg.slice(0, 200) || fallback
}
