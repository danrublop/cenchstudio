import { NextRequest, NextResponse } from 'next/server'
import { getOptionalUser } from '@/lib/auth-helpers'
import { searchSFX, AudioValidationError } from '@/lib/services/audio'
import { sanitizeErrorMessage } from '@/lib/audio/sanitize'

export async function POST(req: NextRequest) {
  await getOptionalUser()
  const body = await req.json()
  try {
    const result = await searchSFX(body)
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof AudioValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    console.error('SFX error:', err)
    return NextResponse.json({ error: sanitizeErrorMessage(err) }, { status: 500 })
  }
}
