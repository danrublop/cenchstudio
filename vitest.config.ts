import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/*.test.{ts,tsx}'],
    exclude: ['node_modules', '.next', 'render-server', 'website*', 'lego-sandbox'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      // Next ships 'server-only' as a build-time import guard; stub it for vitest.
      'server-only': path.resolve(__dirname, 'lib/test-stubs/server-only.ts'),
    },
  },
})
