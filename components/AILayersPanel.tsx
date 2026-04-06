'use client'

import { useVideoStore } from '@/lib/store'
import type { Scene, AILayer, AvatarLayer } from '@/lib/types'
import { Image, Video, User, Sparkles, Trash2, Loader2, ChevronDown } from 'lucide-react'
import { useCallback, useState } from 'react'
import AvatarLayerSettings from '@/components/avatar/AvatarLayerSettings'

interface Props {
  scene: Scene
}

const LAYER_ICONS: Record<string, any> = {
  avatar: User,
  veo3: Video,
  image: Image,
  sticker: Sparkles,
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'text-[#6b6b7a]',
  generating: 'text-amber-400',
  'removing-bg': 'text-blue-400',
  ready: 'text-green-400',
  error: 'text-red-400',
}

export default function AILayersPanel({ scene }: Props) {
  const { addAILayer, removeAILayer, updateAILayer, saveSceneHTML, generateAIImage } = useVideoStore()
  const aiLayers = scene.aiLayers ?? []
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [quickPrompt, setQuickPrompt] = useState('')
  const [quickType, setQuickType] = useState<'image' | 'sticker' | 'avatar'>('sticker')
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null)

  const getIframe = useCallback(() => {
    return document.querySelector(`iframe[data-scene-id="${scene.id}"]`) as HTMLIFrameElement | null
  }, [scene.id])

  const handleQuickGenerate = async () => {
    if (quickType !== 'avatar' && !quickPrompt.trim()) return
    if (quickType === 'avatar') {
      const id = (globalThis.crypto?.randomUUID?.() ?? `avatar-${Date.now()}`) as string
      const script = quickPrompt.trim() || 'Welcome! Let me explain this scene.'
      addAILayer(scene.id, {
        id,
        type: 'avatar',
        avatarId: '',
        voiceId: '',
        script,
        removeBackground: false,
        x: 1640,
        y: 800,
        width: 320,
        height: 320,
        opacity: 1,
        zIndex: 100,
        videoUrl: null,
        thumbnailUrl: null,
        status: 'ready',
        heygenVideoId: null,
        estimatedDuration: scene.duration,
        startAt: 0,
        label: 'Avatar Overlay',
        avatarPlacement: 'pip_bottom_right',
        avatarProvider: 'talkinghead',
        talkingHeadUrl: `talkinghead://render?text=${encodeURIComponent(script)}&audio=&character=friendly`,
        narrationScript: {
          mood: 'happy',
          view: 'upper',
          lipsyncHeadMovement: true,
          eyeContact: 0.7,
          position: 'pip_bottom_right',
          pipSize: 320,
          pipShape: 'circle',
          avatarScale: 1.15,
          containerEnabled: true,
          background: '#6366f1',
          character: 'friendly',
          containerBlur: 16,
          containerBorderColor: '#ffffff',
          containerBorderOpacity: 0.35,
          containerBorderWidth: 2,
          containerShadowOpacity: 0.35,
          containerInnerGlow: 0.08,
          containerBgOpacity: 0.2,
          entranceAnimation: 'fade',
          exitAnimation: 'fade',
          lines: [],
        },
      })
      await saveSceneHTML(scene.id)
      setShowQuickAdd(false)
      setQuickPrompt('')
      return
    }

    setShowQuickAdd(false)
    await generateAIImage(scene.id, {
      prompt: quickPrompt,
      removeBackground: quickType === 'sticker',
      label: quickPrompt.slice(0, 30),
    })
    setQuickPrompt('')
  }

  const handleRemove = (layerId: string) => {
    removeAILayer(scene.id, layerId)
    saveSceneHTML(scene.id)
  }

  if (aiLayers.length === 0 && !showQuickAdd) {
    return (
      <div className="px-3 py-2">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] text-[#6b6b7a] uppercase tracking-wider font-semibold">AI Layers</span>
          <button
            onClick={() => setShowQuickAdd(true)}
            className="text-[11px] px-2 py-0.5 rounded transition-colors hover:bg-white/10"
            style={{ color: 'var(--color-accent, #e84545)' }}
          >
            + Add
          </button>
        </div>
        <p className="text-[12px] text-[#6b6b7a] italic">No AI-generated layers yet</p>
      </div>
    )
  }

  return (
    <div className="px-3 py-2 space-y-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] text-[#6b6b7a] uppercase tracking-wider font-semibold">AI Layers</span>
        <button
          onClick={() => setShowQuickAdd(!showQuickAdd)}
          className="text-[11px] px-2 py-0.5 rounded transition-colors hover:bg-white/10"
          style={{ color: 'var(--color-accent, #e84545)' }}
        >
          + Add
        </button>
      </div>

      {/* Quick add form */}
      {showQuickAdd && (
        <div
          className="p-2 rounded border space-y-2"
          style={{
            backgroundColor: 'var(--color-input-bg, #161622)',
            borderColor: 'var(--color-border, #2a2a3a)',
          }}
        >
          <div className="flex gap-1">
            <button
              onClick={() => setQuickType('avatar')}
              className={`text-[11px] px-2 py-1 rounded transition-colors ${
                quickType === 'avatar' ? 'bg-white/10 font-medium' : 'opacity-60'
              }`}
            >
              Avatar
            </button>
            <button
              onClick={() => setQuickType('sticker')}
              className={`text-[11px] px-2 py-1 rounded transition-colors ${
                quickType === 'sticker' ? 'bg-white/10 font-medium' : 'opacity-60'
              }`}
            >
              Sticker
            </button>
            <button
              onClick={() => setQuickType('image')}
              className={`text-[11px] px-2 py-1 rounded transition-colors ${
                quickType === 'image' ? 'bg-white/10 font-medium' : 'opacity-60'
              }`}
            >
              Image
            </button>
          </div>
          <input
            type="text"
            placeholder={
              quickType === 'avatar'
                ? 'Optional: default avatar script...'
                : quickType === 'sticker'
                  ? 'Describe the sticker...'
                  : 'Describe the image...'
            }
            value={quickPrompt}
            onChange={(e) => setQuickPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleQuickGenerate()}
            className="w-full text-sm px-2 py-1.5 rounded border focus:outline-none"
            style={{
              backgroundColor: 'var(--color-panel-bg, #1e1e2e)',
              borderColor: 'var(--color-border, #2a2a3a)',
              color: 'var(--color-text-primary, #e0e0e0)',
            }}
            autoFocus
          />
          <div className="flex gap-1">
            <button
              onClick={handleQuickGenerate}
              disabled={quickType !== 'avatar' && !quickPrompt.trim()}
              className="flex-1 text-[11px] px-2 py-1 rounded font-medium transition-colors disabled:opacity-30"
              style={{ backgroundColor: 'var(--color-accent, #e84545)', color: '#fff' }}
            >
              {quickType === 'avatar' ? 'Add Avatar' : 'Generate'}
            </button>
            <button
              onClick={() => {
                setShowQuickAdd(false)
                setQuickPrompt('')
              }}
              className="text-[11px] px-2 py-1 rounded opacity-60 hover:opacity-100 transition-opacity"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Layer list */}
      {aiLayers.map((layer) => {
        const Icon = LAYER_ICONS[layer.type] || Sparkles
        const statusColor = STATUS_COLORS[layer.status] || 'text-[#6b6b7a]'
        const isSelected = selectedLayerId === layer.id
        const isAvatar = layer.type === 'avatar'

        return (
          <div key={layer.id}>
            <div
              onClick={() => isAvatar && setSelectedLayerId(isSelected ? null : layer.id)}
              className={`flex items-center gap-2 p-2 rounded border group ${isAvatar ? 'cursor-pointer' : ''}`}
              style={{
                backgroundColor: isSelected ? 'var(--color-accent-bg, #1e1e30)' : 'var(--color-input-bg, #161622)',
                borderColor: isSelected ? 'var(--color-accent, #e84545)' : 'var(--color-border, #2a2a3a)',
              }}
            >
              <Icon size={14} className="shrink-0 opacity-60" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{layer.label || layer.type}</div>
                <div className={`text-[11px] ${statusColor} flex items-center gap-1`}>
                  {layer.status === 'generating' && <Loader2 size={10} className="animate-spin" />}
                  {layer.status}
                  {'prompt' in layer && layer.prompt && (
                    <span className="text-[#6b6b7a] truncate ml-1">— {(layer as any).prompt.slice(0, 40)}</span>
                  )}
                </div>
              </div>
              {isAvatar && (
                <ChevronDown
                  size={12}
                  className={`opacity-40 transition-transform ${isSelected ? '' : '-rotate-90'}`}
                />
              )}
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation()
                  handleRemove(layer.id)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.stopPropagation()
                    handleRemove(layer.id)
                  }
                }}
                className="p-1 rounded opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity"
              >
                <Trash2 size={12} />
              </span>
            </div>
            {/* Avatar settings panel (expanded) */}
            {isSelected && isAvatar && (
              <div
                className="mt-1 rounded border overflow-hidden"
                style={{
                  backgroundColor: 'var(--color-input-bg, #161622)',
                  borderColor: 'var(--color-border, #2a2a3a)',
                }}
              >
                <AvatarLayerSettings sceneId={scene.id} layer={layer as AvatarLayer} getIframe={getIframe} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
