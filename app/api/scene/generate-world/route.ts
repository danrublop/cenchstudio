import { NextRequest, NextResponse } from 'next/server'
import { generateSceneHTML } from '@/lib/sceneTemplate'
import { resolveProjectDimensions } from '@/lib/dimensions'
import fs from 'fs/promises'
import path from 'path'

export async function POST(req: NextRequest) {
  try {
    const { scene, aspectRatio, resolution } = await req.json()
    if (!scene?.id || !scene?.worldConfig) {
      return NextResponse.json({ error: 'scene with worldConfig required' }, { status: 400 })
    }

    const html = generateSceneHTML(scene, scene.globalStyle ?? undefined, undefined, undefined, resolveProjectDimensions(aspectRatio, resolution))

    const scenesDir = path.join(process.cwd(), 'public', 'scenes')
    await fs.mkdir(scenesDir, { recursive: true })
    await fs.writeFile(path.join(scenesDir, `${scene.id}.html`), html, 'utf-8')

    return NextResponse.json({ success: true, path: `/scenes/${scene.id}.html` })
  } catch (err: unknown) {
    console.error('[generate-world] Error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Generation failed' }, { status: 500 })
  }
}
