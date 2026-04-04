/**
 * Deterministic no-LLM Zdog demo scene builder.
 *
 * Usage:
 *   node scripts/create-zdog-person-demo.mjs
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

const composedSpec = {
  seed: 24041,
  title: 'Reusable Person Demo',
  people: [
    {
      id: 'presenter-1',
      placement: { x: -18, y: 42, z: 4, scale: 21, rotationY: 0.25 },
      formula: {
        accessories: ['glasses', 'tablet'],
      },
    },
  ],
  modules: [
    { id: 'board-1', type: 'presentationBoard', x: 20, y: -4, z: -3, scale: 1.1 },
    { id: 'chart-1', type: 'barChart', x: 20, y: 7, z: -1, scale: 0.95, data: [3, 5, 4, 7], color: '#2563eb' },
    { id: 'desk-1', type: 'desk', x: -4, y: 16, z: -8, scale: 0.8 },
  ],
  beats: [
    { at: 0.2, action: 'idleBreath', targetPersonId: 'presenter-1', duration: 11.5 },
    { at: 1.6, action: 'present', targetPersonId: 'presenter-1', duration: 1.2 },
    { at: 4.2, action: 'pointRight', targetPersonId: 'presenter-1', duration: 1.2 },
    { at: 7.0, action: 'wave', targetPersonId: 'presenter-1', duration: 1.1 },
    { at: 8.8, action: 'talkNod', targetPersonId: 'presenter-1', duration: 2.2 },
  ],
}

async function run() {
  const project = await j('POST', '/api/projects', {
    name: `Zdog Person Asset MVP ${new Date().toISOString().slice(0, 16)}`,
    outputMode: 'mp4',
  })

  const generated = await j('POST', '/api/generate-zdog', {
    mode: 'composed',
    duration: 12,
    composedSpec,
  })

  const scene = await j('POST', '/api/scene', {
    projectId: project.id,
    name: 'Reusable Person Story Demo',
    type: 'zdog',
    prompt: 'Deterministic composed scene with reusable person and modules',
    generatedCode: generated.result,
    duration: 12,
    bgColor: '#fffef9',
  })

  console.log(JSON.stringify({
    projectId: project.id,
    projectName: project.name,
    sceneId: scene.scene?.id,
    previewUrl: scene.scene?.previewUrl,
    usage: generated.usage,
    mode: generated.mode,
  }, null, 2))
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
