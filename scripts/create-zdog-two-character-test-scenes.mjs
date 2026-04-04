/**
 * Create focused Zdog test scenes:
 * 1) Two characters static
 * 2) Two characters moving
 *
 * Usage:
 *   node scripts/create-zdog-two-character-test-scenes.mjs
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
    prompt: `${name} (2 character test)`,
    generatedCode: generated.result,
    duration,
    bgColor: '#fffef9',
  })
  return scene.scene
}

async function run() {
  const project = await j('POST', '/api/projects', {
    name: `Zdog 2-Character Tests ${new Date().toISOString().slice(0, 16)}`,
    outputMode: 'mp4',
  })

  const peopleBase = [
    {
      id: 'person-left',
      placement: { x: -32, y: 42, z: 0, scale: 21, rotationY: 0.1 },
    },
    {
      id: 'person-right',
      placement: { x: 32, y: 42, z: 0, scale: 21, rotationY: -0.1 },
    },
  ]

  const staticSpec = {
    seed: 77001,
    title: 'Two Characters Static',
    people: peopleBase,
    modules: [],
    beats: [],
  }

  const movingSpec = {
    seed: 77002,
    title: 'Two Characters Moving',
    people: peopleBase,
    modules: [],
    beats: [
      { at: 0.2, action: 'idleBreath', targetPersonId: 'person-left', duration: 9 },
      { at: 0.4, action: 'idleBreath', targetPersonId: 'person-right', duration: 9 },
      // Avoid walkInPlace here; it can visually over-separate hips/legs for some formulas.
      { at: 1.2, action: 'talkNod', targetPersonId: 'person-left', duration: 2.2 },
      { at: 1.5, action: 'talkNod', targetPersonId: 'person-right', duration: 2.2 },
      { at: 4.1, action: 'wave', targetPersonId: 'person-left', duration: 1.8 },
      { at: 4.5, action: 'present', targetPersonId: 'person-right', duration: 2.0 },
      { at: 7.0, action: 'talkNod', targetPersonId: 'person-left', duration: 1.8 },
      { at: 7.3, action: 'wave', targetPersonId: 'person-right', duration: 1.8 },
    ],
  }

  const s1 = await createComposedScene(project.id, 'Zdog Test - Two Characters Static', 10, staticSpec)
  const s2 = await createComposedScene(project.id, 'Zdog Test - Two Characters Moving', 10, movingSpec)

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
