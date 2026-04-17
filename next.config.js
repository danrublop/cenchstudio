/** @type {import('next').NextConfig} */
const nextConfig = {
  // Increase body size limit for file uploads
  serverExternalPackages: [],
  turbopack: {
    // Prevent file watcher from thrashing on generated scene files
  },
  async rewrites() {
    const renderServer = process.env.NEXT_PUBLIC_RENDER_SERVER_URL || 'http://localhost:3001'
    return [
      {
        source: '/renders/:path*',
        destination: `${renderServer}/renders/:path*`,
      },
    ]
  },
  async headers() {
    const securityHeaders = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    ]
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      {
        source: '/scenes/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'self'" },
        ],
      },
      {
        source: '/uploads/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
