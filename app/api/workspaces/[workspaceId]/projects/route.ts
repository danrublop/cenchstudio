import { NextRequest, NextResponse } from 'next/server'
import { assertWorkspaceAccess } from '@/lib/auth-helpers'
import { assignProjectsToWorkspace, removeProjectsFromWorkspace } from '@/lib/db/queries/workspaces'

// POST: assign projects to this workspace
export async function POST(req: NextRequest, { params }: { params: Promise<{ workspaceId: string }> }) {
  try {
    const { workspaceId } = await params
    const { error } = await assertWorkspaceAccess(workspaceId)
    if (error) return error

    const body = await req.json()
    const { projectIds } = body

    if (!Array.isArray(projectIds) || projectIds.length === 0) {
      return NextResponse.json({ error: 'projectIds must be a non-empty array' }, { status: 400 })
    }
    if (projectIds.length > 100) {
      return NextResponse.json({ error: 'Maximum 100 projects per request' }, { status: 400 })
    }

    await assignProjectsToWorkspace(workspaceId, projectIds)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Failed to assign projects:', error)
    return NextResponse.json({ error: 'Failed to assign projects' }, { status: 500 })
  }
}

// DELETE: remove projects from this workspace (unassign)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ workspaceId: string }> }) {
  try {
    const { workspaceId } = await params
    const { error } = await assertWorkspaceAccess(workspaceId)
    if (error) return error

    const body = await req.json()
    const { projectIds } = body

    if (!Array.isArray(projectIds) || projectIds.length === 0) {
      return NextResponse.json({ error: 'projectIds must be a non-empty array' }, { status: 400 })
    }

    await removeProjectsFromWorkspace(projectIds)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Failed to remove projects:', error)
    return NextResponse.json({ error: 'Failed to remove projects' }, { status: 500 })
  }
}
