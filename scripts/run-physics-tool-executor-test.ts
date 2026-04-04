import { executeTool, type WorldStateMutable } from '../lib/agents/tool-executor'

const BASE = 'http://localhost:3000'

type Scenario = {
  key: string
  name: string
  simulation:
    | 'pendulum'
    | 'double_pendulum'
    | 'projectile'
    | 'orbital'
    | 'wave_interference'
    | 'double_slit'
    | 'electric_field'
    | 'harmonic_oscillator'
  layout: 'split' | 'fullscreen' | 'equation_focus'
  duration: number
  prompt: string
  title: string
  narration: string
  params?: Record<string, unknown>
  equations?: string[]
  highlight?: { time: number; label: string; annotation?: string }
  paramChanges?: Array<{ at_time: number; param: string; from: number; to: number; transition_duration?: number }>
}

const SCENARIOS: Scenario[] = [
  {
    key: 'gravity',
    name: 'Physics Test - Gravity Intuition',
    simulation: 'pendulum',
    layout: 'split',
    duration: 10,
    prompt: 'Show gravity restoring force in a pendulum.',
    title: 'Gravity as a Restoring Force',
    narration: 'Gravity pulls the bob toward equilibrium, converting potential energy into kinetic energy.',
    params: { g: 9.81, length: 1.5, angle: 0.7, damping: 0.02 },
    equations: ['pendulum_ode'],
    highlight: { time: 2.2, label: 'Maximum speed', annotation: 'At the lowest point' },
  },
  {
    key: 'orbits',
    name: 'Physics Test - Orbital Mechanics',
    simulation: 'orbital',
    layout: 'fullscreen',
    duration: 12,
    prompt: 'Explain elliptical orbital motion with varying speed.',
    title: 'Orbital Motion and Gravity',
    narration: 'Orbital speed increases near periapsis and decreases near apoapsis.',
    params: { G: 1.0, m1: 12, m2: 1, eccentricity: 0.45, semiMajorAxis: 280 },
    equations: ['newton_gravity'],
    highlight: { time: 3.0, label: 'Periapsis', annotation: 'Highest orbital velocity' },
  },
  {
    key: 'projectile',
    name: 'Physics Test - Projectile Intuition',
    simulation: 'projectile',
    layout: 'split',
    duration: 10,
    prompt: 'Show horizontal + vertical motion composing a parabola.',
    title: 'Projectile Motion Intuition',
    narration: 'Horizontal velocity stays steady while gravity accelerates downward.',
    params: { v0: 60, angle: 52, g: 9.81, drag: 0.02 },
    equations: ['projectile_range'],
    highlight: { time: 2.6, label: 'Apex', annotation: 'Vertical velocity is zero momentarily' },
  },
  {
    key: 'diffusion',
    name: 'Physics Test - Diffusion Pattern',
    simulation: 'wave_interference',
    layout: 'fullscreen',
    duration: 10,
    prompt: 'Approximate diffusion-like spreading from multiple sources.',
    title: 'Diffusion-Like Spreading',
    narration: 'Local oscillations spread influence over time, resembling diffusion fronts.',
    params: { frequency: 1.2, wavelength: 0.7, source_separation: 180, phase_diff: 0.25 },
    equations: ['wave_equation'],
  },
  {
    key: 'particle-dynamics',
    name: 'Physics Test - Particle Dynamics',
    simulation: 'harmonic_oscillator',
    layout: 'equation_focus',
    duration: 11,
    prompt: 'Show oscillator dynamics and damping over time.',
    title: 'Particle Dynamics in an Oscillator',
    narration: 'Damping removes energy, shrinking amplitude while frequency remains characteristic.',
    params: { mass: 1.2, k: 5.5, damping: 0.18, x0: 180, driving_frequency: 0.0, driving_amplitude: 0.0 },
    equations: ['harmonic_oscillator_ode'],
  },
  {
    key: 'systems-cause-effect',
    name: 'Physics Test - Systems Cause Effect',
    simulation: 'double_pendulum',
    layout: 'split',
    duration: 12,
    prompt: 'Show sensitive dependence and cause/effect over time.',
    title: 'Cause and Effect in Chaotic Systems',
    narration: 'Tiny initial differences can produce diverging outcomes in coupled systems.',
    params: { g: 9.81, L1: 1.3, L2: 1.0, m1: 1.2, m2: 1.0, theta1: 1.2, theta2: 1.15 },
    equations: ['double_pendulum_lagrangian'],
    paramChanges: [
      { at_time: 4.0, param: 'damping', from: 0.01, to: 0.12, transition_duration: 1.5 },
      { at_time: 7.0, param: 'g', from: 9.81, to: 7.0, transition_duration: 1.2 },
    ],
  },
]

