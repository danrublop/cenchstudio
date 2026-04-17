import { NextResponse } from 'next/server'
import { getAvailableProviders } from '@/lib/audio/router'
import { MEDIA_PROVIDERS, isMediaProviderReady } from '@/lib/media/provider-registry'

export async function GET() {
  const audio = getAvailableProviders()
  const media = MEDIA_PROVIDERS.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    available: isMediaProviderReady(p),
  }))
  return NextResponse.json({ providers: audio, media })
}
