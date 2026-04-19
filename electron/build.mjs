#!/usr/bin/env node
/**
 * esbuild bundler for the Electron main + preload processes.
 *
 * Bundles `electron/main.ts` and `electron/preload.ts` with all their
 * transitive imports into single CJS files under `dist-electron/`. This is
 * what unlocks the Week 2 IPC migration: an IPC handler in
 * `electron/ipc/<category>.ts` can import from `@/lib/db`, `@/lib/agents`,
 * `@/lib/audio/*` etc. and those files ship alongside `main.js` in the
 * packaged app.
 *
 * Rules:
 * - `electron` is always external (provided by the Electron runtime).
 * - Node built-ins (fs, path, etc.) are external.
 * - Everything under `node_modules/**` is external — electron-builder ships
 *   `node_modules/` inside `app.asar` so `require('pg')` still resolves at
 *   runtime. Bundling them would inline megabytes of third-party code for
 *   no gain. Native modules (`pg`) would also break if bundled.
 * - Application code (`electron/**`, `lib/**`, `app/**`) is bundled inline.
 *
 * Usage:
 *   node electron/build.mjs          # one-shot build
 *   node electron/build.mjs --watch  # rebuild on change (for dev)
 */
import { context, build } from 'esbuild'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')
const outDir = path.join(repoRoot, 'dist-electron')

/**
 * Plugin: externalize bare specifiers (node_modules + Node built-ins) but
 * keep `@/...` aliases bundled. The stock `packages: 'external'` option
 * treats anything that doesn't start with `.` or `/` as external, which
 * means `@/lib/db` gets externalized and esbuild tries to read
 * `dist-electron/main.js` as input instead of emitting it.
 */
const externalBareSpecifiers = {
  name: 'externalize-bare-specifiers',
  setup(build) {
    build.onResolve({ filter: /.*/ }, (args) => {
      const p = args.path
      // Relative imports: always bundle
      if (p.startsWith('.') || p.startsWith('/')) return null
      // Path aliases we control: bundle through the `alias` config
      if (p === '@' || p.startsWith('@/')) return null
      // Everything else (bare package names) stays external
      return { path: p, external: true }
    })
  },
}

/** @type {import('esbuild').BuildOptions} */
const sharedConfig = {
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  bundle: true,
  sourcemap: true,
  logLevel: 'info',
  plugins: [externalBareSpecifiers],
  // Resolve `@/x/y` to `<repoRoot>/x/y` (matches the root tsconfig paths).
  alias: {
    '@': repoRoot,
  },
}

async function run() {
  const watch = process.argv.includes('--watch')

  const configs = [
    {
      ...sharedConfig,
      entryPoints: [path.join(repoRoot, 'electron/main.ts')],
      outfile: path.join(outDir, 'main.js'),
    },
    {
      ...sharedConfig,
      entryPoints: [path.join(repoRoot, 'electron/preload.ts')],
      outfile: path.join(outDir, 'preload.js'),
    },
  ]

  if (watch) {
    const ctxs = await Promise.all(configs.map((c) => context(c)))
    await Promise.all(ctxs.map((c) => c.watch()))
    console.log('[electron/build] watching for changes...')
    // Keep the process alive
    await new Promise(() => {})
  } else {
    await Promise.all(configs.map((c) => build(c)))
    console.log('[electron/build] done')
  }
}

run().catch((err) => {
  console.error('[electron/build] failed:', err)
  process.exit(1)
})
