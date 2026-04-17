import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { projectAssets } from '@/lib/db/schema'
import { generateImage } from '@/lib/apis/image-gen'
import { logSpend } from '@/lib/db'
import { assertProjectAccess } from '@/lib/auth-helpers'
import { persistGeneratedAsset } from '@/lib/media/provenance'
import { enrichPrompt } from '@/lib/media/prompt-enhancer'
import type { ImageModel } from '@/lib/types'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// POST /api/projects/:projectId/assets/:assetId/regenerate
// Body (all optional): { promptOverride, model, aspectRatio, enhanceTags }
// Produces a sibling asset with parentAssetId pointing at the original.
export async function POST(req: NextRequest, { params }: { params: Promise<{ projectId: string; assetId: string }> }) {
  const { projectId, assetId } = await params
  if (!UUID_RE.test(projectId)) return NextResponse.json({ error: 'Invalid projectId' }, { status: 400 })

  const access = await assertProjectAccess(projectId)
  if (access.error) return access.error

  const [parent] = await db
    .select()
    .from(projectAssets)
    .where(and(eq(projectAssets.id, assetId), eq(projectAssets.projectId, projectId)))
    .limit(1)

  if (!parent) return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
  if (parent.type !== 'image') {
    return NextResponse.json({ error: 'Only image assets are regenerable' }, { status: 400 })
  }

  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch {
    // allow empty body — caller gets a pure "same-prompt, different seed" regeneration
  }

  const basePrompt = String((body.promptOverride as string | undefined)?.trim() || parent.prompt || parent.name || '')
  if (!basePrompt) return NextResponse.json({ error: 'Parent has no prompt; pass promptOverride' }, { status: 400 })
  const model: ImageModel = (body.model as ImageModel) ?? (parent.model as ImageModel) ?? 'flux-schnell'
  const aspectRatio: string = (body.aspectRatio as string) ?? deriveAspect(parent.width, parent.height) ?? '1:1'
  const enhanceTags: string[] = Array.isArray(body.enhanceTags)
    ? (body.enhanceTags as string[])
    : (parent.enhanceTags ?? [])

  const finalPrompt = enrichPrompt(basePrompt, enhanceTags, model)

  try {
    const result = await generateImage({
      prompt: finalPrompt,
      model,
      aspectRatio,
      style: null,
      skipCache: true,
    })
    if (result.cost > 0) {
      await logSpend(projectId, 'imageGen', result.cost, `regen ${assetId.slice(0, 6)}: ${basePrompt.slice(0, 80)}`)
    }
    const persisted = await persistGeneratedAsset({
      projectId,
      sourceUrl: result.imageUrl,
      type: 'image',
      name: `${parent.name} — retry`,
      width: result.width,
      height: result.height,
      metadata: {
        prompt: finalPrompt,
        provider: 'imageGen',
        model,
        costCents: Math.round((result.cost ?? 0) * 100),
        parentAssetId: parent.id,
        referenceAssetIds: parent.referenceAssetIds ?? null,
        enhanceTags: enhanceTags.length ? enhanceTags : null,
      },
    })
    const [row] = await db.select().from(projectAssets).where(eq(projectAssets.id, persisted.id)).limit(1)
    return NextResponse.json({ asset: row, cost: result.cost, finalPrompt })
  } catch (err: any) {
    console.error('[asset-regenerate] error:', err)
    return NextResponse.json({ error: err?.message ?? 'Regeneration failed' }, { status: 500 })
  }
}

function deriveAspect(w: number | null, h: number | null): string | null {
  if (!w || !h) return null
  const r = w / h
  if (r > 1.5) return '16:9'
  if (r < 0.7) return '9:16'
  if (r > 1.1) return '4:3'
  if (r < 0.9) return '3:4'
  return '1:1'
}
