'use client'

import { useVideoStore } from '@/lib/store'
import type { Scene, AILayer } from '@/lib/types'
import { Image, Video, User, Sparkles, Trash2, Loader2 } from 'lucide-react'
import { useState } from 'react'

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
  const { removeAILayer, updateAILayer, saveSceneHTML, generateAIImage } = useVideoStore()
  const aiLayers = scene.aiLayers ?? []
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [quickPrompt, setQuickPrompt] = useState('')
  const [quickType, setQuickType] = useState<'image' | 'sticker'>('sticker')

  const handleQuickGenerate = async () => {
    if (!quickPrompt.trim()) return
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
          <span className="text-[10px] text-[#6b6b7a] uppercase tracking-wider font-semibold">AI Layers</span>
          <button
            onClick={() => setShowQuickAdd(true)}
            className="text-[10px] px-2 py-0.5 rounded transition-colors hover:bg-white/10"
            style={{ color: 'var(--color-accent, #e84545)' }}
          >
            + Add
          </button>
        </div>
        <p className="text-[11px] text-[#6b6b7a] italic">No AI-generated layers yet</p>
      </div>
    )
  }

  return (
    <div className="px-3 py-2 space-y-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-[#6b6b7a] uppercase tracking-wider font-semibold">AI Layers</span>
        <button
          onClick={() => setShowQuickAdd(!showQuickAdd)}
          className="text-[10px] px-2 py-0.5 rounded transition-colors hover:bg-white/10"
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
              onClick={() => setQuickType('sticker')}
              className={`text-[10px] px-2 py-1 rounded transition-colors ${
                quickType === 'sticker' ? 'bg-white/10 font-medium' : 'opacity-60'
              }`}
            >
              Sticker
            </button>
            <button
              onClick={() => setQuickType('image')}
              className={`text-[10px] px-2 py-1 rounded transition-colors ${
                quickType === 'image' ? 'bg-white/10 font-medium' : 'opacity-60'
              }`}
            >
              Image
            </button>
          </div>
          <input
            type="text"
            placeholder={quickType === 'sticker' ? 'Describe the sticker...' : 'Describe the image...'}
            value={quickPrompt}
            onChange={(e) => setQuickPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleQuickGenerate()}
            className="w-full text-xs px-2 py-1.5 rounded border focus:outline-none"
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
              disabled={!quickPrompt.trim()}
              className="flex-1 text-[10px] px-2 py-1 rounded font-medium transition-colors disabled:opacity-30"
              style={{ backgroundColor: 'var(--color-accent, #e84545)', color: '#fff' }}
            >
              Generate
            </button>
            <button
              onClick={() => { setShowQuickAdd(false); setQuickPrompt('') }}
              className="text-[10px] px-2 py-1 rounded opacity-60 hover:opacity-100 transition-opacity"
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

        return (
          <div
            key={layer.id}
            className="flex items-center gap-2 p-2 rounded border group"
            style={{
              backgroundColor: 'var(--color-input-bg, #161622)',
              borderColor: 'var(--color-border, #2a2a3a)',
            }}
          >
            <Icon size={14} className="shrink-0 opacity-60" />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium truncate">{layer.label || layer.type}</div>
              <div className={`text-[10px] ${statusColor} flex items-center gap-1`}>
                {layer.status === 'generating' && <Loader2 size={10} className="animate-spin" />}
                {layer.status}
                {'prompt' in layer && layer.prompt && (
                  <span className="text-[#6b6b7a] truncate ml-1">— {(layer as any).prompt.slice(0, 40)}</span>
                )}
              </div>
            </div>
            <button
              onClick={() => handleRemove(layer.id)}
              className="p-1 rounded opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity"
            >
              <Trash2 size={12} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
