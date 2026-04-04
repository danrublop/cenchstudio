/**
 * Structured API request logger.
 * JSON in production, formatted in development.
 */

interface RequestLog {
  method: string
  path: string
  status: number
  durationMs: number
  error?: string
}

const isDev = process.env.NODE_ENV !== 'production'

export function logRequest(log: RequestLog) {
  if (isDev) {
    const tag = log.status >= 400 ? '!' : '>'
    const err = log.error ? ` error="${log.error}"` : ''
    console.log(`[API ${tag}] ${log.method} ${log.path} ${log.status} (${log.durationMs}ms)${err}`)
  } else {
    console.log(JSON.stringify({ type: 'api_request', ...log, timestamp: new Date().toISOString() }))
  }
}
