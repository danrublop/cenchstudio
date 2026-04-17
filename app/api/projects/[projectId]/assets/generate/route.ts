import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { projectAssets } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { generateImage } from '@/lib/apis/image-gen'
import { logSpend } from '@/lib/db'
import { assertProjectAccess } from '@/lib/auth-helpers'
import { persistGeneratedAsset } from '@/lib/media/provenance'
import { enrichPrompt } from '@/lib/media/prompt-enhancer'
import type { ImageModel } from '@/lib/types'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// POST /api/projects/:projectId/assets/generate
// Body: { prompt, model?, aspectRatio?, enhanceTags?, referenceAssetId? }
// Always persists the generated image into projectAssets with full provenance and
// returns the saved row, so the Gallery can hydrate optimistically without a
// follow-up fetch.
export async function POST(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  if (!UUID_RE.test(projectId)) {
    return NextResponse.json({ error: 'Invalid projectId format' }, { status: 400 })
  }
  const access = await assertProjectAccess(projectId)
  if (access.error) return access.error

  try {
    const body = await req.json()
    const rawPrompt: string = String(body.prompt ?? '').trim()
    if (!rawPrompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }
    const model: ImageModel = (body.model as ImageModel) ?? 'flux-schnell'
    const aspectRatio: string = body.aspectRatio ?? '1:1'
    const enhanceTags: string[] = Array.isArray(body.enhanceTags) ? body.enhanceTags : []
    const referenceAssetId: string | null = body.referenceAssetId ?? null

    // Resolve reference image (if any) — must belong to the same project.
    let referenceImageUrl: string | null = null
    let referenceAssetIds: string[] | null = null
    if (referenceAssetId) {
      const [ref] = await db
        .select()
        .from(projectAssets)
        .where(and(eq(projectAssets.id, referenceAssetId), eq(projectAssets.projectId, projectId)))
        .limit(1)
      if (!ref) return NextResponse.json({ error: 'Reference asset not found' }, { status: 404 })
      referenceImageUrl = ref.publicUrl
      referenceAssetIds = [ref.id]
    }

    const finalPrompt = enrichPrompt(rawPrompt, enhanceTags, model)

    const result = await generateImage({
      prompt: finalPrompt,
      model,
      aspectRatio,
      style: null,
      referenceImageUrl,
    })

    if (result.cost > 0) {
      await logSpend(projectId, 'imageGen', result.cost, `${model}: ${rawPrompt.slice(0, 100)}`)
    }

    const persisted = await persistGeneratedAsset({
      projectId,
      sourceUrl: result.imageUrl,
      type: 'image',
      width: result.width,
      height: result.height,
      metadata: {
        prompt: finalPrompt,
        provider: 'imageGen',
        model,
        costCents: Math.round((result.cost ?? 0) * 100),
        parentAssetId: null,
        referenceAssetIds,
        enhanceTags: enhanceTags.length ? enhanceTags : null,
      },
    })

    // Return the full row so the client can merge it into projectAssets immediately.
    const [row] = await db.select().from(projectAssets).where(eq(projectAssets.id, persisted.id)).limit(1)

    return NextResponse.json({ asset: row, cost: result.cost, finalPrompt })
  } catch (err: any) {
    console.error('[assets-generate] error:', err)
    return NextResponse.json({ error: err?.message ?? 'Generation failed' }, { status: 500 })
  }
}
