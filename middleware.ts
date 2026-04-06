import { NextResponse, type NextRequest } from 'next/server'
import NextAuth from 'next-auth'
import { authConfig } from './lib/auth-edge'

// Routes that never require authentication
const publicPatterns = [
  /^\/api\/auth(\/|$)/, // Auth.js endpoints
  /^\/v\//, // Published project viewer
  /^\/login(\/|$)/, // Login page
  /^\/scenes\//, // Static scene HTML files
  /^\/uploads\//, // Uploaded assets
  /^\/renders\//, // Rendered outputs
  /^\/_next\//, // Next.js internals
  /^\/favicon\.ico$/, // Favicon
]

function isPublicRoute(pathname: string): boolean {
  return publicPatterns.some((pattern) => pattern.test(pathname))
}

// Create auth instance once at module level, not per-request
const { auth } = NextAuth(authConfig)

const protectedMiddleware = auth((req) => {
  if (isPublicRoute(req.nextUrl.pathname)) {
    return NextResponse.next()
  }

  if (!req.auth) {
    if (req.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const loginUrl = new URL('/login', req.nextUrl.origin)
    loginUrl.searchParams.set('callbackUrl', req.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
})

export default function middleware(req: NextRequest) {
  // Guest mode: skip all auth checks (default behavior)
  if (process.env.ALLOW_GUEST_MODE === 'true') {
    return NextResponse.next()
  }

  return protectedMiddleware(req, {} as any)
}

export const config = {
  matcher: [
    // Match all routes except static files and Next.js internals
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
