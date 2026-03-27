import { checkCache, saveToCache, downloadToBuffer } from './media-cache'

const FAL_KEY = () => process.env.FAL_KEY

export const BG_REMOVAL_COST = 0.01

export async function removeImageBackground(imageUrl: string): Promise<{ resultUrl: string; cost: number }> {
  // Check cache
  const cacheParams = { imageUrl, operation: 'rmbg' }
  const cached = await checkCache('backgroundRemoval', cacheParams)
  if (cached) {
    return { resultUrl: cached, cost: 0 }
  }

  // If imageUrl is a local path, convert to absolute URL for fal.ai
  const inputUrl = imageUrl.startsWith('/')
    ? `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}${imageUrl}`
    : imageUrl

  const response = await fetch('https://queue.fal.run/fal-ai/bria-rmbg', {
    method: 'POST',
    headers: {
      'Authorization': `Key ${FAL_KEY()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      image_url: inputUrl,
      sync_mode: true,
    }),
  })

  const data = await response.json()
  if (!response.ok) throw new Error(data.detail ?? 'Background removal failed')

  const resultUrl = data.image?.url
  if (!resultUrl) throw new Error('No result from background removal')

  const buffer = await downloadToBuffer(resultUrl)
  const publicPath = await saveToCache('backgroundRemoval', cacheParams, buffer, 'png')

  return { resultUrl: publicPath, cost: BG_REMOVAL_COST }
}
