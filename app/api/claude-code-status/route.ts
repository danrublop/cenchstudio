import { NextResponse } from 'next/server'
import { isClaudeCodeAvailable, getClaudeCodeVersion } from '@/lib/agents/claude-code-provider'

export async function GET() {
  try {
    const available = await isClaudeCodeAvailable()
    const version = available ? await getClaudeCodeVersion() : null
    return NextResponse.json({ available, version })
  } catch {
    return NextResponse.json({ available: false, version: null })
  }
}
