import { NextRequest, NextResponse } from 'next/server'
import { assertWorkspaceAccess } from '@/lib/auth-helpers'
import { getWorkspace, updateWorkspace, deleteWorkspace } from '@/lib/db/queries/workspaces'

// GET: workspace details
export async function GET(_req: NextRequest, { params }: { params: Promise<{ workspaceId: string }> }) {
  try {
    const { workspaceId } = await params
    const { error, workspace } = await assertWorkspaceAccess(workspaceId)
    if (error || !workspace) return error!

    return NextResponse.json(workspace)
  } catch (error: any) {
    console.error('Failed to get workspace:', error)
    return NextResponse.json({ error: 'Failed to get workspace' }, { status: 500 })
  }
}

// PATCH: update workspace
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ workspaceId: string }> }) {
  try {
    const { workspaceId } = await params
    const { error } = await assertWorkspaceAccess(workspaceId)
    if (error) return error

    const body = await req.json()
    const { name, description, color, icon, brandKit, globalStyle, settings, isDefault } = body

    const updates: Record<string, any> = {}
    if (name !== undefined) updates.name = String(name).trim().slice(0, 255)
    if (description !== undefined) updates.description = description
    if (color !== undefined) updates.color = color
    if (icon !== undefined) updates.icon = icon
    if (brandKit !== undefined) updates.brandKit = brandKit
    if (globalStyle !== undefined) updates.globalStyle = globalStyle
    if (settings !== undefined) updates.settings = settings
    if (isDefault !== undefined) updates.isDefault = isDefault

    const workspace = await updateWorkspace(workspaceId, updates)
    return NextResponse.json(workspace)
  } catch (error: any) {
    console.error('Failed to update workspace:', error)
    return NextResponse.json({ error: 'Failed to update workspace' }, { status: 500 })
  }
}

// DELETE: delete workspace (projects become unassigned)
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ workspaceId: string }> }) {
  try {
    const { workspaceId } = await params
    const { error } = await assertWorkspaceAccess(workspaceId)
    if (error) return error

    await deleteWorkspace(workspaceId)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Failed to delete workspace:', error)
    return NextResponse.json({ error: 'Failed to delete workspace' }, { status: 500 })
  }
}
