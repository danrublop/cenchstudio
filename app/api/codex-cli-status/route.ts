import { NextResponse } from 'next/server'
import { getCodexCliVersion, isCodexCliAvailable } from '@/lib/agents/codex-cli-provider'

export async function GET() {
  try {
    const available = await isCodexCliAvailable()
    const version = available ? await getCodexCliVersion() : null
    return NextResponse.json({ available, version })
  } catch {
    return NextResponse.json({ available: false, version: null })
  }
}
