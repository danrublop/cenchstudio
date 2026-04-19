import { NextRequest, NextResponse } from 'next/server'
import { serializeProject } from '@/lib/github/serialize'
import { importBundle } from '@/lib/github/deserialize'
import type { CenchBundle } from '@/lib/github/bundle-types'
import { BUNDLE_FORMAT_VERSION } from '@/lib/github/bundle-types'
import { createLogger } from '@/lib/logger'

const log = createLogger('api.bundle')

/**
 * GET /api/projects/[projectId]/bundle
 *
 * Export project as a CenchBundle JSON file.
 * Returns the full bundle suitable for download or GitHub push.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params
    const bundle = await serializeProject(projectId)

    return new NextResponse(JSON.stringify(bundle, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${sanitizeFilename(bundle.project.name)}.cench.json"`,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Export failed'
    log.error('error', { error: error })

    if (message.includes('not found')) {
      return NextResponse.json({ error: message }, { status: 404 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * POST /api/projects/[projectId]/bundle
 *
 * Import a CenchBundle JSON to create a new project.
 * The projectId in the URL is ignored for import — a new project is always created.
 * (The URL includes projectId for consistency with the resource hierarchy.)
 *
 * Body: CenchBundle JSON
 * Query params:
 *   ?name=Override+Name  — optional project name override
 *
 * Returns: { projectId, projectName, sceneCount, assetCount, warnings }
 */
export async function POST(req: NextRequest, { params: _params }: { params: Promise<{ projectId: string }> }) {
  try {
    const body = await req.json()

    // Basic shape validation
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Request body must be a JSON object' }, { status: 400 })
    }

    if (body.formatVersion !== BUNDLE_FORMAT_VERSION) {
      return NextResponse.json(
        { error: `Unsupported format version: ${body.formatVersion}. Expected: ${BUNDLE_FORMAT_VERSION}` },
        { status: 400 },
      )
    }

    if (!body.project || !Array.isArray(body.scenes) || !body.sceneGraph) {
      return NextResponse.json({ error: 'Invalid bundle: missing project, scenes, or sceneGraph' }, { status: 400 })
    }

    const nameOverride = req.nextUrl.searchParams.get('name') ?? undefined
    const result = await importBundle(body as CenchBundle, nameOverride)

    return NextResponse.json(result, { status: 201 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Import failed'
    log.error('error', { error: error })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

function sanitizeFilename(name: string): string {
  return (
    name
      .replace(/[^a-zA-Z0-9\s\-_]/g, '')
      .replace(/\s+/g, '-')
      .toLowerCase()
      .slice(0, 64) || 'project'
  )
}
