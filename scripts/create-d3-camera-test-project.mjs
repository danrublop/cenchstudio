const BASE = 'http://localhost:3000'

async function createProject() {
  const res = await fetch(`${BASE}/api/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: `D3 Camera Agent Test ${Date.now()}`,
      outputMode: 'mp4',
      scenes: [],
      sceneGraph: { nodes: [], edges: [], startSceneId: '' },
    }),
  })
  if (!res.ok) throw new Error(`createProject failed ${res.status}`)
  return res.json()
}

async function getProject(projectId) {
  const res = await fetch(`${BASE}/api/projects/${projectId}`)
  if (!res.ok) throw new Error(`getProject failed ${res.status}`)
  return res.json()
}

async function runAgentOnce(projectId, message) {
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
    selectedSceneId: null,
  }
  const res = await fetch(`${BASE}/api/agent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok || !res.body) throw new Error(`runAgent failed ${res.status}`)

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  const deadline = Date.now() + 180000

  while (Date.now() < deadline) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let idx = -1
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const chunk = buffer.slice(0, idx)
      buffer = buffer.slice(idx + 2)
      if (!chunk.startsWith('data: ')) continue
      try {
        const ev = JSON.parse(chunk.slice(6))
        if (ev.type === 'error') throw new Error(`agent error: ${JSON.stringify(ev)}`)
        if (ev.type === 'done') return
      } catch (e) {
        if (String(e).startsWith('Error: agent error')) throw e
      }
    }
  }
  throw new Error('runAgent timeout waiting for done')
}

const project = await createProject()
const projectId = project.id

await runAgentOnce(
  projectId,
  'Create exactly one D3 scene named "D3 Quad Chart Camera Test". Add exactly 4 charts in one scene via generate_chart: bar, line, donut, scatter. Keep readable titles/labels and use distinct datasets. Keep scene duration 16 seconds.'
)

let latest = await getProject(projectId)
let scene = (latest.scenes || []).find((s) => s.name === 'D3 Quad Chart Camera Test') || (latest.scenes || [])[0]
if (!scene) throw new Error('No scene created')

if ((scene.cameraMotion || []).length === 0) {
  await runAgentOnce(
    projectId,
    `On scene ${scene.id}, call set_camera_motion and add smooth camera moves to zoom into each chart quadrant sequentially, then zoom back out.`
  )
}

latest = await getProject(projectId)
scene = (latest.scenes || []).find((s) => s.id === scene.id) || scene

console.log(JSON.stringify({
  projectId,
  projectName: latest.name,
  sceneId: scene.id,
  sceneName: scene.name,
  totalScenes: (latest.scenes || []).length,
  sceneType: scene.sceneType,
  chartLayers: (scene.chartLayers || []).length,
  cameraMotion: (scene.cameraMotion || []).length,
}, null, 2))
