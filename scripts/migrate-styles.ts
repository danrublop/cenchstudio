/**
 * Migration script: converts old-style GlobalStyle (flat palette/font/theme)
 * to new preset-based GlobalStyle.
 *
 * Run: npx tsx scripts/migrate-styles.ts
 */

import { db } from '../lib/db'
import { projects } from '../lib/db/schema'
import { STYLE_PRESETS, type StylePresetId } from '../lib/styles/presets'
import type { GlobalStyle } from '../lib/types'

// Simple color distance (Euclidean in hex space)
function colorDistance(a: string, b: string): number {
  const parse = (hex: string) => {
    const h = hex.replace('#', '')
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
  }
  try {
    const [r1, g1, b1] = parse(a)
    const [r2, g2, b2] = parse(b)
    return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2)
  } catch {
    return Infinity
  }
}

function findClosestPreset(gs: any): StylePresetId {
  const bgColor = gs.bgColor ?? gs.palette?.[0] ?? '#fffef9'
  const theme = gs.theme ?? 'dark'

  let bestId: StylePresetId = 'whiteboard'
  let bestScore = Infinity

  for (const preset of Object.values(STYLE_PRESETS)) {
    let score = colorDistance(bgColor, preset.bgColor)
    // Bonus for matching theme direction
    const presetIsDark = ['#0a0a0f', '#0f0f13', '#1e3a5f', '#2d4a3e'].includes(preset.bgColor)
    if ((theme === 'dark') !== presetIsDark) score += 200
    if (score < bestScore) {
      bestScore = score
      bestId = preset.id
    }
  }

  return bestId
}

async function migrate() {
  console.log('Migrating projects to preset-based GlobalStyle...')

  const allProjects = await db.select().from(projects)
  let migrated = 0
  let skipped = 0

  for (const project of allProjects) {
    const gs = project.globalStyle as any
    if (!gs) {
      skipped++
      continue
    }

    // Already migrated
    if (gs.presetId) {
      skipped++
      continue
    }

    const presetId = findClosestPreset(gs)
    const preset = STYLE_PRESETS[presetId]

    const newStyle: GlobalStyle = {
      presetId,
      paletteOverride: null,
      bgColorOverride: null,
      fontOverride: null,
      strokeColorOverride: null,
      // Keep legacy fields for safety
      palette: gs.palette,
      strokeWidth: gs.strokeWidth,
      font: gs.font,
      duration: gs.duration,
      theme: gs.theme,
    }

    // If font differs from preset, set as override
    if (gs.font && gs.font !== preset.font) {
      newStyle.fontOverride = gs.font
    }

    await db.update(projects).set({ globalStyle: newStyle }).where(require('drizzle-orm').eq(projects.id, project.id))

    console.log(`  [${project.name}] → ${presetId}`)
    migrated++
  }

  console.log(`Done. Migrated: ${migrated}, Skipped: ${skipped}`)
  process.exit(0)
}

migrate().catch((e) => {
  console.error('Migration failed:', e)
  process.exit(1)
})
