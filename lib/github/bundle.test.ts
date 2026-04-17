import { describe, it, expect } from 'vitest'
import { bundleToFiles } from './file-layout'
import { filesToBundle } from './file-layout'
import type { CenchBundle } from './bundle-types'
import { BUNDLE_FORMAT_VERSION } from './bundle-types'

function createTestBundle(): CenchBundle {
  return {
    formatVersion: BUNDLE_FORMAT_VERSION,
    exportedAt: '2026-04-03T12:00:00.000Z',
    project: {
      originId: 'proj-001',
      name: 'Test Project',
      outputMode: 'mp4',
      globalStyle: {
        presetId: null,
        paletteOverride: null,
        bgColorOverride: null,
        fontOverride: null,
        bodyFontOverride: null,
        strokeColorOverride: null,
      },
      mp4Settings: { resolution: '1080p', fps: 30, format: 'mp4' },
      interactiveSettings: {
        playerTheme: 'dark',
        showProgressBar: true,
        showSceneNav: true,
        allowFullscreen: true,
        brandColor: '#e84545',
        customDomain: null,
        password: null,
      },
      audioSettings: {
        defaultTTSProvider: 'auto',
        defaultSFXProvider: 'auto',
        defaultMusicProvider: 'auto',
        defaultVoiceId: null,
        defaultVoiceName: null,
        webSpeechVoice: null,
        puterProvider: 'openai',
        openaiTTSModel: 'tts-1',
        openaiTTSVoice: 'alloy',
        geminiTTSModel: 'gemini-2.5-flash-preview-tts',
        geminiVoice: null,
        edgeTTSUrl: null,
        pocketTTSUrl: null,
        voxcpmUrl: null,
        globalMusicDucking: true,
        globalMusicDuckLevel: 0.2,
      },
      audioProviderEnabled: {},
      mediaGenEnabled: {},
      watermark: null,
    },
    scenes: [
      {
        scene: {
          id: 'scene-001',
          name: 'Intro',
          prompt: 'A bouncing ball',
          summary: '',
          svgContent: '<svg></svg>',
          canvasCode: '',
          canvasBackgroundCode: '',
          sceneCode: '',
          reactCode: '',
          sceneHTML: '',
          sceneStyles: '',
          lottieSource: '',
          duration: 8,
          bgColor: '#ffffff',
          thumbnail: null,
          videoLayer: { enabled: false, src: null, opacity: 1, trimStart: 0, trimEnd: null },
          audioLayer: { enabled: false, src: null, volume: 1, fadeIn: false, fadeOut: false, startOffset: 0 },
          textOverlays: [],
          svgObjects: [],
          primaryObjectId: null,
          svgBranches: [],
          activeBranchId: null,
          transition: 'none' as any,
          sceneType: 'svg',
          interactions: [],
          variables: [],
          aiLayers: [],
          messages: [],
          usage: null,
          styleOverride: {},
          d3Data: null,
          cameraMotion: null,
          worldConfig: null,
        },
        position: 0,
      },
      {
        scene: {
          id: 'scene-002',
          name: 'Details',
          prompt: 'Show details',
          summary: '',
          svgContent: '',
          canvasCode: 'ctx.fillRect(0,0,100,100)',
          canvasBackgroundCode: '',
          sceneCode: '',
          reactCode: '',
          sceneHTML: '',
          sceneStyles: '',
          lottieSource: '',
          duration: 6,
          bgColor: '#000000',
          thumbnail: null,
          videoLayer: { enabled: false, src: null, opacity: 1, trimStart: 0, trimEnd: null },
          audioLayer: { enabled: false, src: null, volume: 1, fadeIn: false, fadeOut: false, startOffset: 0 },
          textOverlays: [],
          svgObjects: [],
          primaryObjectId: null,
          svgBranches: [],
          activeBranchId: null,
          transition: 'fade' as any,
          sceneType: 'canvas2d',
          interactions: [
            {
              id: 'ix-001',
              type: 'choice',
              x: 50,
              y: 50,
              width: 30,
              height: 10,
              appearsAt: 2,
              hidesAt: null,
              entranceAnimation: 'fade' as const,
              question: 'Which path?',
              layout: 'horizontal' as const,
              options: [
                { id: 'opt-1', label: 'Path A', icon: null, jumpsToSceneId: 'scene-001', color: null },
                { id: 'opt-2', label: 'Path B', icon: null, jumpsToSceneId: 'scene-002', color: null },
              ],
            },
          ],
          variables: [],
          aiLayers: [],
          messages: [],
          usage: null,
          styleOverride: {},
          d3Data: null,
          cameraMotion: null,
          worldConfig: null,
        },
        position: 1,
      },
    ],
    sceneGraph: {
      nodes: [
        { id: 'scene-001', position: { x: 0, y: 100 } },
        { id: 'scene-002', position: { x: 220, y: 100 } },
      ],
      edges: [
        {
          id: 'edge-001',
          fromSceneId: 'scene-001',
          toSceneId: 'scene-002',
          condition: { type: 'auto', interactionId: null, variableName: null, variableValue: null },
        },
      ],
      startSceneId: 'scene-001',
    },
    assets: [
      {
        id: 'asset-001',
        filename: 'bg.png',
        type: 'image',
        mimeType: 'image/png',
        sizeBytes: 1024,
        width: 1920,
        height: 1080,
        durationSeconds: null,
        name: 'Background',
        tags: ['background'],
        embedded: false,
        publicUrl: 'https://cdn.example.com/bg.png',
        bundlePath: null,
      },
    ],
    timeline: null,
  }
}

