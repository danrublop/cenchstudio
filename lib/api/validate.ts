import type { NextResponse } from 'next/server'
import type { z } from 'zod'
import { apiValidationError } from './response'

type ValidationSuccess<T> = { success: true; data: T }
type ValidationFailure = { success: false; error: NextResponse }

/**
 * Validate a request body against a Zod schema.
 *
 * Usage:
 * ```ts
 * const result = validateBody(mySchema, body)
 * if (!result.success) return result.error
 * const { data } = result
 * ```
 */
export function validateBody<T>(schema: z.ZodType<T>, body: unknown): ValidationSuccess<T> | ValidationFailure {
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors
    return {
      success: false,
      error: apiValidationError('Invalid request body', fieldErrors),
    }
  }
  return { success: true, data: parsed.data }
}
