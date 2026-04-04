import type { TTSProvider, SFXProvider, MusicProvider } from '../types'

export interface Voice {
  id: string
  name: string
  language: string
  gender?: string
  previewUrl?: string | null
}

export interface TTSResult {
  audioUrl: string
  duration: number | null
  provider: TTSProvider
}

export interface TTSParams {
  text: string
  sceneId: string
  voiceId?: string
  model?: string
  instructions?: string
  speakers?: { speaker: string; voiceName: string }[]
}

export interface TTSProviderInterface {
  id: TTSProvider
  name: string
  type: 'server' | 'client'
  requiresKey: string | null
  generate(params: TTSParams): Promise<TTSResult>
  listVoices?(): Promise<Voice[]>
}

export interface SFXResult {
  id: string
  name: string
  audioUrl: string
  duration: number | null
  provider: SFXProvider
  previewUrl?: string
  license?: string
}

export interface SFXProviderInterface {
  id: SFXProvider
  name: string
  requiresKey: string | null
  search(query: string, limit?: number): Promise<SFXResult[]>
  generate?(prompt: string, duration?: number): Promise<SFXResult>
}

export interface MusicResult {
  id: string
  name: string
  audioUrl: string
  duration: number | null
  provider: MusicProvider
  previewUrl?: string
}

export interface MusicProviderInterface {
  id: MusicProvider
  name: string
  requiresKey: string | null
  search(query: string, limit?: number): Promise<MusicResult[]>
}
