/**
 * Export a small subset of a project's scenes (transition QA).
 *
 * Example:
 *   CENCH_BASE_URL=http://localhost:3000 \
 *   npx tsx scripts/export-transition-subset.ts \
 *     --projectId <uuid> --count 6
 */
import process from 'process'

function arg(name: string, fallback?: string) {
  const idx = process.argv.findIndex((a) => a === `--${name}`)
  if (idx === -1) return fallback
  return process.argv[idx + 1]
}

const base = process.env.CENCH_BASE_URL || 'http://localhost:3000'
const projectId = arg('projectId')
const count = Number(arg('count', '6'))

if (!projectId) {
  console.error('Missing --projectId <uuid>')
  process.exit(1)
}

async function main() {
  const projectRes = await fetch(`${base}/api/projects/${projectId}`)
  if (!projectRes.ok) throw new Error(`Failed to load project ${projectId}: ${projectRes.status}`)
  const project = await projectRes.json()

  const scenesRaw = Array.isArray(project.scenes) ? project.scenes : []
  const scenes = scenesRaw.slice(0, Math.max(2, count)).map((s: any) => ({
    id: s.id,
    duration: s.duration,
    transition: s.transition,
    sceneType: s.sceneType,
    audioLayer: s.audioLayer,
    ...(s.sceneType === '3d_world' && s.worldConfig ? { worldConfig: s.worldConfig } : {}),
  }))

  console.log(`[export-transition-subset] Exporting ${scenes.length} scenes from ${projectId}…`)

  const res = await fetch(`${base}/api/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      scenes,
      outputName: `transition-subset-${projectId}-${Date.now()}`,
      settings: { resolution: '1080p', fps: 30, format: 'mp4' },
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Export failed: ${res.status} ${text.slice(0, 500)}`)
  }

  const reader = res.body?.getReader()
  if (!reader) throw new Error('Export response has no body stream')

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = JSON.parse(line.slice(6))
      const t = data.type
      if (t === 'error') {
        throw new Error(`Render error: ${data.message}`)
      }
      if (t === 'complete') {
        console.log(`[export-transition-subset] Complete: ${data.downloadUrl}`)
        process.exit(0)
      }
      // Keep output light; server logs show the FFmpeg xfade command anyway.
    }
  }

  throw new Error('Export stream ended without a complete event')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
