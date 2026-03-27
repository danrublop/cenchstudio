'use client'

import { useCallback, useRef, useState } from 'react'
import { Film, Music, Type, Plus, Trash2, ChevronDown, Layers } from 'lucide-react'
import { useVideoStore } from '@/lib/store'
import type { Scene, TransitionType } from '@/lib/types'
import AILayersPanel from '@/components/AILayersPanel'

const TRANSITIONS: { value: TransitionType; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'crossfade', label: 'Crossfade' },
  { value: 'wipe-left', label: 'Wipe Left' },
  { value: 'wipe-right', label: 'Wipe Right' },
]

interface Props {
  scene: Scene
}

async function uploadFile(file: File): Promise<string> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch('/api/upload', { method: 'POST', body: form })
  if (!res.ok) throw new Error('Upload failed')
  const { url } = await res.json()
  return url
}

export default function LayersTab({ scene }: Props) {
  const {
    updateScene,
    saveSceneHTML,
    addTextOverlay,
    updateTextOverlay,
    removeTextOverlay,
    addSvgObject,
    updateSvgObject,
    removeSvgObject,
    generateSvgObject,
    isGenerating,
    generatingSceneId,
  } = useVideoStore()

  const [objectPrompts, setObjectPrompts] = useState<Record<string, string>>({})

  const videoInputRef = useRef<HTMLInputElement>(null)
  const audioInputRef = useRef<HTMLInputElement>(null)

  const handleVideoUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      try {
        const url = await uploadFile(file)
        updateScene(scene.id, { videoLayer: { ...scene.videoLayer, src: url, enabled: true } })
        await saveSceneHTML(scene.id)
      } catch {
        alert('Upload failed')
      }
    },
    [scene, updateScene, saveSceneHTML]
  )

  const handleAudioUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      try {
        const url = await uploadFile(file)
        updateScene(scene.id, { audioLayer: { ...scene.audioLayer, src: url, enabled: true } })
        await saveSceneHTML(scene.id)
      } catch {
        alert('Upload failed')
      }
    },
    [scene, updateScene, saveSceneHTML]
  )

  const handleGenerateVoiceover = useCallback(async () => {
    const text = scene.prompt
    if (!text) return
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, sceneId: scene.id }),
      })
      if (!res.ok) throw new Error('TTS failed')
      const { url } = await res.json()
      updateScene(scene.id, { audioLayer: { ...scene.audioLayer, src: url, enabled: true } })
      await saveSceneHTML(scene.id)
    } catch (err) {
      alert('TTS generation failed. Check your ElevenLabs API key.')
    }
  }, [scene, updateScene, saveSceneHTML])

  const commitLayer = useCallback(async () => {
    await saveSceneHTML(scene.id)
  }, [scene.id, saveSceneHTML])

  // Debounced commit for sliders — fires 150ms after last change
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const commitLayerDebounced = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      saveSceneHTML(scene.id)
    }, 150)
  }, [scene.id, saveSceneHTML])

  return (
    <div className="p-4 space-y-5">
      {/* Scene Settings (Moved from Settings Panel) */}
      <section className="border rounded-lg p-3 space-y-3" style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex items-center gap-2 mb-2">
          <Film size={13} className="text-[#6b6b7a]" />
          <span className="text-xs font-medium text-[var(--color-text-primary)]">Scene Settings</span>
        </div>

        {/* Name */}
        <div>
          <label className="text-[#6b6b7a] text-[10px] uppercase tracking-wider block mb-1.5">Name</label>
          <input
            type="text"
            placeholder="Untitled scene"
            value={scene.name}
            onChange={(e) => updateScene(scene.id, { name: e.target.value })}
            onBlur={commitLayer}
            className="w-full border rounded px-3 py-2 text-sm placeholder-[#6b6b7a] focus:outline-none focus:border-[#e84545] transition-colors"
            style={{ backgroundColor: 'var(--color-input-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
          />
        </div>

        {/* Duration */}
        <div>
          <label className="text-[#6b6b7a] text-[10px] uppercase tracking-wider block mb-1.5">
            Duration: {scene.duration}s
          </label>
          <input
            type="range" min={3} max={20} step={1}
            value={scene.duration}
            onChange={(e) => updateScene(scene.id, { duration: parseInt(e.target.value) })}
            onMouseUp={commitLayer}
            className="w-full"
          />
          <div className="flex justify-between text-[9px] text-[#6b6b7a] mt-0.5">
            <span>3s</span><span>20s</span>
          </div>
        </div>

        {/* Background color */}
        <div>
          <label className="text-[#6b6b7a] text-[10px] uppercase tracking-wider block mb-1.5">Background color</label>
          <div className="flex items-center gap-2">
            <label className="relative cursor-pointer group flex-shrink-0">
              <div className="w-8 h-8 rounded-lg border-2 transition-all overflow-hidden group-hover:border-[#e84545]"
                style={{ background: scene.bgColor, borderColor: 'var(--color-border)' }} />
              <input type="color" value={scene.bgColor}
                onChange={(e) => updateScene(scene.id, { bgColor: e.target.value })}
                onBlur={commitLayer}
                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
            </label>
            <input type="text" value={scene.bgColor}
              onChange={(e) => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) updateScene(scene.id, { bgColor: e.target.value }) }}
              onBlur={commitLayer}
              className="flex-1 border rounded px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-[#e84545] transition-colors"
              style={{ backgroundColor: 'var(--color-input-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }} />
          </div>
        </div>

        {/* Transition */}
        <div>
          <label className="text-[#6b6b7a] text-[10px] uppercase tracking-wider block mb-1.5">Transition to Next Scene</label>
          <div className="grid grid-cols-2 gap-1.5">
            {TRANSITIONS.map((t) => (
              <button key={t.value} onClick={() => { updateScene(scene.id, { transition: t.value }); commitLayer(); }}
                className={`kbd h-7 text-[10px] ${scene.transition === t.value
                  ? 'border-[#e84545] text-[#e84545] shadow-[#800]'
                  : 'text-[#6b6b7a] hover:text-[#f0ece0]'}`}
              >{t.label}</button>
            ))}
          </div>
        </div>
      </section>

      {/* SVG Layer (always) */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-2 rounded-full bg-[#e84545]" />
          <span className="text-xs font-medium text-[#f0ece0]">SVG Layer</span>
          <span className="text-[10px] text-[#6b6b7a] ml-auto">always present</span>
        </div>
        <div className="w-full h-full" style={{ pointerEvents: 'none', overflow: 'hidden', backgroundColor: 'var(--color-input-bg)' }}>
          {scene.svgContent
            ? `${scene.svgContent.length.toLocaleString()} chars · z-index 2`
            : 'No SVG generated yet'}
        </div>
      </section>

      {/* Video Layer */}
      <section className="border rounded-lg p-3 space-y-3" style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex items-center gap-2">
          <Film size={13} className="text-[#6b6b7a]" />
          <span className="text-xs font-medium text-[var(--color-text-primary)]">Video Layer</span>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[10px] text-[#6b6b7a]">{scene.videoLayer.enabled ? 'On' : 'Off'}</span>
            <div className="relative">
              <input
                type="checkbox"
                className="tgl"
                id={`v-layer-${scene.id}`}
                checked={scene.videoLayer.enabled}
                onChange={() => {
                  updateScene(scene.id, {
                    videoLayer: { ...scene.videoLayer, enabled: !scene.videoLayer.enabled },
                  })
                  commitLayer()
                }}
              />
              <label className="tgl-btn" htmlFor={`v-layer-${scene.id}`} />
            </div>
          </div>
        </div>

        {scene.videoLayer.enabled && (
          <>
            {/* Upload / URL */}
            <div className="space-y-2">
              <input
                ref={videoInputRef}
                type="file"
                accept="video/mp4,video/webm"
                onChange={handleVideoUpload}
                className="hidden"
              />
              <button
                onClick={() => videoInputRef.current?.click()}
                className="kbd w-full h-8 border-dashed border-[#444] text-[#6b6b7a] hover:text-[#e84545] hover:border-[#e84545] transition-colors"
              >
                <Plus size={14} />
                <span className="text-xs">{scene.videoLayer.src ? 'Replace video' : 'Upload MP4'}</span>
              </button>
              {scene.videoLayer.src && (
                <p className="text-[#6b6b7a] text-[10px] truncate">
                  {scene.videoLayer.src}
                </p>
              )}
              <div>
                <label className="text-[10px] text-[#6b6b7a] block mb-1">
                  Or paste URL
                </label>
                <input
                  type="text"
                  placeholder="https://..."
                  value={scene.videoLayer.src ?? ''}
                  onChange={(e) =>
                    updateScene(scene.id, {
                      videoLayer: { ...scene.videoLayer, src: e.target.value || null },
                    })
                  }
                  onBlur={commitLayer}
                  className="w-full border rounded px-2 py-1 text-xs placeholder-[#6b6b7a] focus:outline-none focus:border-[#e84545] transition-colors"
                  style={{ backgroundColor: 'var(--color-input-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
                />
              </div>
            </div>

            {/* Opacity */}
            <div>
              <label className="text-[10px] text-[#6b6b7a] block mb-1">
                Opacity: {Math.round(scene.videoLayer.opacity * 100)}%
              </label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={scene.videoLayer.opacity}
                onChange={(e) => {
                  updateScene(scene.id, {
                    videoLayer: { ...scene.videoLayer, opacity: parseFloat(e.target.value) },
                  })
                  commitLayerDebounced()
                }}
                className="w-full"
              />
            </div>

            {/* Trim */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-[#6b6b7a] block mb-1">Trim start (s)</label>
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={scene.videoLayer.trimStart}
                  onChange={(e) =>
                    updateScene(scene.id, {
                      videoLayer: { ...scene.videoLayer, trimStart: parseFloat(e.target.value) || 0 },
                    })
                  }
                  onBlur={commitLayer}
                  className="w-full border rounded px-2 py-1 text-xs focus:outline-none focus:border-[#e84545] transition-colors"
                  style={{ backgroundColor: 'var(--color-input-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
                />
              </div>
              <div>
                <label className="text-[10px] text-[#6b6b7a] block mb-1">Trim end (s)</label>
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={scene.videoLayer.trimEnd ?? ''}
                  placeholder="auto"
                  onChange={(e) =>
                    updateScene(scene.id, {
                      videoLayer: {
                        ...scene.videoLayer,
                        trimEnd: e.target.value ? parseFloat(e.target.value) : null,
                      },
                    })
                  }
                  onBlur={commitLayer}
                  className="w-full border rounded px-2 py-1 text-xs focus:outline-none focus:border-[#e84545] transition-colors"
                  style={{ backgroundColor: 'var(--color-input-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
                />
              </div>
            </div>
          </>
        )}
      </section>

      {/* Audio Layer */}
      <section className="border rounded-lg p-3 space-y-3" style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex items-center gap-2">
          <Music size={13} className="text-[#6b6b7a]" />
          <span className="text-xs font-medium text-[var(--color-text-primary)]">Audio Layer</span>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[10px] text-[#6b6b7a]">{scene.audioLayer.enabled ? 'On' : 'Off'}</span>
            <div className="relative">
              <input
                type="checkbox"
                className="tgl"
                id={`a-layer-${scene.id}`}
                checked={scene.audioLayer.enabled}
                onChange={() => {
                  updateScene(scene.id, {
                    audioLayer: { ...scene.audioLayer, enabled: !scene.audioLayer.enabled },
                  })
                  commitLayer()
                }}
              />
              <label className="tgl-btn" htmlFor={`a-layer-${scene.id}`} />
            </div>
          </div>
        </div>

        {scene.audioLayer.enabled && (
          <>
            <input
              ref={audioInputRef}
              type="file"
              accept="audio/mp3,audio/wav,audio/mpeg"
              onChange={handleAudioUpload}
              className="hidden"
            />

            <div className="flex gap-2">
              <button
                onClick={() => audioInputRef.current?.click()}
                className="kbd flex-1 h-8 border-dashed border-[#444] text-[#6b6b7a] hover:text-[#e84545] hover:border-[#e84545]"
              >
                <Plus size={14} />
                <span className="text-[10px] shrink-0 whitespace-nowrap">{scene.audioLayer.src ? 'Replace' : 'Upload MP3'}</span>
              </button>
              <button
                onClick={handleGenerateVoiceover}
                className="kbd flex-1 h-8 text-[#6b6b7a] hover:text-[#f0ece0]"
              >
                <Music size={14} />
                <span className="text-[10px]">ElevenLabs</span>
              </button>
            </div>

            {scene.audioLayer.src && (
              <p className="text-[#6b6b7a] text-[10px] truncate">{scene.audioLayer.src}</p>
            )}

            {/* Volume */}
            <div>
              <label className="text-[10px] text-[#6b6b7a] block mb-1">
                Volume: {Math.round(scene.audioLayer.volume * 100)}%
              </label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={scene.audioLayer.volume}
                onChange={(e) => {
                  updateScene(scene.id, {
                    audioLayer: { ...scene.audioLayer, volume: parseFloat(e.target.value) },
                  })
                  commitLayerDebounced()
                }}
                className="w-full"
              />
            </div>

            {/* Start offset */}
            <div>
              <label className="text-[10px] text-[#6b6b7a] block mb-1">
                Start offset (s)
              </label>
              <input
                type="number"
                min={0}
                step={0.1}
                value={scene.audioLayer.startOffset}
                onChange={(e) =>
                  updateScene(scene.id, {
                    audioLayer: {
                      ...scene.audioLayer,
                      startOffset: parseFloat(e.target.value) || 0,
                    },
                  })
                }
                onBlur={commitLayer}
                className="w-full border rounded px-2 py-1 text-xs focus:outline-none focus:border-[#e84545] transition-colors"
                  style={{ backgroundColor: 'var(--color-input-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
              />
            </div>

            {/* Fade toggles */}
            <div className="flex gap-4">
              {[
                { key: 'fadeIn', label: 'Fade In' },
                { key: 'fadeOut', label: 'Fade Out' },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={scene.audioLayer[key as 'fadeIn' | 'fadeOut']}
                    onChange={(e) => {
                      updateScene(scene.id, {
                        audioLayer: { ...scene.audioLayer, [key]: e.target.checked },
                      })
                      commitLayer()
                    }}
                    className="w-3 h-3 accent-[#e84545]"
                  />
                  <span className="text-[10px] text-[#6b6b7a]">{label}</span>
                </label>
              ))}
            </div>
          </>
        )}
      </section>

      {/* SVG Objects */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Layers size={13} className="text-[#6b6b7a]" />
            <span className="text-xs font-medium text-[var(--color-text-primary)]">SVG Objects</span>
            <span className="text-[10px] text-[#6b6b7a]">transparent stickers</span>
          </div>
          <button
            onClick={() => addSvgObject(scene.id)}
            className="kbd h-6 px-2 text-[#6b6b7a] hover:text-[#e84545]"
          >
            <Plus size={11} />
            <span className="text-[10px]">Add</span>
          </button>
        </div>

        {(scene.svgObjects ?? []).length === 0 ? (
          <div className="text-[10px] text-[#6b6b7a] text-center py-3 border border-dashed rounded" style={{ borderColor: 'var(--color-border)' }}>
            No SVG objects
          </div>
        ) : (
          <div className="space-y-2">
            {(scene.svgObjects ?? []).map((obj, idx) => {
              const isThisGenerating = isGenerating && generatingSceneId === scene.id
              const prompt = objectPrompts[obj.id] ?? obj.prompt
              return (
                <div key={obj.id} className="border rounded p-2.5 space-y-2" style={{ borderColor: 'var(--color-border)' }}>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] text-[#6b6b7a] shrink-0">#{idx + 1}</span>
                    <input
                      type="text"
                      value={prompt}
                      onChange={(e) => setObjectPrompts((p) => ({ ...p, [obj.id]: e.target.value }))}
                      placeholder="Describe this object..."
                      className="flex-1 border rounded px-2 py-1 text-[10px] placeholder-[#6b6b7a] focus:outline-none focus:border-[#e84545] transition-colors"
                      style={{ backgroundColor: 'var(--color-input-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
                    />
                    <button
                      onClick={async () => {
                        if (!prompt.trim() || isThisGenerating) return
                        setObjectPrompts((p) => ({ ...p, [obj.id]: prompt }))
                        await generateSvgObject(scene.id, obj.id, prompt)
                      }}
                      disabled={!prompt.trim() || isThisGenerating}
                      className="kbd h-8 px-2 bg-[#e84545] border-[#e84545] shadow-[#800] text-white disabled:opacity-40 shrink-0"
                    >
                      <span className="text-[10px] uppercase tracking-wider">
                        {isThisGenerating ? '...' : obj.svgContent ? 'Regen' : 'Gen'}
                      </span>
                    </button>
                    <button
                      onClick={() => { removeSvgObject(scene.id, obj.id); saveSceneHTML(scene.id) }}
                      className="text-[#6b6b7a] hover:text-[#e84545] transition-colors"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
                      {/* X Position */}
                      <div>
                        <div className="flex justify-between items-end mb-1">
                          <label className="text-[9px] text-[#6b6b7a] uppercase tracking-wider">X Position</label>
                          <span className="text-[9px] text-[var(--color-text-muted)] font-mono">{Math.round(obj.x)}%</span>
                        </div>
                        <input
                          type="range" min={0} max={100} step={1}
                          value={Math.round(obj.x)}
                          onChange={(e) => { updateSvgObject(scene.id, obj.id, { x: parseFloat(e.target.value) || 0 }); commitLayerDebounced() }}
                          className="w-full"
                        />
                      </div>

                      {/* Y Position */}
                      <div>
                        <div className="flex justify-between items-end mb-1">
                          <label className="text-[9px] text-[#6b6b7a] uppercase tracking-wider">Y Position</label>
                          <span className="text-[9px] text-[var(--color-text-muted)] font-mono">{Math.round(obj.y)}%</span>
                        </div>
                        <input
                          type="range" min={0} max={100} step={1}
                          value={Math.round(obj.y)}
                          onChange={(e) => { updateSvgObject(scene.id, obj.id, { y: parseFloat(e.target.value) || 0 }); commitLayerDebounced() }}
                          className="w-full"
                        />
                      </div>

                      {/* Scale (Width) */}
                      <div>
                        <div className="flex justify-between items-end mb-1">
                          <label className="text-[9px] text-[#6b6b7a] uppercase tracking-wider">Scale</label>
                          <span className="text-[9px] text-[var(--color-text-muted)] font-mono">{Math.round(obj.width)}%</span>
                        </div>
                        <input
                          type="range" min={5} max={150} step={1}
                          value={Math.round(obj.width)}
                          onChange={(e) => { updateSvgObject(scene.id, obj.id, { width: parseFloat(e.target.value) || 50 }); commitLayerDebounced() }}
                          className="w-full"
                        />
                      </div>

                      {/* Opacity */}
                      <div>
                        <div className="flex justify-between items-end mb-1">
                          <label className="text-[9px] text-[#6b6b7a] uppercase tracking-wider">Opacity</label>
                          <span className="text-[9px] text-[var(--color-text-muted)] font-mono">{Math.round(obj.opacity * 100)}%</span>
                        </div>
                        <input
                          type="range" min={0} max={1} step={0.01}
                          value={obj.opacity}
                          onChange={(e) => { updateSvgObject(scene.id, obj.id, { opacity: parseFloat(e.target.value) }); commitLayerDebounced() }}
                          className="w-full"
                        />
                      </div>
                    </div>
                  </div>

                  {obj.svgContent && (
                    <div className="text-[9px] text-[#6b6b7a]">
                      {obj.svgContent.length.toLocaleString()} chars generated
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Text Overlays */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Type size={13} className="text-[#6b6b7a]" />
            <span className="text-xs font-medium text-[var(--color-text-primary)]">Text Overlays</span>
          </div>
          <button
            onClick={() => addTextOverlay(scene.id)}
            className="kbd h-6 px-2 text-[#6b6b7a] hover:text-[#e84545]"
          >
            <Plus size={11} />
            <span className="text-[10px]">Add</span>
          </button>
        </div>

        {scene.textOverlays.length === 0 ? (
          <div className="text-[10px] text-[#6b6b7a] text-center py-3 border border-dashed rounded" style={{ borderColor: 'var(--color-border)' }}>
            No text overlays
          </div>
        ) : (
          <div className="space-y-2">
            {scene.textOverlays.map((overlay) => (
              <div key={overlay.id} className="border rounded p-2.5 space-y-2" style={{ borderColor: 'var(--color-border)' }}>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={overlay.content}
                    onChange={(e) => {
                      updateTextOverlay(scene.id, overlay.id, { content: e.target.value })
                      commitLayerDebounced()
                    }}
                    className="flex-1 border rounded px-2 py-1 text-xs focus:outline-none focus:border-[#e84545] transition-colors"
                    style={{ backgroundColor: 'var(--color-input-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
                  />
                  <button
                    onClick={() => { removeTextOverlay(scene.id, overlay.id); commitLayer() }}
                    className="text-[#6b6b7a] hover:text-[#e84545] transition-colors"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] text-[#6b6b7a] block mb-0.5">X%</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={overlay.x}
                      onChange={(e) => {
                        updateTextOverlay(scene.id, overlay.id, { x: parseFloat(e.target.value) || 0 })
                        commitLayerDebounced()
                      }}
                      className="w-full border rounded px-2 py-0.5 text-[10px] focus:outline-none focus:border-[#e84545] transition-colors"
                        style={{ backgroundColor: 'var(--color-input-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-[#6b6b7a] block mb-0.5">Y%</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={overlay.y}
                      onChange={(e) => {
                        updateTextOverlay(scene.id, overlay.id, { y: parseFloat(e.target.value) || 0 })
                        commitLayerDebounced()
                      }}
                      className="w-full border rounded px-2 py-0.5 text-[10px] focus:outline-none focus:border-[#e84545] transition-colors"
                        style={{ backgroundColor: 'var(--color-input-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-[#6b6b7a] block mb-0.5">Size</label>
                    <input
                      type="number"
                      min={10}
                      max={200}
                      value={overlay.size}
                      onChange={(e) => {
                        updateTextOverlay(scene.id, overlay.id, { size: parseInt(e.target.value) || 48 })
                        commitLayerDebounced()
                      }}
                      className="w-full border rounded px-2 py-0.5 text-[10px] focus:outline-none focus:border-[#e84545] transition-colors"
                        style={{ backgroundColor: 'var(--color-input-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-[#6b6b7a] block mb-0.5">Color</label>
                    <input
                      type="color"
                      value={overlay.color}
                      onChange={(e) => {
                        updateTextOverlay(scene.id, overlay.id, { color: e.target.value })
                        commitLayerDebounced()
                      }}
                      className="w-full h-6 bg-transparent border border-[#2a2a32] rounded cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-[#6b6b7a] block mb-0.5">Delay (s)</label>
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      value={overlay.delay}
                      onChange={(e) => {
                        updateTextOverlay(scene.id, overlay.id, { delay: parseFloat(e.target.value) || 0 })
                        commitLayerDebounced()
                      }}
                      className="w-full border rounded px-2 py-0.5 text-[10px] focus:outline-none focus:border-[#e84545] transition-colors"
                        style={{ backgroundColor: 'var(--color-input-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-[#6b6b7a] block mb-0.5">Animation</label>
                    <select
                      value={overlay.animation}
                      onChange={(e) => {
                        updateTextOverlay(scene.id, overlay.id, {
                          animation: e.target.value as 'fade-in' | 'slide-up' | 'typewriter',
                        })
                        commitLayerDebounced()
                      }}
                      className="w-full border rounded px-1 py-0.5 text-[10px] focus:outline-none focus:border-[#e84545] transition-colors"
                      style={{ backgroundColor: 'var(--color-input-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
                    >
                      <option value="fade-in">Fade In</option>
                      <option value="slide-up">Slide Up</option>
                      <option value="typewriter">Typewriter</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* AI Generated Layers */}
      <section className="border rounded-lg py-2 space-y-1" style={{ borderColor: 'var(--color-border)' }}>
        <AILayersPanel scene={scene} />
      </section>
    </div>
  )
}
