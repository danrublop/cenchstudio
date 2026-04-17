import { NextRequest, NextResponse } from 'next/server'
import { db, logSpend } from '@/lib/db'
import { projects as projectsTable } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { restoreFace, upscaleImage } from '@/lib/apis/enhancement'
import {
  API_COST_ESTIMATES,
  API_DISPLAY_NAMES,
  checkPermission,
  createDefaultAPIPermissions,
  estimateApiCostUsd,
} from '@/lib/permissions'
import type { APIPermissions } from '@/lib/types'

async function loadApiPermissions(projectId: string): Promise<APIPermissions | null> {
  const row = await db.query.projects.findFirst({
    where: eq(projectsTable.id, projectId),
    columns: { apiPermissions: true },
  })
  if (!row) return null
  const defaults = createDefaultAPIPermissions()
  const stored = (row.apiPermissions as Partial<APIPermissions> | null) ?? {}
  return { ...defaults, ...stored } as APIPermissions
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { projectId, imageUrl, kind, scale, fidelity } = body

    if (!imageUrl || typeof imageUrl !== 'string') {
      return NextResponse.json({ error: 'imageUrl is required' }, { status: 400 })
    }
    if (kind !== 'upscale' && kind !== 'face-restore') {
      return NextResponse.json({ error: 'kind must be "upscale" or "face-restore"' }, { status: 400 })
    }
    if (!process.env.FAL_KEY) {
      return NextResponse.json({ error: 'FAL_KEY not configured' }, { status: 503 })
    }

    // Permission gate — same pattern as /api/generate-video. Projects in
    // `always_deny` for imageEnhance are blocked; `always_allow` over the
    // single-call threshold triggers an approval prompt.
    const api = 'imageEnhance' as const
    if (projectId) {
      const permissions = await loadApiPermissions(projectId)
      if (permissions) {
        const estimatedCostUsd = estimateApiCostUsd(api)
        const permission = checkPermission(
          permissions,
          api,
          API_COST_ESTIMATES[api] ?? 'unknown',
          `Image enhance (${kind})`,
          { prompt: imageUrl },
          new Map(),
          { estimatedCostUsd },
        )
        if (permission.action === 'deny') {
          return NextResponse.json({ error: permission.reason }, { status: 403 })
        }
        if (permission.action === 'ask') {
          return NextResponse.json(
            {
              error: `Permission required for ${API_DISPLAY_NAMES[api]}`,
              permissionNeeded: {
                api,
                estimatedCost: API_COST_ESTIMATES[api] ?? 'unknown',
                estimatedCostUsd,
                costThresholdExceeded: permission.request.costThresholdExceeded,
                reason: permission.request.reason,
                details: { prompt: imageUrl },
              },
            },
            { status: 403 },
          )
        }
      }
    }

    if (kind === 'upscale') {
      const parsedScale = (scale === 4 ? 4 : 2) as 2 | 4
      const { resultUrl, cost } = await upscaleImage(imageUrl, parsedScale)
      if (projectId && cost > 0) {
        await logSpend(projectId, api, cost, `Upscale x${parsedScale}: ${imageUrl.slice(0, 100)}`)
      }
      return NextResponse.json({ resultUrl, cost, kind })
    }

    const parsedFidelity = typeof fidelity === 'number' ? fidelity : 0.5
    const { resultUrl, cost } = await restoreFace(imageUrl, parsedFidelity)
    if (projectId && cost > 0) {
      await logSpend(projectId, api, cost, `Face restore: ${imageUrl.slice(0, 100)}`)
    }
    return NextResponse.json({ resultUrl, cost, kind })
  } catch (error: any) {
    console.error('Enhance image error:', error)
    return NextResponse.json({ error: error?.message ?? 'Enhancement failed' }, { status: 500 })
  }
}
