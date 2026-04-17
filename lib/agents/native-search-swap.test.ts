import { describe, it, expect } from 'vitest'
import { swapNativeSearchTool, isNativeSearchMarker } from './context-builder'
import type { ClaudeToolDefinition } from './types'

function tools(...names: string[]): ClaudeToolDefinition[] {
  return names.map((n) => ({
    name: n,
    description: `${n} description`,
    input_schema: { type: 'object', properties: {} },
  }))
}

describe('swapNativeSearchTool', () => {
  it('leaves tools untouched when research is disabled', () => {
    const input = tools('web_search', 'other')
    const out = swapNativeSearchTool(input, 'anthropic', 'claude-sonnet-4-6' as any, false)
    expect(out).toEqual(input)
  })

  it('leaves tools untouched when no web_search tool is present', () => {
    const input = tools('other')
    const out = swapNativeSearchTool(input, 'anthropic', 'claude-sonnet-4-6' as any, true)
    expect(out).toEqual(input)
  })

  it('swaps to Anthropic server tool for Anthropic models', () => {
    const out = swapNativeSearchTool(tools('web_search', 'other'), 'anthropic', 'claude-sonnet-4-6' as any, true)
    const ws = out.find((t) => t.name === 'web_search')
    expect(ws?.type).toBe('web_search_20250305')
    expect(ws?.max_uses).toBe(5)
    expect(isNativeSearchMarker(ws!)).toBe(true)
  })

  it('swaps to openai_web_search marker for OpenAI native-search models', () => {
    const out = swapNativeSearchTool(tools('web_search'), 'openai', 'gpt-4.1' as any, true)
    const ws = out.find((t) => t.name === 'web_search')
    expect(ws?.type).toBe('openai_web_search')
    expect(isNativeSearchMarker(ws!)).toBe(true)
  })

  it('does NOT swap for OpenAI models without native search (e.g. o1)', () => {
    const out = swapNativeSearchTool(tools('web_search'), 'openai', 'o1' as any, true)
    const ws = out.find((t) => t.name === 'web_search')
    expect(ws?.type).toBeUndefined()
  })

  it('swaps to google_search marker for Gemini models with native search', () => {
    const out = swapNativeSearchTool(tools('web_search'), 'google', 'gemini-2.5-flash-preview-05-20' as any, true)
    const ws = out.find((t) => t.name === 'web_search')
    expect(ws?.type).toBe('google_search')
    expect(isNativeSearchMarker(ws!)).toBe(true)
  })

  it('keeps the custom web_search tool for local models (fallback to third-party router)', () => {
    const out = swapNativeSearchTool(tools('web_search'), 'local', 'ollama/llama3.1:8b' as any, true)
    const ws = out.find((t) => t.name === 'web_search')
    expect(ws?.type).toBeUndefined()
  })
})
