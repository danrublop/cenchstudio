/** @type {import('next').NextConfig} */
const nextConfig = {
  // Increase body size limit for file uploads
  serverExternalPackages: [],
  async headers() {
    return [
      {
        source: '/scenes/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
