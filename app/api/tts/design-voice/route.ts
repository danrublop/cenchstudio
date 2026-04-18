import { NextRequest, NextResponse } from 'next/server'
import { getOptionalUser } from '@/lib/auth-helpers'
import { designVoice, AudioValidationError } from '@/lib/services/audio'

export async function POST(req: NextRequest) {
  await getOptionalUser()

  try {
    const { description, sampleText } = await req.json()
    const result = await designVoice({ description, sampleText })
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof AudioValidationError) return NextResponse.json({ error: err.message }, { status: 400 })
    const message = err instanceof Error ? err.message : 'Voice design failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
