import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { validateBody } from './validate'

const schema = z.object({
  name: z.string().min(1),
  count: z.number().int().positive(),
  tags: z.array(z.string()).default([]),
})

describe('validateBody', () => {
  it('returns success with valid data', () => {
    const result = validateBody(schema, { name: 'test', count: 5 })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe('test')
      expect(result.data.count).toBe(5)
      expect(result.data.tags).toEqual([])
    }
  })

  it('applies defaults for missing optional fields', () => {
    const result = validateBody(schema, { name: 'test', count: 1 })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.tags).toEqual([])
    }
  })

  it('returns error for missing required fields', () => {
    const result = validateBody(schema, { count: 5 })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.status).toBe(400)
    }
  })

  it('returns error for wrong types', () => {
    const result = validateBody(schema, { name: 'test', count: 'not-a-number' })
    expect(result.success).toBe(false)
  })

  it('returns error for invalid constraints', () => {
    const result = validateBody(schema, { name: '', count: 5 })
    expect(result.success).toBe(false)
  })
})
