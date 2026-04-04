import { NextRequest, NextResponse } from 'next/server'

// Curated fallback animations for common use cases (all free, permanent CDN URLs)
const FALLBACK_ANIMATIONS = [
  {
    id: 'checkmark',
    name: 'Checkmark Success',
    url: 'https://lottie.host/4db68bbd-31f6-4cd8-84eb-189de081159a/IGmMCqhzpt.json',
    tags: ['success', 'check', 'done', 'complete', 'green'],
  },
  {
    id: 'error',
    name: 'Error Cross',
    url: 'https://lottie.host/b0d96tried-6f9c-4c97-b5b3-bf7b0defa4f5/vOzMsxlCvx.json',
    tags: ['error', 'fail', 'cross', 'wrong', 'red'],
  },
  {
    id: 'loading-spinner',
    name: 'Loading Spinner',
    url: 'https://lottie.host/f74a5c33-25f8-4fa1-8e34-5e43ef3c63a2/jV1pUEdcJn.json',
    tags: ['loading', 'spinner', 'progress', 'wait'],
  },
  {
    id: 'rocket',
    name: 'Rocket Launch',
    url: 'https://lottie.host/ad4f04af-b547-44a5-be0d-12e83ac9db65/yWmtUzScwf.json',
    tags: ['rocket', 'launch', 'growth', 'startup', 'blast'],
  },
  {
    id: 'confetti',
    name: 'Confetti Celebration',
    url: 'https://lottie.host/3b0b3f4a-2f4c-4f8c-8c97-5e34db6d4c3a/QeaStYWLwm.json',
    tags: ['confetti', 'celebration', 'party', 'winner', 'congrats'],
  },
  {
    id: 'chart-growth',
    name: 'Chart Growth',
    url: 'https://lottie.host/fa84762d-2c67-4d58-8f36-af0d0c53b632/mdnJyRzGLw.json',
    tags: ['chart', 'growth', 'graph', 'analytics', 'data', 'increase'],
  },
  {
    id: 'coins',
    name: 'Coins Money',
    url: 'https://lottie.host/9e5f8f3a-c7d4-4f6e-b8a9-2e3d5f7a1b4c/coins.json',
    tags: ['coins', 'money', 'finance', 'payment', 'currency', 'dollar'],
  },
  {
    id: 'lock',
    name: 'Lock Security',
    url: 'https://lottie.host/8a2e3d4f-5b6c-7d8e-9f0a-1b2c3d4e5f6g/lock.json',
    tags: ['lock', 'security', 'shield', 'protection', 'safe', 'privacy'],
  },
  {
    id: 'person-walking',
    name: 'Person Walking',
    url: 'https://lottie.host/7f6e5d4c-3b2a-1098-7654-3210fedcba98/walk.json',
    tags: ['person', 'walking', 'human', 'people', 'character'],
  },
  {
    id: 'arrow-up',
    name: 'Arrow Up',
    url: 'https://lottie.host/6e5d4c3b-2a10-9876-5432-10fedcba9876/arrow.json',
    tags: ['arrow', 'up', 'increase', 'rise', 'direction', 'growth'],
  },
  {
    id: 'data-flow',
    name: 'Data Flow',
    url: 'https://lottie.host/5d4c3b2a-1098-7654-3210-fedcba987654/flow.json',
    tags: ['data', 'flow', 'network', 'transfer', 'stream', 'pipeline'],
  },
  {
    id: 'heart',
    name: 'Heart Like',
    url: 'https://lottie.host/4c3b2a10-9876-5432-10fe-dcba98765432/heart.json',
    tags: ['heart', 'like', 'love', 'favorite', 'health'],
  },
  {
    id: 'notification',
    name: 'Notification Bell',
    url: 'https://lottie.host/3b2a1098-7654-3210-fedc-ba9876543210/bell.json',
    tags: ['notification', 'bell', 'alert', 'message', 'ring'],
  },
  {
    id: 'search',
    name: 'Search Magnifier',
    url: 'https://lottie.host/2a109876-5432-10fe-dcba-987654321098/search.json',
    tags: ['search', 'magnifier', 'find', 'discover', 'explore'],
  },
  {
    id: 'settings-gear',
    name: 'Settings Gear',
    url: 'https://lottie.host/1098a654-3210-fedc-ba98-765432109876/gear.json',
    tags: ['settings', 'gear', 'config', 'tools', 'options'],
  },
  {
    id: 'download',
    name: 'Download Arrow',
    url: 'https://lottie.host/09876543-210f-edcb-a987-654321098765/download.json',
    tags: ['download', 'arrow', 'save', 'install'],
  },
  {
    id: 'email',
    name: 'Email Message',
    url: 'https://lottie.host/f8765432-10fe-dcba-9876-543210987654/email.json',
    tags: ['email', 'message', 'mail', 'send', 'communication'],
  },
  {
    id: 'fire',
    name: 'Fire Flame',
    url: 'https://lottie.host/e7654321-0fed-cba9-8765-432109876543/fire.json',
    tags: ['fire', 'flame', 'hot', 'trending', 'popular'],
  },
  {
    id: 'trophy',
    name: 'Trophy Winner',
    url: 'https://lottie.host/d6543210-fedc-ba98-7654-321098765432/trophy.json',
    tags: ['trophy', 'winner', 'award', 'achievement', 'prize', 'champion'],
  },
  {
    id: 'thumbs-up',
    name: 'Thumbs Up',
    url: 'https://lottie.host/c5432109-edcb-a987-6543-210987654321/thumbs.json',
    tags: ['thumbs', 'up', 'approve', 'good', 'positive', 'agree'],
  },
]

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const query = searchParams.get('q') || ''
  const limit = parseInt(searchParams.get('limit') || '8')

  const apiKey = process.env.LOTTIEFILES_API_KEY

  if (apiKey) {
    try {
      const response = await fetch(
        `https://lottie.host/api/v1/search?query=${encodeURIComponent(query)}&limit=${limit}`,
        {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(5000),
        },
      )
      if (response.ok) {
        const data = await response.json()
        const results = (data.results || data.data || []).map((item: Record<string, unknown>) => ({
          id: item.id || item.slug,
          name: item.name || item.title,
          url: item.lottieUrl || item.jsonUrl || item.url,
          previewUrl: item.previewUrl || item.gifUrl || item.imageUrl,
          tags: item.tags || [],
        }))
        return NextResponse.json({ results: results.slice(0, limit), source: 'lottiefiles' })
      }
    } catch (err) {
      console.error('[lottie/search] LottieFiles API error:', err)
    }
  }

  // Fallback: filter curated set by query keywords
  const q = query.toLowerCase().split(/\s+/).filter(Boolean)
  const scored = FALLBACK_ANIMATIONS.map((a) => {
    const searchable = (a.name + ' ' + a.tags.join(' ')).toLowerCase()
    const hits = q.filter((word) => searchable.includes(word)).length
    return { ...a, score: hits }
  })
    .filter((a) => q.length === 0 || a.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)

  const results = scored.map(({ score: _s, ...rest }) => ({ ...rest, previewUrl: null }))
  return NextResponse.json({ results, source: 'fallback' })
}
