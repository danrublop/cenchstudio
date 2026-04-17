import { NextRequest, NextResponse } from 'next/server'
import { getOptionalUser } from '@/lib/auth-helpers'
import { getUserWorkspaces, createWorkspace } from '@/lib/db/queries/workspaces'

// GET: list user's workspaces with project counts
export async function GET() {
  try {
    const user = await getOptionalUser()
    const rows = await getUserWorkspaces(user?.id ?? null)
    return NextResponse.json(rows)
  } catch (error: any) {
    console.error('Failed to list workspaces:', error)
    return NextResponse.json({ error: 'Failed to list workspaces' }, { status: 500 })
  }
}

// POST: create a new workspace
export async function POST(req: NextRequest) {
  try {
    const user = await getOptionalUser()
    const body = await req.json()
    const { name, description, color, icon, isDefault } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    const workspace = await createWorkspace({
      userId: user?.id ?? null,
      name: name.trim().slice(0, 255),
      description: description || null,
      color: color || null,
      icon: icon || null,
      isDefault: isDefault ?? false,
    })

    return NextResponse.json(workspace, { status: 201 })
  } catch (error: any) {
    console.error('Failed to create workspace:', error)
    return NextResponse.json({ error: 'Failed to create workspace' }, { status: 500 })
  }
}
