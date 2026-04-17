import { describe, it, expect } from 'vitest'
import { createPendingCapture, resolvePendingCapture, rejectPendingCapture } from './pending-captures'

describe('pending-captures', () => {
  it('resolves with the posted image', async () => {
    const { captureId, promise } = createPendingCapture(2000)
    const ok = resolvePendingCapture(captureId, 'data:image/png;base64,AAA', 'image/png')
    expect(ok).toBe(true)
    const img = await promise
    expect(img.dataUri).toBe('data:image/png;base64,AAA')
    expect(img.mimeType).toBe('image/png')
  })

  it('rejects when explicitly cancelled', async () => {
    const { captureId, promise } = createPendingCapture(2000)
    const ok = rejectPendingCapture(captureId, 'client refused')
    expect(ok).toBe(true)
    await expect(promise).rejects.toThrow('client refused')
  })

  it('times out when no response arrives', async () => {
    const { promise } = createPendingCapture(50)
    await expect(promise).rejects.toThrow(/capture timeout/)
  })

  it('returns false when resolving an unknown captureId', () => {
    expect(resolvePendingCapture('no-such-id', 'data:image/png;base64,x')).toBe(false)
  })

  it('can only be resolved once', async () => {
    const { captureId, promise } = createPendingCapture(2000)
    expect(resolvePendingCapture(captureId, 'data:image/png;base64,A')).toBe(true)
    await promise
    expect(resolvePendingCapture(captureId, 'data:image/png;base64,B')).toBe(false)
  })
})
