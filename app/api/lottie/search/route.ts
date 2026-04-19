import { NextRequest, NextResponse } from 'next/server'
import { searchLottie, type AnimCategory } from '@/lib/services/lottie'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const result = await searchLottie({
    query: searchParams.get('q') ?? '',
    category: searchParams.get('category') as AnimCategory | null,
    limit: parseInt(searchParams.get('limit') || '8'),
  })
  return NextResponse.json(result)
}
