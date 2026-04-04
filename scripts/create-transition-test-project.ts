/**
 * One project, one SVG scene per transition id (handoff to the next scene).
 * Use for MP4 export / xfade QA and Layers tab transition picker.
 *
 * Requires Next app + DB: CENCH_BASE_URL=http://localhost:3000 npx tsx scripts/create-transition-test-project.ts
 */
import { TRANSITION_CATALOG } from '../lib/transitions'

const base = process.env.CENCH_BASE_URL || 'http://localhost:3000'

async function j(method: string, path: string, body?: object) {
  const res = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    data = { raw: text }
  }
  if (!res.ok) {
    throw new Error(`${method} ${path} ${res.status} ${JSON.stringify(data).slice(0, 800)}`)
  }
  return data as Record<string, unknown>
}

function escXml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function slideSvg(index: number, transitionId: string, humanLabel: string) {
  const n = TRANSITION_CATALOG.length
  const hue = (index * 47) % 360
  const bg = `hsl(${hue} 42% 24%)`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="1920" height="1080">
  <rect width="1920" height="1080" fill="${bg}"/>
  <text x="960" y="320" text-anchor="middle" fill="rgba(255,255,255,0.4)" font-size="40" font-family="ui-sans-serif,system-ui,sans-serif">Transition test ${index + 1} / ${n}</text>
  <text x="960" y="520" text-anchor="middle" fill="#ffffff" font-size="88" font-weight="700" font-family="ui-monospace,Menlo,monospace">${escXml(transitionId)}</text>
  <text x="960" y="640" text-anchor="middle" fill="rgba(255,255,255,0.85)" font-size="48" font-family="ui-sans-serif,system-ui,sans-serif">${escXml(humanLabel)}</text>
  <text x="960" y="820" text-anchor="middle" fill="rgba(255,255,255,0.5)" font-size="36" font-family="ui-sans-serif,system-ui,sans-serif">This scene ends with this transition into the next</text>
</svg>`
}

async function run() {
  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ')
  const project = (await j('POST', '/api/projects', {
    name: `Transition test — ${stamp}`,
    outputMode: 'mp4',
  })) as { id: string; name: string }

  const created: { id: string; name: string; transition: string; previewUrl?: string }[] = []

  for (const [i, row] of TRANSITION_CATALOG.entries()) {
    const res = (await j('POST', '/api/scene', {
      projectId: project.id,
      name: `${String(i + 1).padStart(2, '0')} → ${row.id}`,
      type: 'svg',
      prompt: `Transition test slide: ${row.label}`,
      svgContent: slideSvg(i, row.id, row.label),
      duration: 3,
      bgColor: '#121218',
      transition: row.id,
    })) as { scene: { id: string; name: string; previewUrl?: string } }

    created.push({
      id: res.scene.id,
      name: res.scene.name,
      transition: row.id,
      previewUrl: res.scene.previewUrl,
    })
  }

  console.log(
    JSON.stringify(
      {
        open: `${base.replace(/\/$/, '')}/?project=${project.id}`,
        projectId: project.id,
        projectName: project.name,
        sceneCount: created.length,
        scenes: created,
        hint: 'Export MP4 to exercise FFmpeg xfade between each pair of scenes.',
      },
      null,
      2,
    ),
  )
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
