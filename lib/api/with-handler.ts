import { NextRequest, NextResponse } from 'next/server'
import { apiError } from './response'
import { logRequest } from './logger'

type RouteHandler = (req: NextRequest) => Promise<NextResponse>

/**
 * Higher-order function that wraps an API route handler with:
 * - Automatic try/catch error handling
 * - Request duration logging
 * - Consistent error response format
 *
 * Usage:
 * ```ts
 * export const POST = withHandler(async (req) => {
 *   const body = await req.json()
 *   // ... your logic
 *   return apiSuccess(result)
 * })
 * ```
 */
export function withHandler(handler: RouteHandler): RouteHandler {
  return async (req: NextRequest) => {
    const start = Date.now()
    const path = req.nextUrl.pathname

    try {
      const response = await handler(req)
      logRequest({
        method: req.method,
        path,
        status: response.status,
        durationMs: Date.now() - start,
      })
      return response
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Internal server error'
      const durationMs = Date.now() - start
      console.error(`[API] ${req.method} ${path} failed (${durationMs}ms):`, err)
      logRequest({
        method: req.method,
        path,
        status: 500,
        durationMs,
        error: message,
      })
      return apiError(message, 500)
    }
  }
}
