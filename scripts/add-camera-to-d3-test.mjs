const base = 'http://localhost:3000'
const projectId = process.argv[2]

if (!projectId) {
  console.error('Usage: node scripts/add-camera-to-d3-test.mjs <projectId>')
  process.exit(1)
}

const p = await fetch(`${base}/api/projects/${projectId}`).then(r => r.json())
const scene = (p.scenes || [])[0]
if (!scene) {
  console.error('No scene found in project')
  process.exit(2)
}

const body = {
  message: `For scene ${scene.id}, call set_camera_motion only. Add 5 moves: dollyIn top-left, pan top-right, pan bottom-left, pan bottom-right, dollyOut full scene. Keep smooth durations and ease power2.inOut.`,
  agentOverride: 'scene-maker',
  sceneContext: 'all',
  activeTools: ['d3'],
  projectId,
  scenes: p.scenes,
  globalStyle: p.globalStyle,
  projectName: p.name,
  outputMode: p.outputMode,
  sceneGraph: p.sceneGraph,
  selectedSceneId: scene.id,
}

const res = await fetch(`${base}/api/agent`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})
if (!res.ok || !res.body) {
  console.error('Agent call failed', res.status)
  process.exit(3)
}

const rd = res.body.getReader()
const dec = new TextDecoder()
let buf = ''
const deadline = Date.now() + 120000

while (Date.now() < deadline) {
  const { done, value } = await rd.read()
  if (done) break
  buf += dec.decode(value, { stream: true })
  let i = -1
  while ((i = buf.indexOf('\n\n')) !== -1) {
    const chunk = buf.slice(0, i)
    buf = buf.slice(i + 2)
    if (!chunk.startsWith('data: ')) continue
    let ev = null
    try { ev = JSON.parse(chunk.slice(6)) } catch { continue }
    if (ev.type === 'state_change') {
      const latest = await fetch(`${base}/api/projects/${projectId}`).then(r => r.json())
      const s = (latest.scenes || [])[0]
      console.log(JSON.stringify({
        projectId,
        sceneId: s?.id,
        name: s?.name,
        type: s?.sceneType,
        charts: (s?.chartLayers || []).length,
        cam: (s?.cameraMotion || []).length,
      }, null, 2))
      process.exit(0)
    }
  }
}

console.error('Timed out waiting for state_change')
process.exit(4)
