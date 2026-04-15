import { NextRequest, NextResponse } from 'next/server'
import type { SFXProvider } from '@/lib/types'
import { getBestSFXProvider, getSFXProvider } from '@/lib/audio/router'
import { downloadToLocal } from '@/lib/audio/download'
import { getOptionalUser } from '@/lib/auth-helpers'
import { validateQueryLength, sanitizeErrorMessage } from '@/lib/audio/sanitize'
import { getZzfxCategory, SFX_LIBRARY_CATEGORIES } from '@/lib/audio/sfx-zzfx-presets'
import { FREESOUND_LICENSE_NOTE, PIXABAY_SFX_LICENSE_NOTE } from '@/lib/audio/sfx-license'

export async function POST(req: NextRequest) {
  await getOptionalUser()
  const body = await req.json()
  const {
    query,
    provider: requestedProvider,
    limit: rawLimit = 10,
    prompt,
    duration,
    download = false,
    mode = 'search',
    categoryId,
    page: rawPage = 1,
    commercialOnly: rawCommercial,
  } = body
  const limit = Math.min(Math.max(Number(rawLimit) || 10, 1), 50)
  const page = Math.max(1, Number(rawPage) || 1)

  const isLibrary = mode === 'library'

  /** Library browse is 100% client-side (ZzFX). This mode is kept for older clients / agents. */
  if (isLibrary) {
    const cat = getZzfxCategory(categoryId)
    const category = cat
      ? { id: cat.id, label: cat.label }
      : { id: SFX_LIBRARY_CATEGORIES[0]!.id, label: SFX_LIBRARY_CATEGORIES[0]!.label }
    return NextResponse.json({
      results: [],
      provider: 'pixabay' as SFXProvider,
      mode: 'library',
      category,
      page,
      licenseNote:
        'The editor Sound effects library uses ZzFX (MIT) in the browser. Use search mode for remote Pixabay/Freesound when API keys are configured.',
    })
  }

  const searchQuery = query || prompt

  if (!searchQuery) {
    return NextResponse.json({ error: 'query or prompt is required' }, { status: 400 })
  }

  try {
    if (query) validateQueryLength(query)
    if (prompt) validateQueryLength(prompt)
  } catch {
    return NextResponse.json({ error: 'Query or prompt too long' }, { status: 400 })
  }

  let providerId: SFXProvider = requestedProvider ?? getBestSFXProvider()

  try {
    const impl = await getSFXProvider(providerId)

    if (prompt && impl.generate) {
      const result = await impl.generate(prompt, duration)
      return NextResponse.json({ results: [result], provider: providerId, mode: 'generated' })
    }

    const commercialOnly =
      rawCommercial !== undefined ? Boolean(rawCommercial) : providerId === 'freesound' ? true : false

    const searchOpts =
      commercialOnly || page > 1
        ? { page, commercialOnly: providerId === 'freesound' ? commercialOnly : false }
        : undefined

    const results = await impl.search(searchQuery, limit, searchOpts)

    if (download && results.length > 0) {
      const localResults = await Promise.all(
        results.map(async (r) => {
          if (r.audioUrl.startsWith('http')) {
            const localUrl = await downloadToLocal(r.audioUrl, 'sfx')
            return { ...r, audioUrl: localUrl, previewUrl: r.previewUrl || r.audioUrl }
          }
          return r
        }),
      )
      return NextResponse.json({
        results: localResults,
        provider: providerId,
        mode: 'search',
      })
    }

    return NextResponse.json({
      results,
      provider: providerId,
      mode: 'search',
      licenseNote: providerId === 'pixabay' ? PIXABAY_SFX_LICENSE_NOTE : FREESOUND_LICENSE_NOTE,
    })
  } catch (err: unknown) {
    console.error('SFX error:', err)
    return NextResponse.json({ error: sanitizeErrorMessage(err) }, { status: 500 })
  }
}
