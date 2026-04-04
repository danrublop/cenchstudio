import { describe, it, expect } from 'vitest'
import { generateCanvasSchema, generateSvgSchema } from './generate'

describe('generateCanvasSchema', () => {
  it('accepts valid input with all fields', () => {
    const result = generateCanvasSchema.safeParse({
      prompt: 'Draw a bouncing ball',
      palette: ['#ff0000', '#00ff00'],
      bgColor: '#000000',
      duration: 10,
      previousSummary: 'Scene 1 showed a circle.',
    })
    expect(result.success).toBe(true)
  })

  it('applies defaults for optional fields', () => {
    const result = generateCanvasSchema.safeParse({ prompt: 'Hello' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.palette).toHaveLength(4)
      expect(result.data.bgColor).toBe('#fffef9')
      expect(result.data.duration).toBe(8)
      expect(result.data.previousSummary).toBe('')
    }
  })

  it('rejects empty prompt', () => {
    const result = generateCanvasSchema.safeParse({ prompt: '' })
    expect(result.success).toBe(false)
  })

  it('rejects missing prompt', () => {
    const result = generateCanvasSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})

describe('generateSvgSchema', () => {
  it('accepts edit mode with svgContent and editInstruction', () => {
    const result = generateSvgSchema.safeParse({
      edit: true,
      svgContent: '<svg></svg>',
      editInstruction: 'Make it blue',
    })
    expect(result.success).toBe(true)
  })

  it('applies defaults correctly', () => {
    const result = generateSvgSchema.safeParse({ prompt: 'A tree' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.strokeWidth).toBe(2)
      expect(result.data.font).toBe('Caveat')
      expect(result.data.duration).toBe(8)
      expect(result.data.enhance).toBe(false)
      expect(result.data.edit).toBe(false)
    }
  })
})
