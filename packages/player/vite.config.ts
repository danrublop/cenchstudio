import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'CenchStudioPlayer',
      fileName: 'cench-studio-player',
      formats: ['iife', 'es'],
    },
    outDir: 'dist',
    minify: true,
    rollupOptions: {
      output: {
        exports: 'named',
      },
    },
  },
})
