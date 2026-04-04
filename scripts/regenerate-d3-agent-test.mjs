const BASE = 'http://localhost:3000'

async function createProject() {
  const res = await fetch(`${BASE}/api/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: `D3 Quad Camera Agent Test ${Date.now()}`,
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
    activeTools: ['d3'],
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
      try { ev = JSON.parse(raw) } catch { continue }
      if (ev.type === 'error') throw new Error(`agent error: ${JSON.stringify(ev)}`)
      if (ev.type === 'done') return
    }
  }
  throw new Error('agent timed out waiting for done')
}

const project = await createProject()
const projectId = project.id

await runAgentUntilDone(
  projectId,
  'Create exactly one scene named D3 Quad Chart Camera Test. Scene type must be d3, duration 16s. Use generate_chart exactly 4 times (bar, line, donut, scatter) with distinct datasets and readable labels.'
)

let afterFirst = await getProject(projectId)
const scene = (afterFirst.scenes || []).find((s) => s.name === 'D3 Quad Chart Camera Test') || (afterFirst.scenes || [])[0]
if (!scene) throw new Error('scene not created')

await runAgentUntilDone(
  projectId,
  `For scene ${scene.id}, call set_camera_motion and add 5 smooth moves to zoom top-left, top-right, bottom-left, bottom-right, then zoom out full scene.`,
  scene.id
)

const finalProject = await getProject(projectId)
const finalScene = (finalProject.scenes || []).find((s) => s.id === scene.id) || scene

console.log(JSON.stringify({
  projectId,
  projectName: finalProject.name,
  sceneId: finalScene.id,
  sceneName: finalScene.name,
  totalScenes: (finalProject.scenes || []).length,
  sceneType: finalScene.sceneType,
  chartLayers: (finalScene.chartLayers || []).length,
  cameraMotion: (finalScene.cameraMotion || []).length,
  chartLayouts: (finalScene.chartLayers || []).map((c) => c.layout),
}, null, 2))
