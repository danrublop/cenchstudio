import type { PhysicsLayer, PhysicsSimulationType, Scene } from '@/lib/types'

const CLASS_TO_SIM: Record<string, PhysicsSimulationType> = {
  PendulumSim: 'pendulum',
  DoublePendulumSim: 'double_pendulum',
  ProjectileSim: 'projectile',
  OrbitalSim: 'orbital',
  WaveInterferenceSim: 'wave_interference',
  DoubleSlitSim: 'double_slit',
  ElectricFieldSim: 'electric_field',
  HarmonicOscillatorSim: 'harmonic_oscillator',
}

function safeParseObject(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {}
  return {}
}

function stripTags(input: string): string {
  return (input || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractFirst(code: string, regex: RegExp): string {
  const m = code.match(regex)
  return m?.[1] ? stripTags(m[1]) : ''
}

export function derivePhysicsLayersFromScene(scene: Scene): PhysicsLayer[] {
  if (scene.sceneType !== 'physics') return scene.physicsLayers ?? []
  if ((scene.physicsLayers?.length ?? 0) > 0) return scene.physicsLayers ?? []

  const sceneCode = scene.sceneCode || ''
  const sceneHTML = scene.sceneHTML || ''
  if (!sceneCode && !sceneHTML) return []

  const ctorMatch = sceneCode.match(/new\s+PhysicsSims\.(\w+)\s*\(\s*canvas\s*,\s*([\s\S]*?)\s*\)\s*;/)
  const simClass = ctorMatch?.[1] ?? ''
  const simulation = CLASS_TO_SIM[simClass] ?? 'pendulum'
  const params = ctorMatch?.[2] ? safeParseObject(ctorMatch[2]) : {}

  const layout: PhysicsLayer['layout'] = sceneHTML.includes('physics-layout-equation')
    ? 'equation_focus'
    : sceneHTML.includes('physics-layout-fullscreen')
      ? 'fullscreen'
      : 'split'

  const equationMatches = [...sceneHTML.matchAll(/id="eq-([^"]+)"/g)]
  const equations = equationMatches.map((m) => String(m[1]).trim()).filter(Boolean)

  const title = extractFirst(sceneHTML, /class="scene-title"[^>]*>([\s\S]*?)<\/div>/)
  const narration = extractFirst(sceneHTML, /class="narration-text"[^>]*>([\s\S]*?)<\/div>/)
  const name = title || `${simulation} simulation`

  return [
    {
      id: 'legacy-physics-1',
      name,
      simulation,
      layout,
      params,
      equations,
      title,
      narration,
    },
  ]
}
