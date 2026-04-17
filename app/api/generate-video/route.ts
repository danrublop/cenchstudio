import { NextRequest, NextResponse } from 'next/server'
import { saveToCache } from '@/lib/apis/media-cache'
import { logSpend } from '@/lib/db'
import { firstConfiguredVideoProvider, getVideoProvider } from '@/lib/apis/video/registry'
import { db } from '@/lib/db'
import { projects as projectsTable } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import {
  API_COST_ESTIMATES,
  API_DISPLAY_NAMES,
  checkPermission,
  createDefaultAPIPermissions,
  estimateApiCostUsd,
} from '@/lib/permissions'
import type { APIName, APIPermissions } from '@/lib/types'
import { reserveSpend } from '@/lib/agents/budget-tracker'

function requireProvider(id: string | undefined | null) {
  if (!id || id === 'auto') {
    const p = firstConfiguredVideoProvider()
    if (!p) {
      return { error: 'No video provider configured. Add GOOGLE_AI_KEY, FAL_KEY, or RUNWAY_API_KEY.', provider: null }
    }
    return { error: null, provider: p }
  }
  const p = getVideoProvider(id)
  if (!p) return { error: `Unknown video provider: ${id}`, provider: null }
  if (!process.env[p.envKey]) {
    return {
      error: `${p.name} not configured — set ${p.envKey} or pick a different provider.`,
      provider: null,
    }
  }
  return { error: null, provider: p }
}

/** Load the project's apiPermissions, backfilling any missing API keys with
 *  defaults. Protects against DB rows written before new APIs (kling, runway)
 *  were added to the schema. */
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

function providerToApiName(providerId: string): APIName | null {
  if (providerId === 'veo3' || providerId === 'kling' || providerId === 'runway') return providerId
  return null
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      projectId,
      sceneId,
      layerId,
      provider: providerId,
      prompt,
      negativePrompt,
      aspectRatio = '16:9',
      duration = 5,
      seed,
    } = body

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    const { error, provider } = requireProvider(providerId)
    if (error || !provider) {
      return NextResponse.json({ error: error ?? 'Provider not available' }, { status: 503 })
    }

    // Enforce the cost approval gate when the call is associated with a project.
    // Calls without a projectId (dev / testing) bypass the gate. The gate blocks
    // when the user's project settings would deny, or when the estimated single-
    // call cost exceeds their threshold.
    const api = providerToApiName(provider.id)
    if (projectId && api) {
      const permissions = await loadApiPermissions(projectId)
      if (permissions) {
        const durationSeconds = Number(duration) || 5
        const estimatedCostUsd = estimateApiCostUsd(api, { duration: durationSeconds })
        const permission = checkPermission(
          permissions,
          api,
          API_COST_ESTIMATES[api] ?? 'unknown',
          `Generate ${provider.name} video`,
          { prompt, duration: durationSeconds, resolution: String(aspectRatio) },
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
                details: { prompt, duration: durationSeconds, resolution: String(aspectRatio) },
              },
            },
            { status: 403 },
          )
        }
      }
    }

    // Reserve the estimated cost in the in-memory budget tracker so the
    // committed-spend query sees this call while it's in flight. The GET
    // handler will reconcile with the actual cost via logSpend on completion.
    let reservationId: string | null = null
    if (projectId && api) {
      const estimated = estimateApiCostUsd(api, { duration: Number(duration) || 5 })
      if (estimated > 0) {
        reservationId = reserveSpend(projectId, api, estimated).id
      }
    }

    const { operationId, enhancedPrompt } = await provider.generate({
      prompt,
      negativePrompt,
      aspectRatio,
      durationSeconds: Number(duration) || 5,
      seed,
    })

    return NextResponse.json({
      operationName: operationId,
      enhancedPrompt: enhancedPrompt ?? prompt,
      estimatedCost: provider.costPerCallUsd,
      provider: provider.id,
      reservationId,
      projectId,
      sceneId,
      layerId,
    })
  } catch (error: any) {
    console.error('Video generation error:', error)
    return NextResponse.json({ error: error?.message ?? 'Video generation failed' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const operationName = req.nextUrl.searchParams.get('operationName')
  const projectId = req.nextUrl.searchParams.get('projectId')
  const prompt = req.nextUrl.searchParams.get('prompt')
  const providerId = req.nextUrl.searchParams.get('provider')
  const reservationId = req.nextUrl.searchParams.get('reservationId')
  if (!operationName) {
    return NextResponse.json({ error: 'operationName is required' }, { status: 400 })
  }

  const { error, provider } = requireProvider(providerId)
  if (error || !provider) {
    return NextResponse.json({ error: error ?? 'Provider not available' }, { status: 503 })
  }

  try {
    const result = await provider.pollStatus(operationName)

    if (result.done && result.videoUri) {
      const buffer = await provider.download(result.videoUri)
      const publicPath = await saveToCache(provider.id, { operationName }, buffer, 'mp4')

      if (projectId) {
        const api = providerToApiName(provider.id)
        await logSpend(
          projectId,
          api ?? provider.id,
          provider.costPerCallUsd,
          `${provider.name}: ${(prompt || '').slice(0, 100)}`,
          reservationId ?? undefined,
        )
      }

      return NextResponse.json({
        done: true,
        videoUrl: publicPath,
        provider: provider.id,
      })
    }

    if (result.done && result.error) {
      return NextResponse.json({ done: true, error: result.error, provider: provider.id })
    }

    return NextResponse.json({ done: false, provider: provider.id })
  } catch (error: any) {
    console.error(`${provider.name} status poll error:`, error)
    return NextResponse.json({ error: error?.message ?? 'Failed to check status' }, { status: 500 })
  }
}
