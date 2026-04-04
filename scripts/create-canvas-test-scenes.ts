/**
 * Create 22 Canvas2D test scenes (scrub-friendly).
 * Usage: npx tsx scripts/create-canvas-test-scenes.ts
 */
import { buildCanvasAnimationCode, CANVAS_MOTION_TEMPLATES } from '../lib/templates/canvas-animation-templates'

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
  if (!res.ok) throw new Error(`${method} ${path} ${res.status} ${JSON.stringify(data).slice(0, 500)}`)
  return data as any
}

async function run() {
  const project = await j('POST', '/api/projects', {
    name: `Canvas 22 Test Scenes ${new Date().toISOString().slice(0, 16)}`,
    outputMode: 'mp4',
  })

  const created: { id: string; name: string; previewUrl?: string }[] = []
  for (const [idx, t] of CANVAS_MOTION_TEMPLATES.entries()) {
    const res = await j('POST', '/api/scene', {
      projectId: project.id,
      name: `Canvas Test ${String(idx + 1).padStart(2, '0')} - ${t.name}`,
      type: 'canvas2d',
      prompt: `${t.name} built-in template test`,
      generatedCode: buildCanvasAnimationCode(t.id),
      duration: 8 + (idx % 3),
      bgColor: t.suggestedBgColor,
    })
    created.push({ id: res.scene.id, name: res.scene.name, previewUrl: res.scene.previewUrl })
  }

  console.log(
    JSON.stringify(
      {
        projectId: project.id,
        projectName: project.name,
        sceneCount: created.length,
        scenes: created,
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