async function createProject() {
  const res = await fetch(`${BASE}/api/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: `Physics Tool Executor Test ${Date.now()}`,
      outputMode: 'mp4',
      scenes: [],
      sceneGraph: { nodes: [], edges: [], startSceneId: '' },
    }),
  })
  if (!res.ok) throw new Error(`create project failed ${res.status}`)
  return res.json()
}

async function getProject(projectId: string) {
  const res = await fetch(`${BASE}/api/projects/${projectId}`)
  if (!res.ok) throw new Error(`get project failed ${res.status}`)
  return res.json()
}

async function patchProject(projectId: string, payload: Record<string, unknown>) {
  const res = await fetch(`${BASE}/api/projects/${projectId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`patch project failed ${res.status}: ${text}`)
  }
  return res.json()
}

async function main() {
  const project = await createProject()
  const projectId: string = project.id
  const loaded = await getProject(projectId)

  const world: WorldStateMutable = {
    scenes: loaded.scenes || [],
    globalStyle: loaded.globalStyle,
    projectName: loaded.name,
    projectId,
    outputMode: loaded.outputMode,
    sceneGraph: loaded.sceneGraph || { nodes: [], edges: [], startSceneId: '' },
    activeTools: ['physics'],
  }

  const results: Array<Record<string, unknown>> = []

  for (const scenario of SCENARIOS) {
    const created = await executeTool(
      'create_scene',
      {
        name: scenario.name,
        prompt: scenario.prompt,
        duration: scenario.duration,
        bgColor: '#0f1116',
      },
      world,
    )
    if (!created.success) {
      throw new Error(`create_scene failed for ${scenario.key}: ${created.error || 'unknown error'}`)
    }

    const scene = world.scenes.find((s) => s.name === scenario.name)
    if (!scene) throw new Error(`Scene missing after create_scene: ${scenario.name}`)

    const generated = await executeTool(
      'generate_physics_scene',
      {
        sceneId: scene.id,
        simulation: scenario.simulation,
        params: scenario.params || {},
        layout: scenario.layout,
        equations: scenario.equations || [],
        narration_text: scenario.narration,
        highlight_moment: scenario.highlight,
        title: scenario.title,
      },
      world,
    )
    if (!generated.success) {
      throw new Error(`generate_physics_scene failed for ${scenario.key}: ${generated.error || 'unknown error'}`)
    }

    if (scenario.paramChanges && scenario.paramChanges.length > 0) {
      const changed = await executeTool(
        'set_simulation_params',
        {
          sceneId: scene.id,
          changes: scenario.paramChanges,
        },
        world,
      )
      if (!changed.success) {
        throw new Error(`set_simulation_params failed for ${scenario.key}: ${changed.error || 'unknown error'}`)
      }
    }

    const updated = world.scenes.find((s) => s.id === scene.id)
    results.push({
      key: scenario.key,
      sceneId: scene.id,
      name: scenario.name,
      sceneType: updated?.sceneType,
      duration: updated?.duration,
      hasSceneHTML: Boolean(updated?.sceneHTML),
      hasSceneCode: Boolean(updated?.sceneCode),
      includesPhysicsCanvas: Boolean(updated?.sceneHTML?.includes('physics-canvas-')),
      simulation: scenario.simulation,
      layout: scenario.layout,
    })
  }

  await patchProject(projectId, {
    scenes: world.scenes,
    sceneGraph: world.sceneGraph,
    globalStyle: world.globalStyle,
  })

  const verify = await getProject(projectId)
  console.log(
    JSON.stringify(
      {
        mode: 'tool-executor-offline',
        projectId,
        projectName: verify.name,
        totalScenes: (verify.scenes || []).length,
        allPhysics: (verify.scenes || []).every((s: any) => s.sceneType === 'physics'),
        results,
      },
      null,
      2,
    ),
  )
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
