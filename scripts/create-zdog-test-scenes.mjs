/**
 * Create Zdog test scenes:
 * 1) Grid of different people
 * 2) Moving people + grid of all module objects
 *
 * Usage:
 *   node scripts/create-zdog-test-scenes.mjs
 */

const base = process.env.CENCH_BASE_URL || 'http://localhost:3000'

async function j(method, path, body) {
  const res = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let data
  try { data = JSON.parse(text) } catch { data = { raw: text } }
  if (!res.ok) throw new Error(`${method} ${path} ${res.status} ${JSON.stringify(data).slice(0, 500)}`)
  return data
}

function buildPeopleGrid(count = 12) {
  const cols = 4
  const colGap = 44
  const rowGap = 46
  const startX = -66
  const startY = -34
  const people = []
  for (let i = 0; i < count; i += 1) {
    const c = i % cols
    const r = Math.floor(i / cols)
    people.push({
      id: `person-${i + 1}`,
      placement: {
        x: startX + c * colGap,
        y: startY + r * rowGap,
        z: (i % 2 === 0 ? -1.2 : 1.2),
        // Calibrated to match modal preview proportions (zoom difference + full-body framing)
        scale: 0.56,
        rotationY: 0.14 * (i % 3 - 1),
      },
    })
  }
  return people
}

function buildAllObjectsGrid() {
  return [
    { id: 'obj-bar', type: 'barChart', x: -64, y: -38, z: -10, scale: 0.72, data: [2, 5, 3, 6], color: '#3b82f6' },
    { id: 'obj-line', type: 'lineChart', x: -22, y: -38, z: -10, scale: 0.72, data: [3, 4, 2, 6, 5], color: '#14b8a6' },
    { id: 'obj-donut', type: 'donutChart', x: 20, y: -38, z: -10, scale: 0.72, color: '#f59e0b' },
    { id: 'obj-board', type: 'presentationBoard', x: 62, y: -38, z: -10, scale: 0.56 },
    { id: 'obj-desk', type: 'desk', x: -40, y: 10, z: -10, scale: 0.62 },
    { id: 'obj-tablet', type: 'tablet', x: 30, y: 10, z: -10, scale: 0.76 },
  ]
}

async function createComposedScene(projectId, name, duration, spec) {
  const generated = await j('POST', '/api/generate-zdog', {
    mode: 'composed',
    duration,
    composedSpec: spec,
  })
  const scene = await j('POST', '/api/scene', {
    projectId,
    name,
    type: 'zdog',
    prompt: `${name} (deterministic test scene)`,
    generatedCode: generated.result,
    duration,
    bgColor: '#fffef9',
  })
  return scene.scene
}

async function run() {
  const project = await j('POST', '/api/projects', {
    name: `Zdog Test Scenes ${new Date().toISOString().slice(0, 16)}`,
    outputMode: 'mp4',
  })

  const scene1Spec = {
    seed: 44001,
    title: 'People Grid Test',
    people: buildPeopleGrid(12),
    modules: [],
    beats: [],
  }

  const scene2People = buildPeopleGrid(6)
  const scene2Beats = scene2People.flatMap((p, i) => ([
    { at: 0.2 + i * 0.25, action: 'idleBreath', targetPersonId: p.id, duration: 9.5 },
    { at: 1.2 + i * 0.22, action: i % 2 === 0 ? 'walkInPlace' : 'talkNod', targetPersonId: p.id, duration: 2.2 },
  ]))
  const scene2Spec = {
    seed: 55119,
    title: 'Moving People + Objects Grid',
    people: scene2People,
    modules: buildAllObjectsGrid(),
    beats: scene2Beats,
  }

  const s1 = await createComposedScene(project.id, 'Zdog Test 1 - People Grid', 10, scene1Spec)
  const s2 = await createComposedScene(project.id, 'Zdog Test 2 - Movement + Objects Grid', 12, scene2Spec)

  console.log(JSON.stringify({
    projectId: project.id,
    projectName: project.name,
    scenes: [
      { id: s1.id, name: s1.name, previewUrl: s1.previewUrl },
      { id: s2.id, name: s2.name, previewUrl: s2.previewUrl },
    ],
  }, null, 2))
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
