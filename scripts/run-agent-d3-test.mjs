const BASE = 'http://localhost:3000'
const projectId = process.argv[2]

if (!projectId) {
  console.error('Usage: node scripts/run-agent-d3-test.mjs <projectId>')
  process.exit(1)
}

const project = await fetch(`${BASE}/api/projects/${projectId}`).then(r => r.json())

const body = {
  message: 'Create a new D3 scene named D3 Quad Chart Camera Test Agent with duration 16s. Add exactly 4 charts in one scene using generate_chart (bar, line, donut, scatter) with distinct datasets and readable labels. Add smooth cameraMotion that zooms each chart quadrant sequentially then zooms out. Keep structured chartLayers and structured cameraMotion.',
  agentOverride: 'scene-maker',
  sceneContext: 'all',
  activeTools: ['d3'],
  projectId,
  scenes: project.scenes || [],
  globalStyle: project.globalStyle,
  projectName: project.name,
  outputMode: project.outputMode,
  sceneGraph: project.sceneGraph || { nodes: [], edges: [], startSceneId: '' },
  selectedSceneId: null,
}

const res = await fetch(`${BASE}/api/agent`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

if (!res.ok || !res.body) {
  console.error('Agent request failed', res.status)
  process.exit(2)
}

const reader = res.body.getReader()
const decoder = new TextDecoder()
let buffer = ''
const deadline = Date.now() + 180000

while (Date.now() < deadline) {
  const { done, value } = await reader.read()
  if (done) break
  buffer += decoder.decode(value, { stream: true })

  let splitIdx = -1
  while ((splitIdx = buffer.indexOf('\n\n')) !== -1) {
    const chunk = buffer.slice(0, splitIdx)
    buffer = buffer.slice(splitIdx + 2)
    if (!chunk.startsWith('data: ')) continue
    const raw = chunk.slice(6)
    let event
    try {
      event = JSON.parse(raw)
    } catch {
      continue
    }
    if (event.type === 'error') {
      console.error('Agent error event', event)
      process.exit(3)
    }
    if (event.type === 'done') {
      const latest = await fetch(`${BASE}/api/projects/${projectId}`).then(r => r.json())
      const target = [...(latest.scenes || [])].reverse().find(s => s.name === 'D3 Quad Chart Camera Test Agent')
      if (!target) {
        console.error('Scene not found after done')
        process.exit(4)
      }
      console.log(JSON.stringify({
        projectId,
        sceneId: target.id,
        name: target.name,
        sceneType: target.sceneType,
        duration: target.duration,
        chartLayers: (target.chartLayers || []).length,
        cameraMotion: (target.cameraMotion || []).length,
      }, null, 2))
      process.exit(0)
    }
  }
}

console.error('Timed out waiting for done event')
process.exit(5)