describe('bundleToFiles / filesToBundle round-trip', () => {
  it('round-trips a bundle through file layout', () => {
    const original = createTestBundle()
    const files = bundleToFiles(original)

    expect(files.has('cench/project.json')).toBe(true)
    expect(files.has('cench/scenes.json')).toBe(true)
    expect(files.has('cench/scene-graph.json')).toBe(true)
    expect(files.has('cench/assets.json')).toBe(true)

    const reconstructed = filesToBundle(files)

    expect(reconstructed.formatVersion).toBe(original.formatVersion)
    expect(reconstructed.exportedAt).toBe(original.exportedAt)
    expect(reconstructed.project.name).toBe(original.project.name)
    expect(reconstructed.project.outputMode).toBe(original.project.outputMode)
    expect(reconstructed.scenes.length).toBe(original.scenes.length)
    expect(reconstructed.scenes[0].scene.id).toBe('scene-001')
    expect(reconstructed.scenes[1].scene.canvasCode).toBe('ctx.fillRect(0,0,100,100)')
    expect(reconstructed.sceneGraph.edges.length).toBe(1)
    expect(reconstructed.sceneGraph.startSceneId).toBe('scene-001')
    expect(reconstructed.assets.length).toBe(1)
    expect(reconstructed.assets[0].publicUrl).toBe('https://cdn.example.com/bg.png')
  })

  it('preserves interaction jump targets in scenes', () => {
    const original = createTestBundle()
    const files = bundleToFiles(original)
    const reconstructed = filesToBundle(files)

    const choice = reconstructed.scenes[1].scene.interactions[0] as any
    expect(choice.options[0].jumpsToSceneId).toBe('scene-001')
    expect(choice.options[1].jumpsToSceneId).toBe('scene-002')
  })

  it('throws on missing project.json', () => {
    const files = new Map<string, string>()
    files.set('cench/scenes.json', '[]')
    files.set('cench/scene-graph.json', '{}')

    expect(() => filesToBundle(files)).toThrow('Missing cench/project.json')
  })

  it('throws on missing scenes.json', () => {
    const files = new Map<string, string>()
    files.set('cench/project.json', JSON.stringify({ formatVersion: 1, project: {} }))
    files.set('cench/scene-graph.json', '{}')

    expect(() => filesToBundle(files)).toThrow('Missing cench/scenes.json')
  })

  it('handles empty assets gracefully', () => {
    const files = new Map<string, string>()
    files.set(
      'cench/project.json',
      JSON.stringify({
        formatVersion: 1,
        exportedAt: new Date().toISOString(),
        project: { name: 'Test' },
      }),
    )
    files.set('cench/scenes.json', '[]')
    files.set('cench/scene-graph.json', JSON.stringify({ nodes: [], edges: [], startSceneId: '' }))
    // No assets.json

    const bundle = filesToBundle(files)
    expect(bundle.assets).toEqual([])
  })
})
