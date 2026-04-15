import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { projects, projectAssets } from '@/lib/db/schema'
import { eq, and, inArray } from 'drizzle-orm'
import { assertProjectAccess } from '@/lib/auth-helpers'
import type { BrandKit } from '@/lib/types/media'

const DEFAULT_BRAND_KIT: BrandKit = {
  brandName: null,
  logoAssetIds: [],
  palette: [],
  fontPrimary: null,
  fontSecondary: null,
  guidelines: null,
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params
  const access = await assertProjectAccess(projectId)
  if (access.error) return access.error

  try {
    const [project] = await db
      .select({ brandKit: projects.brandKit })
      .from(projects)
      .where(eq(projects.id, projectId))

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    return NextResponse.json({ brandKit: project.brandKit ?? DEFAULT_BRAND_KIT })
  } catch (err) {
    console.error('[brand-kit-get] error:', err)
    return NextResponse.json({ error: 'Failed to get brand kit' }, { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params
  const access = await assertProjectAccess(projectId)
  if (access.error) return access.error

  try {
    const body = await req.json()

    // Fetch current brand kit
    const [project] = await db
      .select({ brandKit: projects.brandKit })
      .from(projects)
      .where(eq(projects.id, projectId))

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const current: BrandKit = (project.brandKit as BrandKit) ?? { ...DEFAULT_BRAND_KIT }
    const updated: BrandKit = { ...current }

    if (typeof body.brandName === 'string' || body.brandName === null) {
      updated.brandName = body.brandName
    }
    if (Array.isArray(body.logoAssetIds)) {
      // Validate that all referenced assets exist and belong to this project
      if (body.logoAssetIds.length > 0) {
        const existing = await db
          .select({ id: projectAssets.id })
          .from(projectAssets)
          .where(
            and(
              eq(projectAssets.projectId, projectId),
              inArray(projectAssets.id, body.logoAssetIds),
            ),
          )
        const existingIds = new Set(existing.map((a) => a.id))
        updated.logoAssetIds = body.logoAssetIds.filter((id: string) => existingIds.has(id))
      } else {
        updated.logoAssetIds = []
      }
    }
    if (Array.isArray(body.palette)) {
      updated.palette = body.palette
        .filter((c: unknown) => typeof c === 'string')
        .slice(0, 8)
    }
    if (typeof body.fontPrimary === 'string' || body.fontPrimary === null) {
      updated.fontPrimary = body.fontPrimary
    }
    if (typeof body.fontSecondary === 'string' || body.fontSecondary === null) {
      updated.fontSecondary = body.fontSecondary
    }
    if (typeof body.guidelines === 'string' || body.guidelines === null) {
      updated.guidelines = body.guidelines
    }

    await db
      .update(projects)
      .set({ brandKit: updated })
      .where(eq(projects.id, projectId))

    return NextResponse.json({ brandKit: updated })
  } catch (err) {
    console.error('[brand-kit-put] error:', err)
    return NextResponse.json({ error: 'Failed to update brand kit' }, { status: 500 })
  }
}
