/** @type {import('next').NextConfig} */
const nextConfig = {
  // Increase body size limit for file uploads
  serverExternalPackages: [],
  turbopack: {
    // Prevent file watcher from thrashing on generated scene files
  },
  async rewrites() {
    return [
      {
        source: '/renders/:path*',
        destination: 'http://localhost:3001/renders/:path*',
      },
    ]
  },
  async headers() {
    return [
      {
        source: '/scenes/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
      {
        source: '/uploads/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
