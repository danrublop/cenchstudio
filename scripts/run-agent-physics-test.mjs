const BASE = 'http://localhost:3000'

const SCENARIOS = [
  {
    key: 'gravity',
    name: 'Physics Test - Gravity Intuition',
    simulation: 'pendulum',
    layout: 'split',
    duration: 10,
    message:
      'Create exactly one new scene named "Physics Test - Gravity Intuition". Use a physics simulation scene with pendulum motion and explain gravity pulling mass toward equilibrium. Include one key equation and an intuitive narration.',
  },
  {
    key: 'orbits',
    name: 'Physics Test - Orbital Mechanics',
    simulation: 'orbital',
    layout: 'fullscreen',
    duration: 12,
    message:
      'Create exactly one new scene named "Physics Test - Orbital Mechanics". Use an orbital simulation to show elliptical orbit behavior, periapsis and apoapsis intuition, and add one concise equation reference.',
  },
  {
    key: 'projectile',
    name: 'Physics Test - Projectile Intuition',
    simulation: 'projectile',
    layout: 'split',
    duration: 10,
    message:
      'Create exactly one new scene named "Physics Test - Projectile Intuition". Use a projectile simulation with adjustable launch angle intuition and explain why horizontal and vertical motion combine into a parabola.',
  },
  {
    key: 'diffusion',
    name: 'Physics Test - Diffusion Pattern',
    simulation: 'wave_interference',
    layout: 'fullscreen',
    duration: 10,
    message:
      'Create exactly one new scene named "Physics Test - Diffusion Pattern". Approximate diffusion-like spreading using wave interference simulation and explain spread over time from source regions.',
  },
  {
    key: 'particle-dynamics',
    name: 'Physics Test - Particle Dynamics',
    simulation: 'harmonic_oscillator',
    layout: 'equation_focus',
    duration: 11,
    message:
      'Create exactly one new scene named "Physics Test - Particle Dynamics". Use harmonic oscillator simulation to show particle-like oscillatory dynamics, damping effects, and energy transfer intuition.',
  },
  {
    key: 'systems-cause-effect',
    name: 'Physics Test - Systems Cause Effect',
    simulation: 'double_pendulum',
    layout: 'split',
    duration: 12,
    message:
      'Create exactly one new scene named "Physics Test - Systems Cause Effect". Use a double pendulum simulation to demonstrate cause/effect over time and sensitive dependence from small initial changes.',
  },
]

async function createProject() {
  const res = await fetch(`${BASE}/api/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: `Physics Agent Test ${Date.now()}`,
      outputMode: 'mp4',
      scenes: [],
      sceneGraph: { nodes: [], edges: [], startSceneId: '' },
    }),
  })
  if (!res.ok) throw new Error(`create project failed ${res.status}`)
  return res.json()
}

async function getProject(projectId) {
  const res = await fetch(`${BASE}/api/projects/${projectId}`)
  if (!res.ok) throw new Error(`get project failed ${res.status}`)
  return res.json()
}

async function runAgentUntilDone(projectId, message, selectedSceneId = null) {
  const p = await getProject(projectId)
  const body = {
    message,
    agentOverride: 'scene-maker',
    sceneContext: 'all',
    activeTools: ['physics'],
    projectId,
    scenes: p.scenes || [],
    globalStyle: p.globalStyle,
    projectName: p.name,
    outputMode: p.outputMode,
    sceneGraph: p.sceneGraph || { nodes: [], edges: [], startSceneId: '' },
    selectedSceneId,
  }

  const res = await fetch(`${BASE}/api/agent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok || !res.body) throw new Error(`agent call failed ${res.status}`)

  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let buf = ''
  const deadline = Date.now() + 240000

  while (Date.now() < deadline) {
    const { done, value } = await reader.read()
    if (done) return
    buf += dec.decode(value, { stream: true })

    let idx = -1
    while ((idx = buf.indexOf('\n\n')) !== -1) {
      const chunk = buf.slice(0, idx)
      buf = buf.slice(idx + 2)
      if (!chunk.startsWith('data: ')) continue
      const raw = chunk.slice(6)
      let ev
      try {
        ev = JSON.parse(raw)
      } catch {
        continue
      }
      if (ev.type === 'error') throw new Error(`agent error: ${JSON.stringify(ev)}`)
      if (ev.type === 'done') return
    }
  }

  throw new Error('agent timed out waiting for done')
}

async function main() {
  const project = await createProject()
  const projectId = project.id

  const results = []

  for (const scenario of SCENARIOS) {
    await runAgentUntilDone(projectId, `${scenario.message} Set duration to ${scenario.duration}s.`)
    const latest = await getProject(projectId)
    const scene = (latest.scenes || []).find((s) => s.name === scenario.name)
    if (!scene) throw new Error(`Scene not found after run: ${scenario.name}`)

    results.push({
      key: scenario.key,
      sceneId: scene.id,
      name: scene.name,
      sceneType: scene.sceneType,
      duration: scene.duration,
      hasSceneCode: Boolean(scene.sceneCode && scene.sceneCode.length > 0),
      hasSceneHTML: Boolean(scene.sceneHTML && scene.sceneHTML.length > 0),
      hasPhysicsCanvas: typeof scene.sceneHTML === 'string' && scene.sceneHTML.includes('physics-canvas-'),
      expectedSimulation: scenario.simulation,
      expectedLayout: scenario.layout,
    })
  }

  const finalProject = await getProject(projectId)

  console.log(
    JSON.stringify(
      {
        projectId,
        projectName: finalProject.name,
        totalScenes: (finalProject.scenes || []).length,
        results,
      },
      null,
      2
    )
  )
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
