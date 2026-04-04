/**
 * Generate 10 unique Zdog character assets into a project library.
 *
 * Usage:
 *   node scripts/generate-zdog-character-library.mjs <projectId> [count]
 *
 * Example:
 *   node scripts/generate-zdog-character-library.mjs 1ecdacfb-7e40-44f7-9d8b-a91f139acf58 10
 */

const base = process.env.CENCH_BASE_URL || 'http://localhost:3000'
const projectId = process.argv[2]
const count = Math.max(1, Number.parseInt(process.argv[3] || '10', 10) || 10)

if (!projectId) {
  console.error('Missing projectId.')
  console.error('Usage: node scripts/generate-zdog-character-library.mjs <projectId> [count]')
  process.exit(1)
}

function mulberry32(seed) {
  let s = seed | 0
  return function next() {
    s |= 0
    s = (s + 0x6D2B79F5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pick(rng, values) {
  return values[Math.floor(rng() * values.length)]
}

function range(rng, min, max) {
  return min + (max - min) * rng()
}

const PALETTES = [
  { skin: '#f2c8a2', hair: '#5a3c2a', top: '#2563eb', bottom: '#334155', accent: '#e84545' },
  { skin: '#d9a47c', hair: '#1f2937', top: '#7c3aed', bottom: '#0f766e', accent: '#f59e0b' },
  { skin: '#f0b58a', hair: '#7f1d1d', top: '#16a34a', bottom: '#1e293b', accent: '#ec4899' },
]

const FACE_STYLES = ['friendly', 'serious', 'curious']
const HAIR_STYLES = ['short', 'bob', 'bun', 'flat']
const EYE_STYLES = ['dot', 'almond', 'wide']
const MOUTH_STYLES = ['smile', 'neutral', 'grin']
const NOSE_STYLES = ['dot', 'line', 'button']
const ACCESSORIES = ['glasses', 'hat', 'tablet', 'badge']

function createFormula(seed) {
  const rng = mulberry32(seed)
  const accessoryCount = Math.floor(range(rng, 0, 3))
  const accessorySet = new Set()
  for (let i = 0; i < accessoryCount; i += 1) accessorySet.add(pick(rng, ACCESSORIES))

  return {
    seed,
    palette: pick(rng, PALETTES),
    proportions: {
      head: range(rng, 10.5, 13.5),
      torso: range(rng, 8, 11.5),
      upperArm: range(rng, 4, 6.5),
      forearm: range(rng, 3.5, 6),
      upperLeg: range(rng, 6, 8.5),
      lowerLeg: range(rng, 5.5, 8),
    },
    faceStyle: pick(rng, FACE_STYLES),
    hairStyle: pick(rng, HAIR_STYLES),
    eyeStyle: pick(rng, EYE_STYLES),
    mouthStyle: pick(rng, MOUTH_STYLES),
    noseStyle: pick(rng, NOSE_STYLES),
    bodyStyle: {
      torsoWidth: range(rng, 1.8, 3.2),
      armThickness: range(rng, 3.5, 5.4),
      legThickness: range(rng, 4.2, 6.4),
      hipWidth: range(rng, 2.2, 3.4),
    },
    accessories: Array.from(accessorySet),
    motionProfile: {
      idleAmplitude: range(rng, 0.6, 1.2),
      gestureBias: range(rng, 0.5, 1.1),
      walkAmplitude: range(rng, 0.8, 1.3),
    },
  }
}

async function saveAsset(name, formula, tags = []) {
  const res = await fetch(`${base}/api/projects/${projectId}/zdog-library`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, formula, tags }),
  })
  const text = await res.text()
  let data
  try { data = JSON.parse(text) } catch { data = { raw: text } }
  if (!res.ok) {
    throw new Error(`POST /api/projects/${projectId}/zdog-library ${res.status} ${JSON.stringify(data).slice(0, 400)}`)
  }
  return data.asset
}

async function run() {
  const seedBase = Date.now() % 1_000_000_000
  const created = []

  for (let i = 0; i < count; i += 1) {
    const seed = seedBase + i * 9973
    const formula = createFormula(seed)
    const name = `Auto Person ${String(i + 1).padStart(2, '0')}`
    const asset = await saveAsset(name, formula, ['auto-generated', 'script'])
    created.push({ id: asset.id, name: asset.name, seed: formula.seed })
  }

  console.log(JSON.stringify({ projectId, count: created.length, created }, null, 2))
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
