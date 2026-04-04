import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { projects } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import type { ZdogPersonAsset, ZdogPersonFormula } from '@/lib/types'
import type { ZdogStudioAsset, ZdogStudioShape } from '@/lib/types/zdog-studio'

type ProjectBlob = {
  scenes?: any[]
  sceneGraph?: any
  zdogLibrary?: ZdogPersonAsset[]
  zdogStudioLibrary?: ZdogStudioAsset[]
  [key: string]: any
}

function parseBlob(description: string | null): ProjectBlob {
  if (!description) return {}
  try {
    return JSON.parse(description) as ProjectBlob
  } catch {
    return {}
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params
    const [project] = await db
      .select({ description: projects.description })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1)
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    const blob = parseBlob(project.description)
    return NextResponse.json({
      assets: [
        ...(blob.zdogStudioLibrary || []),
        ...(blob.zdogLibrary || []).map((a: ZdogPersonAsset) => ({ ...a, assetType: 'person' as const })),
      ],
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params
    const body = await req.json()
    const { name, assetType, tags = [] } = body as { name: string; assetType?: string; tags?: string[] }

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    const [existing] = await db
      .select({ description: projects.description, version: projects.version })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1)
    if (!existing) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

    const currentVersion = existing.version ?? 1
    const blob = parseBlob(existing.description)
    const now = new Date().toISOString()

    let updatedBlob: ProjectBlob

    if (assetType === 'studio') {
      // Studio shape-tree asset
      const { shapes } = body as { shapes: ZdogStudioShape[] }
      if (!shapes?.length) {
        return NextResponse.json({ error: 'shapes are required for studio assets' }, { status: 400 })
      }
      const asset: ZdogStudioAsset = {
        id: uuidv4(),
        name: String(name).slice(0, 120),
        shapes,
        tags,
        createdAt: now,
        updatedAt: now,
      }
      updatedBlob = { ...blob, zdogStudioLibrary: [...(blob.zdogStudioLibrary || []), asset] }

      const [updated] = await db
        .update(projects)
        .set({
          description: JSON.stringify(updatedBlob),
          version: currentVersion + 1,
          updatedAt: new Date(),
        })
        .where(and(eq(projects.id, projectId), eq(projects.version, currentVersion)))
        .returning({ id: projects.id })
      if (!updated) {
        return NextResponse.json(
          { error: 'Conflict: project was modified concurrently. Please retry.' },
          { status: 409 },
        )
      }

      return NextResponse.json({ success: true, asset })
    } else {
      // Legacy person formula asset
      const { formula } = body as { formula: ZdogPersonFormula }
      if (!formula) {
        return NextResponse.json({ error: 'formula is required for person assets' }, { status: 400 })
      }
      const asset: ZdogPersonAsset = {
        id: uuidv4(),
        name: String(name).slice(0, 120),
        formula,
        tags,
        createdAt: now,
        updatedAt: now,
      }
      updatedBlob = { ...blob, zdogLibrary: [...(blob.zdogLibrary || []), asset] }

      const [updated] = await db
        .update(projects)
        .set({
          description: JSON.stringify(updatedBlob),
          version: currentVersion + 1,
          updatedAt: new Date(),
        })
        .where(and(eq(projects.id, projectId), eq(projects.version, currentVersion)))
        .returning({ id: projects.id })
      if (!updated) {
        return NextResponse.json(
          { error: 'Conflict: project was modified concurrently. Please retry.' },
          { status: 409 },
        )
      }

      return NextResponse.json({ success: true, asset })
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params
    const body = (await req.json().catch(() => ({}))) as { id?: string }
    const id = typeof body.id === 'string' ? body.id.trim() : ''
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const [existing] = await db
      .select({ description: projects.description, version: projects.version })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1)
    if (!existing) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

    const currentVersion = existing.version ?? 1
    const blob = parseBlob(existing.description)

    // Try removing from studio library first, then person library
    const prevStudio = blob.zdogStudioLibrary || []
    const newStudio = prevStudio.filter((a: ZdogStudioAsset) => a.id !== id)
    const prevPerson = blob.zdogLibrary || []
    const newPerson = prevPerson.filter((a: ZdogPersonAsset) => a.id !== id)

    if (newStudio.length === prevStudio.length && newPerson.length === prevPerson.length) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    }

    const [updated] = await db
      .update(projects)
      .set({
        description: JSON.stringify({ ...blob, zdogLibrary: newPerson, zdogStudioLibrary: newStudio }),
        version: currentVersion + 1,
        updatedAt: new Date(),
      })
      .where(and(eq(projects.id, projectId), eq(projects.version, currentVersion)))
      .returning({ id: projects.id })
    if (!updated) {
      return NextResponse.json({ error: 'Conflict: project was modified concurrently. Please retry.' }, { status: 409 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
