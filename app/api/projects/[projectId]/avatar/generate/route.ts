import { NextRequest, NextResponse } from 'next/server'
import { assertProjectAccess } from '@/lib/auth-helpers'
import { generateAvatar, AvatarValidationError } from '@/lib/services/avatar'

export async function POST(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const access = await assertProjectAccess(projectId)
  if (access.error) return access.error

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  try {
    const result = await generateAvatar(projectId, {
      text: body.text as string,
      sceneId: (body.sceneId as string | null | undefined) ?? null,
      avatarConfigId: (body.avatarConfigId as string | null | undefined) ?? null,
      audioUrl: (body.audioUrl as string | null | undefined) ?? null,
      sourceImageUrl: (body.sourceImageUrl as string | null | undefined) ?? null,
    })
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof AvatarValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    return NextResponse.json({ error: (err as Error)?.message ?? 'Avatar generation failed' }, { status: 500 })
  }
}
