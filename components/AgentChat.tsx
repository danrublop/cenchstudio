'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Plus,
  RefreshCw,
  Check,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  Infinity,
  Zap,
  Film,
  Scissors,
  Palette,
  PenLine,
  Paintbrush,
  BarChart2,
  Box,
  Sparkles,
  MoreHorizontal,
  Clock,
  X,
  ThumbsUp,
  ThumbsDown,
  Copy,
  Pin,
  ToggleLeft,
  ToggleRight,
  ShieldAlert,
  Wrench,
  CheckCircle2,
  XCircle,
  Bot,
  Loader2,
  ListOrdered,
  Mic,
  Square,
} from 'lucide-react'
import { TOOL_FILTER_CHIPS } from '@/lib/agent-tools'
import { AUDIO_PROVIDERS } from '@/lib/audio/provider-registry'
import { MEDIA_PROVIDERS } from '@/lib/media/provider-registry'
import { useVideoStore } from '@/lib/store'
import type { Scene, Message } from '@/lib/types'
import type {
  AgentType,
  ModelTier,
  ThinkingMode,
  SSEEvent,
  ToolCallRecord,
  UsageStats,
  ChatMessage,
  MessageContent,
  ImageAttachment,
  ContentBlock,
  Storyboard,
} from '@/lib/agents/types'
import { messageContentToText } from '@/lib/agents/types'
import { resizeImage, validateImage, MAX_IMAGE_DIMENSION } from '@/lib/image-utils'
import { AGENT_COLORS, AGENT_LABELS } from '@/lib/agents/prompts'
import { API_DISPLAY_NAMES } from '@/lib/permissions'
import { ThinkingBlock } from './ThinkingBlock'
import GenerationConfirmCard from './GenerationConfirmCard'
import StoryboardReviewCard from './StoryboardReviewCard'
import { v4 as uuidv4 } from 'uuid'
import { syncSceneGraphWithScenes } from '@/lib/scene-graph-sync'

type BrowserSpeechRecognition = {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((ev: BrowserSpeechResultEvent) => void) | null
  onerror: ((ev: { error: string }) => void) | null
  onend: (() => void) | null
}

type BrowserSpeechResultEvent = {
  resultIndex: number
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>
}

function getSpeechRecognitionCtor(): (new () => BrowserSpeechRecognition) | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: new () => BrowserSpeechRecognition
    webkitSpeechRecognition?: new () => BrowserSpeechRecognition
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

function parseAgentSseEvent(jsonStr: string, label: string): SSEEvent | null {
  try {
    return JSON.parse(jsonStr) as SSEEvent
  } catch (e) {
    console.warn(
      `[AgentChat] SSE JSON parse failed (${label}):`,
      (e as Error).message,
      `len=${jsonStr.length}`,
      jsonStr.slice(0, 160),
    )
    return null
  }
}

// ── Lightweight inline markdown renderer ────────────────────────────────────

function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n')
  const result: React.ReactNode[] = []

  for (let i = 0; i < lines.length; i++) {
    if (i > 0) result.push(<br key={`br-${i}`} />)
    const parts = parseInline(lines[i], i)
    result.push(...parts)
  }
  return result
}

function parseInline(text: string, lineIdx: number): React.ReactNode[] {
  const re = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g
  const nodes: React.ReactNode[] = []
  let last = 0
  let match: RegExpExecArray | null
  let k = 0

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push(text.slice(last, match.index))
    }
    if (match[2] != null) {
      nodes.push(<strong key={`${lineIdx}-b-${k++}`}>{match[2]}</strong>)
    } else if (match[3] != null) {
      nodes.push(<em key={`${lineIdx}-i-${k++}`}>{match[3]}</em>)
    } else if (match[4] != null) {
      nodes.push(
        <code key={`${lineIdx}-c-${k++}`} className="px-1 py-0.5 rounded text-[12px] bg-[var(--color-panel)] font-mono">
          {match[4]}
        </code>,
      )
    }
    last = match.index + match[0].length
  }

  if (last < text.length) {
    nodes.push(text.slice(last))
  }
  return nodes
}

// ── Image preview lightbox ──────────────────────────────────────────────────

interface PreviewImage {
  src: string
  alt?: string
  width?: number
  height?: number
}

function ImageLightbox({ image, onClose }: { image: PreviewImage; onClose: () => void }) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative max-w-[90vw] max-h-[90vh] flex flex-col items-center gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={image.src}
          alt={image.alt ?? 'Preview'}
          className="max-w-[90vw] max-h-[80vh] object-contain rounded-lg shadow-2xl"
        />
        <div className="flex items-center gap-3 text-white/60 text-xs">
          {image.alt && <span>{image.alt}</span>}
          {image.width && image.height && (
            <span>
              {image.width} x {image.height}
            </span>
          )}
        </div>
        <span
          onClick={onClose}
          className="absolute -top-2 -right-2 bg-white/10 hover:bg-white/20 rounded-full p-1.5 cursor-pointer transition-colors"
        >
          <X size={16} className="text-white" />
        </span>
      </div>
    </div>
  )
}

// ── Thinking dots animation (. .. ... .. . ...) ──────────────────────────────

function ThinkingDots() {
  const [frame, setFrame] = useState(0)
  const patterns = ['.', '..', '...', '..', '.', '']
  useEffect(() => {
    const id = setInterval(() => setFrame((f) => (f + 1) % patterns.length), 400)
    return () => clearInterval(id)
  }, [])
  return <span className="inline-block w-[1.2em] text-left">{patterns[frame]}</span>
}

const SPEECH_RECOGNITION_LANGUAGES: { code: string; label: string }[] = [
  { code: 'en-US', label: 'English (United States)' },
  { code: 'en-GB', label: 'English (United Kingdom)' },
  { code: 'en-AU', label: 'English (Australia)' },
  { code: 'en-IN', label: 'English (India)' },
  { code: 'es-ES', label: 'Spanish (Spain)' },
  { code: 'es-MX', label: 'Spanish (Mexico)' },
  { code: 'es-US', label: 'Spanish (United States)' },
  { code: 'fr-FR', label: 'French (France)' },
  { code: 'fr-CA', label: 'French (Canada)' },
  { code: 'de-DE', label: 'German (Germany)' },
  { code: 'it-IT', label: 'Italian (Italy)' },
  { code: 'pt-BR', label: 'Portuguese (Brazil)' },
  { code: 'pt-PT', label: 'Portuguese (Portugal)' },
  { code: 'nl-NL', label: 'Dutch (Netherlands)' },
  { code: 'pl-PL', label: 'Polish (Poland)' },
  { code: 'ru-RU', label: 'Russian (Russia)' },
  { code: 'uk-UA', label: 'Ukrainian (Ukraine)' },
  { code: 'ja-JP', label: 'Japanese (Japan)' },
  { code: 'ko-KR', label: 'Korean (Korea)' },
  { code: 'zh-CN', label: 'Chinese (Mandarin, China)' },
  { code: 'zh-TW', label: 'Chinese (Taiwan)' },
  { code: 'yue-Hant-HK', label: 'Chinese (Cantonese, Hong Kong)' },
  { code: 'hi-IN', label: 'Hindi (India)' },
  { code: 'bn-IN', label: 'Bengali (India)' },
  { code: 'ta-IN', label: 'Tamil (India)' },
  { code: 'te-IN', label: 'Telugu (India)' },
  { code: 'ar-SA', label: 'Arabic (Saudi Arabia)' },
  { code: 'he-IL', label: 'Hebrew (Israel)' },
  { code: 'tr-TR', label: 'Turkish (Turkey)' },
  { code: 'sv-SE', label: 'Swedish (Sweden)' },
  { code: 'no-NO', label: 'Norwegian (Norway)' },
  { code: 'da-DK', label: 'Danish (Denmark)' },
  { code: 'fi-FI', label: 'Finnish (Finland)' },
  { code: 'el-GR', label: 'Greek (Greece)' },
  { code: 'cs-CZ', label: 'Czech (Czechia)' },
  { code: 'sk-SK', label: 'Slovak (Slovakia)' },
  { code: 'hu-HU', label: 'Hungarian (Hungary)' },
  { code: 'ro-RO', label: 'Romanian (Romania)' },
  { code: 'bg-BG', label: 'Bulgarian (Bulgaria)' },
  { code: 'hr-HR', label: 'Croatian (Croatia)' },
  { code: 'sr-RS', label: 'Serbian (Serbia)' },
  { code: 'sl-SI', label: 'Slovenian (Slovenia)' },
  { code: 'vi-VN', label: 'Vietnamese (Vietnam)' },
  { code: 'th-TH', label: 'Thai (Thailand)' },
  { code: 'id-ID', label: 'Indonesian (Indonesia)' },
  { code: 'ms-MY', label: 'Malay (Malaysia)' },
  { code: 'fil-PH', label: 'Filipino (Philippines)' },
]

const VOICE_WAVE_BAR_COUNT = 18

type VoiceMeterRefs = {
  ctx: AudioContext | null
  stream: MediaStream | null
  analyser: AnalyserNode | null
  data: Uint8Array | null
}

function getAudioContextCtor(): typeof AudioContext | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { webkitAudioContext?: typeof AudioContext }
  return window.AudioContext ?? w.webkitAudioContext ?? null
}

function VoiceWaveformVisual({ active }: { active: boolean }) {
  const [liveLevels, setLiveLevels] = useState<number[] | null>(null)
  const rafRef = useRef(0)
  const meterRef = useRef<VoiceMeterRefs>({ ctx: null, stream: null, analyser: null, data: null })

  useEffect(() => {
    if (!active) {
      cancelAnimationFrame(rafRef.current)
      const m = meterRef.current
      m.stream?.getTracks().forEach((t) => t.stop())
      void m.ctx?.close()
      meterRef.current = { ctx: null, stream: null, analyser: null, data: null }
      setLiveLevels(null)
      return
    }

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setLiveLevels(null)
      return
    }

    let cancelled = false
    let frame = 0

    const teardown = () => {
      cancelAnimationFrame(rafRef.current)
      const m = meterRef.current
      m.stream?.getTracks().forEach((t) => t.stop())
      void m.ctx?.close()
      meterRef.current = { ctx: null, stream: null, analyser: null, data: null }
    }

    ;(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }

        const AC = getAudioContextCtor()
        if (!AC) {
          stream.getTracks().forEach((t) => t.stop())
          setLiveLevels(null)
          return
        }

        const ctx = new AC()
        if (ctx.state === 'suspended') await ctx.resume()

        const source = ctx.createMediaStreamSource(stream)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 256
        analyser.minDecibels = -82
        analyser.maxDecibels = -28
        analyser.smoothingTimeConstant = 0.72
        source.connect(analyser)

        const data = new Uint8Array(analyser.frequencyBinCount)
        meterRef.current = { ctx, stream, analyser, data }

        // Weight toward ~speech band (lower bins); upper bins stay mostly quiet for voice
        const bandEnd = Math.max(VOICE_WAVE_BAR_COUNT, Math.floor(data.length * 0.72))
        const step = Math.max(1, Math.floor(bandEnd / VOICE_WAVE_BAR_COUNT))

        const tick = () => {
          if (cancelled) return
          const { analyser: an, data: buf } = meterRef.current
          if (!an || !buf) return
          an.getByteFrequencyData(buf)
          frame += 1
          if (frame % 2 !== 0) {
            rafRef.current = requestAnimationFrame(tick)
            return
          }
          const levels: number[] = []
          for (let i = 0; i < VOICE_WAVE_BAR_COUNT; i++) {
            let sum = 0
            const start = i * step
            for (let j = 0; j < step && start + j < bandEnd; j++) {
              sum += buf[start + j]!
            }
            const avg = sum / step / 255
            levels.push(Math.min(1, Math.pow(avg * 2.1, 0.58)))
          }
          setLiveLevels(levels)
          rafRef.current = requestAnimationFrame(tick)
        }
        rafRef.current = requestAnimationFrame(tick)
      } catch {
        if (!cancelled) setLiveLevels(null)
      }
    })()

    return () => {
      cancelled = true
      teardown()
      setLiveLevels(null)
    }
  }, [active])

  return (
    <div
      className={`flex h-7 items-end gap-[2px] px-1.5 py-0.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] ${active ? 'cench-voice-wave--active' : 'cench-voice-wave--idle'}`}
      aria-hidden
    >
      {liveLevels
        ? liveLevels.map((lv, i) => (
            <span
              key={i}
              className="cench-voice-wave-bar cench-voice-wave-bar--metered"
              style={{ transform: `scaleY(${0.1 + lv * 0.9})` }}
            />
          ))
        : Array.from({ length: VOICE_WAVE_BAR_COUNT }, (_, i) => (
            <span
              key={i}
              className="cench-voice-wave-bar"
              style={{
                animationDelay: `${i * 38}ms`,
                ['--cench-voice-dur' as string]: active ? `${0.32 + (i % 9) * 0.034}s` : `${0.88 + (i % 7) * 0.06}s`,
              }}
            />
          ))}
    </div>
  )
}

function SpeechWaveformLangControl({
  active,
  speechSupported,
  speechLang,
  showMenu,
  setShowMenu,
  onSelectLang,
  onOpenMenu,
}: {
  active: boolean
  speechSupported: boolean
  speechLang: string
  showMenu: boolean
  setShowMenu: (v: boolean) => void
  onSelectLang: (code: string) => void
  onOpenMenu?: () => void
}) {
  const currentLabel = SPEECH_RECOGNITION_LANGUAGES.find((l) => l.code === speechLang)?.label ?? speechLang
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        disabled={!speechSupported}
        onClick={(e) => {
          e.stopPropagation()
          const next = !showMenu
          if (next) onOpenMenu?.()
          setShowMenu(next)
        }}
        className={`rounded-lg transition-opacity no-style p-0 border-0 bg-transparent ${speechSupported ? 'cursor-pointer hover:opacity-95' : 'cursor-not-allowed opacity-40'}`}
        aria-haspopup="listbox"
        aria-expanded={showMenu}
        aria-label={`Speech recognition language: ${currentLabel}. Click to change.`}
      >
        <VoiceWaveformVisual active={active} />
      </button>
      {showMenu && speechSupported && (
        <>
          <div className="fixed inset-0 z-[92]" aria-hidden onClick={() => setShowMenu(false)} />
          <div
            role="listbox"
            aria-label="Speech language"
            className="absolute bottom-full left-0 mb-1 z-[101] max-h-52 w-[min(16rem,calc(100vw-2rem))] overflow-y-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] shadow-2xl py-1"
          >
            {SPEECH_RECOGNITION_LANGUAGES.map((l) => (
              <button
                key={l.code}
                type="button"
                role="option"
                aria-selected={l.code === speechLang}
                onClick={() => onSelectLang(l.code)}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-[11px] text-[var(--color-text-primary)] hover:bg-white/10 no-style cursor-pointer"
              >
                <span className="flex-1 min-w-0">{l.label}</span>
                <span className="text-[9px] text-[var(--color-text-muted)] shrink-0 font-mono">{l.code}</span>
                {l.code === speechLang && (
                  <Check size={12} className="shrink-0 text-[var(--color-accent)]" strokeWidth={2.5} />
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Message Actions (thumbs + ellipsis menu) ─────────────────────────────────

function MessageActions({
  msg,
  onRate,
  onDetails,
  conversationId,
}: {
  msg: ChatMessage
  onRate: (msgId: string, rating: number) => void
  onDetails: (msg: ChatMessage) => void
  conversationId?: string | null
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [copied, setCopied] = useState<'msg' | 'id' | false>(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  const handleCopy = () => {
    navigator.clipboard.writeText(messageContentToText(msg.content))
    setCopied('msg')
    setTimeout(() => {
      setCopied(false)
      setMenuOpen(false)
    }, 1200)
  }

  const handleCopyConversationId = () => {
    if (conversationId) {
      navigator.clipboard.writeText(conversationId)
      setCopied('id')
      setTimeout(() => {
        setCopied(false)
        setMenuOpen(false)
      }, 1200)
    }
  }

  const handleDetails = () => {
    setMenuOpen(false)
    onDetails(msg)
  }

  const rating = msg.userRating

  const isDetails = msg.id.startsWith('details:')
  const { removeChatMessage } = useVideoStore()

  if (isDetails) {
    return (
      <div className="flex items-center justify-end px-1 mt-1.5 leading-none">
        <span
          onClick={() => removeChatMessage(msg.id)}
          className="cursor-pointer select-none opacity-50 hover:opacity-100 transition-opacity"
          data-tooltip="Close details"
          data-tooltip-size="sm"
        >
          <X size={12} className="text-[var(--color-text-muted)]" />
        </span>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-end gap-2.5 px-1 mt-1.5">
      <span
        onClick={() => onRate(msg.id, rating === 5 ? 0 : 5)}
        className="cursor-pointer select-none"
        data-tooltip="Good response"
        data-tooltip-size="sm"
      >
        <ThumbsUp
          size={12}
          strokeWidth={rating === 5 ? 3 : 1.5}
          className="text-[var(--color-text-muted)] opacity-50 hover:opacity-100 transition-opacity"
        />
      </span>
      <span
        onClick={() => onRate(msg.id, rating === 1 ? 0 : 1)}
        className="cursor-pointer select-none"
        data-tooltip="Bad response"
        data-tooltip-size="sm"
      >
        <ThumbsDown
          size={12}
          strokeWidth={rating === 1 ? 3 : 1.5}
          className="text-[var(--color-text-muted)] opacity-50 hover:opacity-100 transition-opacity"
        />
      </span>
      <div className="relative" ref={menuRef}>
        <span
          onClick={() => setMenuOpen((o) => !o)}
          className="cursor-pointer select-none"
          data-tooltip="More"
          data-tooltip-size="sm"
        >
          <MoreHorizontal
            size={12}
            className="text-[var(--color-text-muted)] opacity-50 hover:opacity-100 transition-opacity"
          />
        </span>
        {menuOpen && (
          <div className="absolute top-full right-0 mt-1 px-2 py-1 rounded-md border border-[var(--color-border)] bg-[var(--color-panel)] shadow-lg z-50 space-y-0.5">
            <span
              onClick={handleCopy}
              className="block cursor-pointer text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors select-none whitespace-nowrap"
            >
              {copied === 'msg' ? 'Copied!' : 'Copy message'}
            </span>
            {conversationId && (
              <span
                onClick={handleCopyConversationId}
                className="block cursor-pointer text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors select-none whitespace-nowrap"
              >
                {copied === 'id' ? 'Copied!' : 'Copy conversation ID'}
              </span>
            )}
            <span
              onClick={handleDetails}
              className="block cursor-pointer text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors select-none whitespace-nowrap"
            >
              Details
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Tool Call Display ──────────────────────────────────────────────────────────

function ToolCallItem({ call }: { call: ToolCallRecord }) {
  const [open, setOpen] = useState(false)
  const isSuccess = call.output?.success
  const isError = call.output && !call.output.success

  return (
    <div className="mt-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] overflow-hidden text-[11px]">
      <span
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left hover:bg-[var(--color-border)]/20 transition-colors cursor-pointer select-none"
      >
        <span className="font-mono text-[var(--color-text-primary)] flex-1 truncate">{call.toolName}</span>
        {isSuccess && (
          <span className="flex items-center gap-1 text-emerald-400">
            <CheckCircle2 size={10} />
            <span className="text-[10px]">Done</span>
          </span>
        )}
        {isError && (
          <span className="flex items-center gap-1 text-red-400">
            <XCircle size={10} />
            <span className="text-[10px]">Error</span>
          </span>
        )}
        {call.durationMs !== undefined && (
          <span className="text-[var(--color-text-muted)] text-[10px]">
            {call.durationMs > 1000 ? `${(call.durationMs / 1000).toFixed(1)}s` : `${call.durationMs}ms`}
          </span>
        )}
        {open ? (
          <ChevronDown size={10} className="flex-shrink-0 text-[var(--color-text-muted)]" />
        ) : (
          <ChevronRight size={10} className="flex-shrink-0 text-[var(--color-text-muted)]" />
        )}
      </span>
      {open && (
        <div className="px-2.5 pb-2 space-y-1.5 border-t border-[var(--color-border)]">
          <div>
            <div className="text-[var(--color-text-muted)] text-[9px] mb-0.5 mt-1.5 uppercase tracking-wide">Input</div>
            <pre className="text-[10px] text-[var(--color-text-muted)] whitespace-pre-wrap font-mono overflow-x-auto max-h-28 bg-[var(--color-panel)] rounded p-1.5">
              {JSON.stringify(call.input, null, 2)}
            </pre>
          </div>
          {call.output && (
            <div>
              <div className="text-[var(--color-text-muted)] text-[9px] mb-0.5 uppercase tracking-wide">Output</div>
              <pre
                className={`text-[10px] whitespace-pre-wrap font-mono overflow-x-auto max-h-28 bg-[var(--color-panel)] rounded p-1.5 ${
                  call.output.success ? 'text-emerald-400/80' : 'text-red-400/80'
                }`}
              >
                {call.output.error
                  ? call.output.error
                  : JSON.stringify({ success: call.output.success, changes: call.output.changes }, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Usage Badge ───────────────────────────────────────────────────────────────

function UsageBadge({ usage }: { usage: UsageStats }) {
  const formatCost = (cost: number) => {
    if (cost < 0.001) return `<$0.001`
    if (cost < 0.01) return `$${cost.toFixed(4)}`
    return `$${cost.toFixed(3)}`
  }

  return (
    <div className="flex items-center gap-2 px-1 mt-1.5 text-[10px] text-[var(--color-text-muted)] font-mono opacity-60">
      <span>{usage.inputTokens.toLocaleString()} in</span>
      <span className="opacity-40">/</span>
      <span>{usage.outputTokens.toLocaleString()} out</span>
      <span className="opacity-40">|</span>
      <span className="text-[var(--color-accent)]">{formatCost(usage.costUsd)}</span>
      {usage.totalDurationMs && (
        <>
          <span className="opacity-40">|</span>
          <span>{(usage.totalDurationMs / 1000).toFixed(1)}s</span>
        </>
      )}
    </div>
  )
}

// ── Model tier options ──────────────────────────────────────────────────────────

const MODEL_OPTIONS: { id: ModelTier; modelName: string; tierLabel: string }[] = [
  { id: 'auto', modelName: 'Auto', tierLabel: 'Balanced' },
  { id: 'premium', modelName: 'Premium', tierLabel: 'Most capable' },
  { id: 'budget', modelName: 'Budget', tierLabel: 'Cheapest' },
]

// ── Agent mode options ──────────────────────────────────────────────────────────

const AGENT_OPTIONS: { id: AgentType | null; label: string; desc: string; icon: typeof Infinity; color: string }[] = [
  { id: null, label: 'Agent', desc: 'Auto-routes to the right agent', icon: Infinity, color: '#6b7280' },
  {
    id: 'planner',
    label: 'Planner',
    desc: 'Storyboard only — review before build',
    icon: ListOrdered,
    color: AGENT_COLORS['planner'],
  },
  { id: 'director', label: 'Director', desc: 'Plans multi-scene videos', icon: Film, color: AGENT_COLORS['director'] },
  {
    id: 'scene-maker',
    label: 'Scene Maker',
    desc: 'Generates scene content',
    icon: Zap,
    color: AGENT_COLORS['scene-maker'],
  },
  { id: 'editor', label: 'Editor', desc: 'Surgical edits', icon: Scissors, color: AGENT_COLORS['editor'] },
  { id: 'dop', label: 'DoP', desc: 'Global style & transitions', icon: Palette, color: AGENT_COLORS['dop'] },
  // Specialized animation agents
  { id: 'scene-maker', label: 'SVG Artist', desc: 'SVG illustration specialist', icon: PenLine, color: '#f472b6' },
  {
    id: 'scene-maker',
    label: 'Canvas Animator',
    desc: 'Canvas2D & generative art',
    icon: Paintbrush,
    color: '#38bdf8',
  },
  { id: 'scene-maker', label: 'D3 Analyst', desc: 'Data charts & visualization', icon: BarChart2, color: '#4ade80' },
  { id: 'scene-maker', label: '3D Designer', desc: 'Three.js 3D scenes', icon: Box, color: '#c084fc' },
  { id: 'scene-maker', label: 'Motion Designer', desc: 'Choreographed animations', icon: Sparkles, color: '#fbbf24' },
  { id: 'scene-maker', label: 'Zdog Artist', desc: 'Pseudo-3D illustrations', icon: Box, color: '#f97316' },
]

// ── Keyword guard map ────────────────────────────────────────────────────────────

const CAPABILITY_KEYWORDS: Record<string, string[]> = {
  avatars: ['heygen', 'avatar', 'talking head'],
  'ai-video': ['veo3', 'veo', 'ai video', 'generate video'],
  three: ['3d', 'three.js', 'threejs', '3d scene', '3d object'],
  d3: ['d3 chart', 'bar chart', 'line chart', 'pie chart', 'scatter plot', 'data visualization'],
  'ai-images': ['generate image', 'ai image', 'flux', 'dall-e', 'ideogram', 'recraft'],
  lottie: ['lottie', 'lottie animation'],
  zdog: ['zdog', 'pseudo-3d', 'pseudo 3d', 'isometric illustration'],
  interactions: ['hotspot', 'quiz', 'branching', 'interactive'],
}

// ── Props ────────────────────────────────────────────────────────────────────────

interface Props {
  scene: Scene
  onOpenEditor?: () => void
}

export default function AgentChat({ scene, onOpenEditor }: Props) {
  const {
    updateScene,
    scenes,
    globalStyle,
    project,
    selectedSceneId,
    agentOverride,
    setAgentOverride,
    modelTier,
    setModelTier,
    thinkingMode,
    setThinkingMode,
    modelOverride,
    setModelOverride,
    modelConfigs,
    sceneContext,
    activeTools,
    toggleActiveTool,
    setSettingsTab,
    audioProviderEnabled,
    toggleAudioProvider,
    mediaGenEnabled,
    toggleMediaGen,
    sessionPermissions,
    setSessionPermission,
    generationOverrides,
    setGenerationOverride,
    autoChooseDefaults,
    setAutoChooseDefault,
    planFirstMode,
    setPlanFirstMode,
    pausedAgentRun,
    setPausedAgentRun,
    runCheckpoint,
    setRunCheckpoint,
    chatMessages,
    addChatMessage,
    updateChatMessage,
    persistChatMessage,
    clearChat,
    conversations,
    activeConversationId,
    newConversation,
    switchConversation,
    renameConversation,
    deleteConversation,
  } = useVideoStore()

  const [input, setInput] = useState('')
  const [showModelMenu, setShowModelMenu] = useState(false)
  const [showAgentMenu, setShowAgentMenu] = useState(false)
  const [keywordWarning, setKeywordWarning] = useState<{ capability: string; label: string } | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const [showEllipsisMenu, setShowEllipsisMenu] = useState(false)
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [activeToolName, setActiveToolName] = useState<string | null>(null)
  const [streamingThinking, setStreamingThinking] = useState('')
  const [isThinkingStreaming, setIsThinkingStreaming] = useState(false)
  const [streamingToolCalls, setStreamingToolCalls] = useState<ToolCallRecord[]>([])
  const [currentIteration, setCurrentIteration] = useState<{ iteration: number; max: number } | null>(null)
  const [pendingImages, setPendingImages] = useState<ImageAttachment[]>([])
  const [previewImage, setPreviewImage] = useState<PreviewImage | null>(null)
  const [isDraggingImage, setIsDraggingImage] = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const speechRecognitionRef = useRef<BrowserSpeechRecognition | null>(null)
  const speechBaseRef = useRef('')
  const speechFinalRef = useRef('')

  const [isListening, setIsListening] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)
  const [showSpeechLangMenu, setShowSpeechLangMenu] = useState(false)
  const [speechLang, setSpeechLang] = useState('en-US')

  useEffect(() => {
    setSpeechSupported(!!getSpeechRecognitionCtor())
  }, [])

  useEffect(() => {
    try {
      const s = localStorage.getItem('cench-agent-speech-lang')
      if (s) {
        setSpeechLang(s)
        return
      }
    } catch {}
    if (typeof navigator !== 'undefined' && navigator.language) {
      setSpeechLang(navigator.language)
    }
  }, [])

  useEffect(() => {
    return () => {
      try {
        speechRecognitionRef.current?.abort()
      } catch {}
      speechRecognitionRef.current = null
    }
  }, [])

  const messages = chatMessages

  const handleRate = useCallback(
    (msgId: string, rating: number) => {
      const freshMessages = useVideoStore.getState().chatMessages
      const msg = freshMessages.find((m) => m.id === msgId)
      if (!msg) return

      const effectiveRating = rating === 0 ? undefined : rating
      updateChatMessage(msgId, { userRating: effectiveRating })

      // Persist rating to generation log
      if (msg.generationLogId && rating > 0) {
        fetch('/api/generation-log', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ logId: msg.generationLogId, userRating: rating }),
        }).catch((err) => console.error('[AgentChat] Failed to send feedback:', err))
      }

      // Persist rating to message in DB
      const conversationId = useVideoStore.getState().activeConversationId
      if (conversationId) {
        fetch(`/api/conversations/${conversationId}/messages`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messageId: msgId, userRating: effectiveRating ?? null }),
        }).catch((err) => console.error('[AgentChat] Failed to persist rating:', err))
      }
    },
    [updateChatMessage],
  )

  const persistPausedAgentRun = useCallback(
    async (
      paused: {
        toolName: string
        toolInput: Record<string, unknown>
        agentType?: string | null
        reason?: string | null
        createdAt: string
      } | null,
    ) => {
      setPausedAgentRun(paused)
      if (!project?.id) return
      try {
        await fetch(`/api/projects/${project.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pausedAgentRun: paused }),
        })
      } catch (e) {
        console.error('[AgentChat] Failed to persist pausedAgentRun:', e)
      }
    },
    [project?.id, setPausedAgentRun],
  )

  const handlePermission = useCallback(
    (msgId: string, api: string, decision: 'allow' | 'deny') => {
      setSessionPermission(api, decision)
      const freshMessages = useVideoStore.getState().chatMessages
      const msg = freshMessages.find((m) => m.id === msgId)
      if (!msg?.pendingPermissions) return
      const updated = msg.pendingPermissions.map((p) => (p.api === api ? { ...p, resolved: decision } : p))
      updateChatMessage(msgId, { pendingPermissions: updated })
      if (decision === 'deny') {
        void persistPausedAgentRun(null)
      }
    },
    [setSessionPermission, updateChatMessage, persistPausedAgentRun],
  )

  const handleDetails = useCallback(
    (msg: ChatMessage) => {
      const freshMessages = useVideoStore.getState().chatMessages
      const detailTag = `details:${msg.id}`
      if (freshMessages.some((m) => m.id === detailTag)) return

      const u = msg.usage
      const lines: string[] = ['--- Generation Details ---']
      if (msg.agentType) lines.push(`Agent: ${msg.agentType}`)
      if (msg.modelId) lines.push(`Model: ${msg.modelId}`)
      if (u) {
        lines.push(`Input tokens: ${u.inputTokens.toLocaleString()}`)
        lines.push(`Output tokens: ${u.outputTokens.toLocaleString()}`)
        lines.push(`Total tokens: ${(u.inputTokens + u.outputTokens).toLocaleString()}`)
        lines.push(`Cost: $${u.costUsd.toFixed(4)}`)
        lines.push(`API calls: ${u.apiCalls}`)
        lines.push(`Duration: ${(u.totalDurationMs / 1000).toFixed(1)}s`)
      }
      if (!u && !msg.agentType) lines.push('No usage data available for this message.')

      addChatMessage({
        id: detailTag,
        role: 'assistant' as const,
        content: lines.join('\n'),
        timestamp: Date.now(),
      })
    },
    [addChatMessage],
  )

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, streamingText])

  // ── Keyword guard ──────────────────────────────────────────────────────────

  const checkKeywordGuard = useCallback(
    (text: string): { capability: string; label: string } | null => {
      const lower = text.toLowerCase()
      for (const [capId, keywords] of Object.entries(CAPABILITY_KEYWORDS)) {
        if (!activeTools.includes(capId)) {
          for (const kw of keywords) {
            if (lower.includes(kw)) {
              const chip = TOOL_FILTER_CHIPS.find((c) => c.id === capId)
              return { capability: capId, label: chip?.label ?? capId }
            }
          }
        }
      }
      return null
    },
    [activeTools],
  )

  const handleImageFile = useCallback(async (file: File) => {
    const validation = validateImage(file)
    if (!validation.valid) return // silently skip invalid files
    try {
      const resized = await resizeImage(file, MAX_IMAGE_DIMENSION)
      setPendingImages((prev) => [
        ...prev,
        {
          dataUri: resized.dataUri,
          mimeType: resized.mimeType as ImageAttachment['mimeType'],
          fileName: file.name,
          width: resized.width,
          height: resized.height,
        },
      ])
    } catch {
      // Failed to process image — skip
    }
  }, [])

  const runAgentStream = useCallback(
    async (opts: {
      messageContent: MessageContent
      pendingAssistantMsg: ChatMessage
      forceAgentOverride?: AgentType
      initialStoryboard?: Storyboard | null
      resumeToolCall?: { toolName: string; toolInput: Record<string, unknown> } | null
      clearPendingStoryboardOnDone?: boolean
      extraBody?: Record<string, unknown>
    }) => {
      const {
        messageContent,
        pendingAssistantMsg,
        forceAgentOverride,
        initialStoryboard,
        resumeToolCall,
        clearPendingStoryboardOnDone,
        extraBody,
      } = opts
      const isBuildRun = !!initialStoryboard

      setIsGenerating(true)
      setStreamingText('')
      setStreamingThinking('')
      setIsThinkingStreaming(false)
      setStreamingToolCalls([])
      setCurrentIteration(null)

      const st = useVideoStore.getState()
      const historyMsgs = st.chatMessages.slice(-10).map((m) => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        timestamp: m.timestamp,
      }))

      const controller = new AbortController()
      abortRef.current = controller

      let accumulatedText = ''
      let thinkingAccumulated = ''
      let finalAgentType: AgentType | undefined
      let finalModelId: string | undefined
      let finalUsage: UsageStats | undefined
      let finalGenerationLogId: string | undefined
      const toolCalls: ToolCallRecord[] = []
      const pendingPermissions: import('@/lib/agents/types').PendingPermission[] = []

      try {
        const lightScenes = st.scenes.map((s) => {
          if (s.id === scene.id) return s
          const { sceneHTML, svgContent, canvasCode, sceneCode, lottieSource, ...rest } = s
          return {
            ...rest,
            svgContent: svgContent ? `[${svgContent.length} chars]` : '',
            canvasCode: canvasCode ? `[${canvasCode.length} chars]` : '',
            sceneCode: sceneCode ? `[${sceneCode.length} chars]` : '',
            lottieSource: lottieSource ? `[${lottieSource.length} chars]` : '',
            sceneHTML: '',
          }
        })

        const apiAgentOverride = forceAgentOverride ?? st.agentOverride ?? undefined

        const fetchBody = JSON.stringify({
          message: messageContent,
          agentOverride: apiAgentOverride,
          modelOverride: st.modelOverride ?? undefined,
          modelTier: st.modelTier,
          thinkingMode: st.thinkingMode,
          sceneContext: st.sceneContext,
          activeTools: st.activeTools,
          history: historyMsgs,
          projectId: st.project.id,
          conversationId: st.activeConversationId,
          scenes: lightScenes,
          globalStyle: st.globalStyle,
          projectName: st.project.name,
          outputMode: st.project.outputMode,
          sceneGraph: st.project.sceneGraph,
          selectedSceneId: scene.id,
          audioProviderEnabled: st.audioProviderEnabled,
          mediaGenEnabled: st.mediaGenEnabled,
          apiPermissions: st.project.apiPermissions,
          sessionPermissions: Object.fromEntries(st.sessionPermissions),
          generationOverrides: st.generationOverrides,
          autoChooseDefaults: st.autoChooseDefaults,
          ...(initialStoryboard ? { initialStoryboard } : {}),
          ...(resumeToolCall ? { resumeToolCall } : {}),
          ...(extraBody ?? {}),
        })

        let response: Response
        try {
          response = await fetch('/api/agent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: fetchBody,
            signal: controller.signal,
          })
        } catch (fetchErr) {
          if (fetchErr instanceof DOMException && fetchErr.name === 'AbortError') throw fetchErr
          await new Promise((r) => setTimeout(r, 1000))
          response = await fetch('/api/agent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: fetchBody,
            signal: controller.signal,
          })
        }

        if (!response.ok) {
          throw new Error(`Agent error: ${response.statusText}`)
        }

        const reader = response.body!.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const jsonStr = line.slice(6).trim()
            if (!jsonStr) continue

            const event = parseAgentSseEvent(jsonStr, 'stream')
            if (!event) continue

            switch (event.type) {
              case 'run_start':
                if (event.runId) console.log(`[AgentChat] Run started: ${event.runId}`)
                break

              case 'thinking_start':
                thinkingAccumulated = ''
                setIsThinkingStreaming(true)
                setStreamingThinking('')
                break

              case 'thinking_token':
                if (event.token) {
                  thinkingAccumulated += event.token
                  setStreamingThinking(thinkingAccumulated)
                }
                break

              case 'thinking_complete':
                setIsThinkingStreaming(false)
                if (event.fullThinking) {
                  thinkingAccumulated = event.fullThinking
                  setStreamingThinking(event.fullThinking)
                }
                break

              case 'token':
                if (event.token) {
                  accumulatedText += event.token
                  setStreamingText(accumulatedText)
                }
                break

              case 'iteration_start':
                if (event.iteration && event.maxIterations) {
                  setCurrentIteration({ iteration: event.iteration, max: event.maxIterations })
                }
                break

              case 'tool_start':
                setActiveToolName(event.toolName ?? null)
                break

              case 'tool_complete':
                if (event.toolResult) {
                  const callRecord: ToolCallRecord = {
                    id: uuidv4(),
                    toolName: event.toolName ?? 'unknown',
                    input: event.toolInput ?? {},
                    output: event.toolResult,
                  }
                  toolCalls.push(callRecord)
                  setStreamingToolCalls((prev) => [...prev, callRecord])
                  if (
                    event.toolName === 'plan_scenes' &&
                    event.toolResult.success &&
                    event.toolResult.data &&
                    typeof event.toolResult.data === 'object' &&
                    event.toolResult.data !== null &&
                    'storyboard' in (event.toolResult.data as object)
                  ) {
                    const sb = (event.toolResult.data as { storyboard?: Storyboard }).storyboard
                    if (sb) {
                      if (!isBuildRun) {
                        useVideoStore.getState().setPendingStoryboard(sb)
                        useVideoStore.getState().setStoryboardProposed(sb)
                        useVideoStore.getState().setPlanFirstMode(false)
                      }
                    }
                  }
                  // Client-side frame capture for agent visual feedback
                  if (
                    event.toolName === 'capture_frame' &&
                    event.toolResult.success &&
                    event.toolResult.data &&
                    typeof event.toolResult.data === 'object' &&
                    (event.toolResult.data as any).clientAction === 'capture_frame'
                  ) {
                    const { sceneId: capSceneId, time: capTime } = event.toolResult.data as {
                      sceneId: string
                      time: number
                    }
                    // Fire async capture — store result for next agent turn
                    useVideoStore
                      .getState()
                      .captureSceneFrame(capSceneId, capTime)
                      .then((dataUrl) => {
                        if (dataUrl) {
                          // Store the captured frame so it can be referenced
                          ;(useVideoStore as any)._lastCapturedFrame = {
                            sceneId: capSceneId,
                            time: capTime,
                            dataUrl,
                            timestamp: Date.now(),
                          }
                        }
                      })
                      .catch(() => {})
                  }
                  if (event.toolResult.permissionNeeded) {
                    const pn = event.toolResult.permissionNeeded
                    const alreadyTracked = pendingPermissions.some((p) => p.api === pn.api)
                    if (!alreadyTracked) {
                      pendingPermissions.push({
                        api: pn.api,
                        estimatedCost: pn.estimatedCost,
                        toolName: event.toolName ?? 'unknown',
                        generationType: pn.generationType,
                        prompt: pn.prompt,
                        provider: pn.provider,
                        availableProviders: pn.availableProviders,
                        config: pn.config,
                        toolArgs: pn.toolArgs,
                      })
                    }
                    if (event.toolName && event.toolInput) {
                      void persistPausedAgentRun({
                        toolName: event.toolName,
                        toolInput: event.toolInput,
                        agentType: forceAgentOverride ?? st.agentOverride ?? null,
                        reason: `permission:${pn.api}`,
                        createdAt: new Date().toISOString(),
                      })
                    }
                  }
                }
                setActiveToolName(null)
                break

              case 'storyboard_proposed':
                if (event.storyboard) {
                  if (!isBuildRun) {
                    useVideoStore.getState().setPendingStoryboard(event.storyboard)
                    useVideoStore.getState().setStoryboardProposed(event.storyboard)
                    useVideoStore.getState().setPlanFirstMode(false)
                  }
                }
                break

              case 'state_change':
                if (event.generationLogId) finalGenerationLogId = event.generationLogId
                if (event.updatedScenes && event.updatedGlobalStyle) {
                  const { syncScenesFromAgent, updateSceneGraph } = useVideoStore.getState()
                  syncScenesFromAgent(event.updatedScenes, event.updatedGlobalStyle)
                  const mergedGraph = syncSceneGraphWithScenes(
                    event.updatedScenes,
                    event.updatedSceneGraph ?? useVideoStore.getState().project.sceneGraph,
                  )
                  updateSceneGraph(mergedGraph)
                }
                break

              case 'done':
                setActiveToolName(null)
                finalAgentType = event.agentType
                finalModelId = event.modelId
                finalUsage = event.usage
                if (event.fullText) accumulatedText = event.fullText
                if (event.generationLogId) finalGenerationLogId = event.generationLogId
                if (resumeToolCall) {
                  void persistPausedAgentRun(null)
                }
                if (clearPendingStoryboardOnDone) {
                  useVideoStore.getState().setPendingStoryboard(null)
                }
                break

              case 'error':
                accumulatedText = `Error: ${event.error ?? 'Something went wrong'}`
                break
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          accumulatedText = `Failed: ${(err as Error).message}`
        }
      } finally {
        setIsGenerating(false)
        setStreamingText('')
        setStreamingThinking('')
        setIsThinkingStreaming(false)
        setStreamingToolCalls([])
        setCurrentIteration(null)
        abortRef.current = null

        updateChatMessage(pendingAssistantMsg.id, {
          content: accumulatedText || 'Done.',
          generationLogId: finalGenerationLogId,
          usage: finalUsage,
          agentType: finalAgentType,
          modelId: finalModelId as any,
          ...(toolCalls.length > 0 ? { toolCalls } : {}),
          ...(pendingPermissions.length > 0 ? { pendingPermissions } : {}),
          ...(thinkingAccumulated ? { thinking: thinkingAccumulated } : {}),
        })
        persistChatMessage(pendingAssistantMsg.id)
        void useVideoStore.getState().refreshProjectFromServer()
        setTimeout(() => {
          void useVideoStore.getState().refreshProjectFromServer()
        }, 2500)
      }
    },
    [scene.id, updateChatMessage, persistChatMessage, persistPausedAgentRun],
  )

  const continueAfterPermission = useCallback(
    async (msg: ChatMessage, api: string) => {
      if (isGenerating) return
      const perm = msg.pendingPermissions?.find((p) => p.api === api)
      if (!perm?.toolName || !perm.toolArgs) return

      await persistPausedAgentRun(null)

      const st = useVideoStore.getState()
      const pendingAssistantMsg: ChatMessage = {
        id: uuidv4(),
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
      }
      addChatMessage(pendingAssistantMsg)

      await runAgentStream({
        messageContent: 'Continue after permission approval.',
        pendingAssistantMsg,
        forceAgentOverride: (msg.agentType ?? st.agentOverride ?? 'director') as AgentType,
        resumeToolCall: { toolName: perm.toolName, toolInput: perm.toolArgs },
      })
    },
    [isGenerating, addChatMessage, runAgentStream, persistPausedAgentRun],
  )

  const handleResumePausedRun = useCallback(async () => {
    if (!pausedAgentRun || isGenerating) return
    await persistPausedAgentRun(null)
    const st = useVideoStore.getState()
    const pendingAssistantMsg: ChatMessage = {
      id: uuidv4(),
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    }
    addChatMessage(pendingAssistantMsg)
    await runAgentStream({
      messageContent: 'Continue paused run.',
      pendingAssistantMsg,
      forceAgentOverride: (pausedAgentRun.agentType as AgentType) ?? st.agentOverride ?? 'director',
      resumeToolCall: { toolName: pausedAgentRun.toolName, toolInput: pausedAgentRun.toolInput },
    })
  }, [pausedAgentRun, isGenerating, persistPausedAgentRun, addChatMessage, runAgentStream])

  const handleResumeCheckpoint = useCallback(async () => {
    if (!runCheckpoint || isGenerating) return
    const pendingAssistantMsg: ChatMessage = {
      id: uuidv4(),
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    }
    addChatMessage(pendingAssistantMsg)
    await runAgentStream({
      messageContent: `Resume interrupted build (${runCheckpoint.completedSceneIds.length} scenes done).`,
      pendingAssistantMsg,
      forceAgentOverride: runCheckpoint.agentType as AgentType,
      extraBody: { resumeCheckpoint: true },
    })
    setRunCheckpoint(null)
  }, [runCheckpoint, isGenerating, addChatMessage, runAgentStream, setRunCheckpoint])

  const handleDiscardCheckpoint = useCallback(async () => {
    if (!runCheckpoint) return
    const projectId = useVideoStore.getState().project.id
    if (projectId) {
      try {
        await fetch(`/api/projects/${projectId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ runCheckpoint: null }),
        })
      } catch (e) {
        console.error('[AgentChat] Failed to clear checkpoint:', e)
      }
    }
    setRunCheckpoint(null)
  }, [runCheckpoint, setRunCheckpoint])

  const handleApproveStoryboard = useCallback(async () => {
    const sb = useVideoStore.getState().pendingStoryboard
    if (!sb || isGenerating) return

    // Persist the approved plan, and clear the pending review state.
    try {
      const projectId = useVideoStore.getState().project.id
      if (projectId) {
        await fetch(`/api/projects/${projectId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            storyboardApplied: sb,
            storyboardProposed: null,
            storyboardEdited: null,
          }),
        })
      }
    } catch (e) {
      console.error('[AgentChat] Failed to persist approved storyboard:', e)
    }

    useVideoStore.getState().setPendingStoryboard(null)
    useVideoStore.getState().setStoryboardProposed(null)
    setPlanFirstMode(false)

    const buildText =
      'Implement this approved storyboard; create scenes and layers as specified. Follow the storyboard scene order, types, durations, and purposes.'
    const userMsg: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      content: buildText,
      timestamp: Date.now(),
    }
    addChatMessage(userMsg)
    const pendingAssistantMsg: ChatMessage = {
      id: uuidv4(),
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    }
    addChatMessage(pendingAssistantMsg)
    await runAgentStream({
      messageContent: buildText,
      pendingAssistantMsg,
      forceAgentOverride: 'director',
      initialStoryboard: sb,
      clearPendingStoryboardOnDone: false,
    })
  }, [isGenerating, addChatMessage, runAgentStream])

  const handleSend = useCallback(async () => {
    if ((!input.trim() && pendingImages.length === 0) || isGenerating) return

    try {
      speechRecognitionRef.current?.stop()
    } catch {}
    speechRecognitionRef.current = null
    setIsListening(false)

    if (!keywordWarning) {
      const warning = checkKeywordGuard(input)
      if (warning) {
        setKeywordWarning(warning)
        return
      }
    }
    setKeywordWarning(null)

    const userText = input.trim()
    const images = [...pendingImages]
    setInput('')
    setPendingImages([])
    setShowModelMenu(false)
    setShowAgentMenu(false)
    setShowSpeechLangMenu(false)

    let messageContent: MessageContent
    if (images.length > 0) {
      const blocks: ContentBlock[] = []
      for (const img of images) {
        blocks.push({ type: 'image', image: img })
      }
      if (userText) blocks.push({ type: 'text', text: userText })
      messageContent = blocks
    } else {
      messageContent = userText
    }

    const userMsg: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      content: messageContent,
      timestamp: Date.now(),
    }
    addChatMessage(userMsg)

    if (chatMessages.length === 0 && activeConversationId) {
      const autoTitle = userText.slice(0, 40) + (userText.length > 40 ? '...' : '')
      renameConversation(activeConversationId, autoTitle)
    }

    const pendingAssistantMsg: ChatMessage = {
      id: uuidv4(),
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    }
    addChatMessage(pendingAssistantMsg)
    updateScene(scene.id, { prompt: userText })

    const st = useVideoStore.getState()
    const forcePlanner =
      st.planFirstMode && !st.pendingStoryboard && images.length === 0 && st.agentOverride !== 'planner'
        ? ('planner' as AgentType)
        : undefined

    await runAgentStream({
      messageContent,
      pendingAssistantMsg,
      forceAgentOverride: forcePlanner,
    })
  }, [
    input,
    pendingImages,
    isGenerating,
    chatMessages,
    scene.id,
    keywordWarning,
    checkKeywordGuard,
    addChatMessage,
    updateChatMessage,
    renameConversation,
    activeConversationId,
    updateScene,
    runAgentStream,
  ])

  const handleAbort = () => {
    abortRef.current?.abort()
    setIsGenerating(false)
    setStreamingText('')

    try {
      speechRecognitionRef.current?.abort()
    } catch {}
    speechRecognitionRef.current = null
    setIsListening(false)
    setShowSpeechLangMenu(false)

    // Finalize any pending messages
    const pending = useVideoStore.getState().chatMessages.filter((m) => !m.content)
    for (const m of pending) {
      updateChatMessage(m.id, { content: 'Aborted.' })
    }
  }

  const stopVoiceInput = useCallback(() => {
    try {
      speechRecognitionRef.current?.stop()
    } catch {}
    speechRecognitionRef.current = null
    setIsListening(false)
    setShowSpeechLangMenu(false)
  }, [])

  const startVoiceInput = useCallback(
    (langOverride?: string) => {
      const Ctor = getSpeechRecognitionCtor()
      if (!Ctor || isGenerating) return

      const lang = langOverride ?? speechLang

      setShowModelMenu(false)
      setShowAgentMenu(false)
      setShowSpeechLangMenu(false)

      try {
        speechRecognitionRef.current?.abort()
      } catch {}
      speechRecognitionRef.current = null

      const rec = new Ctor()
      speechRecognitionRef.current = rec
      rec.continuous = true
      rec.interimResults = true
      rec.lang = lang

      speechBaseRef.current = input.trim() ? `${input.trim()} ` : ''
      speechFinalRef.current = ''

      rec.onresult = (event: BrowserSpeechResultEvent) => {
        let interim = ''
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const piece = event.results[i][0].transcript
          if (event.results[i].isFinal) {
            speechFinalRef.current += piece
          } else {
            interim += piece
          }
        }
        setInput(speechBaseRef.current + speechFinalRef.current + interim)
      }

      rec.onerror = (ev: { error: string }) => {
        if (ev.error !== 'aborted' && ev.error !== 'no-speech') {
          console.warn('[AgentChat] Speech recognition:', ev.error)
        }
        setIsListening(false)
        speechRecognitionRef.current = null
      }

      rec.onend = () => {
        setIsListening(false)
        speechRecognitionRef.current = null
      }

      try {
        rec.start()
        setIsListening(true)
      } catch (e) {
        console.warn('[AgentChat] Speech recognition start failed:', e)
        setIsListening(false)
        speechRecognitionRef.current = null
      }
    },
    [input, isGenerating, speechLang],
  )

  const toggleVoiceInput = useCallback(() => {
    if (isListening) {
      stopVoiceInput()
      return
    }
    startVoiceInput()
  }, [isListening, stopVoiceInput, startVoiceInput])

  const handleSelectSpeechLang = useCallback(
    (code: string) => {
      setSpeechLang(code)
      try {
        localStorage.setItem('cench-agent-speech-lang', code)
      } catch {}
      setShowSpeechLangMenu(false)
      if (isListening) {
        stopVoiceInput()
        window.setTimeout(() => startVoiceInput(code), 100)
      }
    },
    [isListening, stopVoiceInput, startVoiceInput],
  )

  // ── Derived state ──────────────────────────────────────────────────────────────

  // If user picked a specific model override, show that; otherwise show tier
  const overrideModel = modelOverride ? modelConfigs.find((m) => m.modelId === modelOverride) : null
  const currentModel = overrideModel
    ? { id: 'override' as ModelTier, modelName: overrideModel.displayName, tierLabel: 'Override' }
    : (MODEL_OPTIONS.find((m) => m.id === modelTier) ?? MODEL_OPTIONS[0])

  const currentAgent = AGENT_OPTIONS.find((a) => a.id === agentOverride) ?? AGENT_OPTIONS[0]
  const AgentIcon = currentAgent.icon

  // Separate core agents from specialized ones
  const coreAgents = AGENT_OPTIONS.slice(0, 6)
  const specializedAgents = AGENT_OPTIONS.slice(6)

  const canSend = !!input.trim() || pendingImages.length > 0

  const handleNewChat = () => {
    try {
      speechRecognitionRef.current?.abort()
    } catch {}
    speechRecognitionRef.current = null
    setIsListening(false)
    setShowSpeechLangMenu(false)
    if (project?.id) newConversation(project.id)
    setInput('')
    setStreamingText('')
    setKeywordWarning(null)
    useVideoStore.getState().setPendingStoryboard(null)
    useVideoStore.getState().setStoryboardProposed(null)
    setPlanFirstMode(false)
  }

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg)] overflow-hidden relative">
      {/* ── Chat Header: conversation tabs ── */}
      <div className="flex items-center px-2 py-1 flex-shrink-0 border-b border-[var(--color-border)] bg-[var(--color-bg)]">
        <div className="flex-1 flex items-center gap-0.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {conversations.map((conv) => (
            <span
              key={conv.id}
              onClick={() => conv.id !== activeConversationId && switchConversation(conv.id)}
              onDoubleClick={() => {
                setRenamingId(conv.id)
                setRenameValue(conv.title)
              }}
              className={`chat-tab relative overflow-hidden px-2 py-1 rounded text-[10px] whitespace-nowrap cursor-pointer select-none transition-all flex-shrink-0 outline-none ${
                conv.id === activeConversationId
                  ? 'bg-[var(--color-panel)] text-[var(--kbd-text)] border border-[var(--color-border)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--kbd-text)] hover:bg-[var(--color-panel)]/50 border border-transparent'
              }`}
              style={
                {
                  maxWidth: 120,
                  '--tab-bg': conv.id === activeConversationId ? 'var(--color-panel)' : 'var(--color-bg)',
                } as React.CSSProperties
              }
            >
              {conv.isPinned && <Pin size={7} className="opacity-40 inline mr-1" style={{ verticalAlign: '-1px' }} />}
              {renamingId === conv.id ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => {
                    renameConversation(conv.id, renameValue)
                    setRenamingId(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      renameConversation(conv.id, renameValue)
                      setRenamingId(null)
                    }
                    if (e.key === 'Escape') setRenamingId(null)
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-transparent border-b border-[var(--color-accent)] outline-none text-[10px] text-[var(--kbd-text)] w-20"
                />
              ) : (
                <span
                  className="inline-block align-bottom overflow-hidden whitespace-nowrap"
                  style={{
                    maxWidth: conv.id === activeConversationId ? '90px' : '100px',
                    WebkitMaskImage:
                      conv.id === activeConversationId
                        ? 'linear-gradient(to right, black 70px, transparent 90px)'
                        : 'linear-gradient(to right, black 80px, transparent 100px)',
                    maskImage:
                      conv.id === activeConversationId
                        ? 'linear-gradient(to right, black 70px, transparent 90px)'
                        : 'linear-gradient(to right, black 80px, transparent 100px)',
                  }}
                >
                  {conv.title}
                </span>
              )}
              {renamingId !== conv.id && (
                <span
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteConversation(conv.id)
                  }}
                  className="chat-tab-x"
                >
                  <X size={8} />
                </span>
              )}
            </span>
          ))}
        </div>

        {/* New chat button */}
        <span
          onClick={handleNewChat}
          className="flex items-center justify-center w-5 h-5 rounded text-[var(--color-text-muted)] hover:text-[var(--kbd-text)] hover:bg-[var(--color-panel)]/50 cursor-pointer transition-all flex-shrink-0 ml-1 outline-none"
          data-tooltip="New Chat"
          data-tooltip-pos="bottom"
        >
          <Plus size={12} />
        </span>

        {/* Ellipsis menu */}
        <div className="relative flex-shrink-0 ml-1 mr-1">
          <span
            onClick={() => setShowEllipsisMenu((o) => !o)}
            className="flex items-center justify-center w-6 h-6 rounded text-[var(--color-text-muted)] hover:text-[var(--kbd-text)] hover:bg-[var(--color-panel)]/50 cursor-pointer transition-all outline-none"
          >
            <MoreHorizontal size={14} />
          </span>
          {showEllipsisMenu && (
            <>
              <div className="fixed inset-0 z-[90]" onClick={() => setShowEllipsisMenu(false)} />
              <div
                className="absolute right-0 top-full mt-1 z-[100] bg-[var(--color-panel)] border border-[var(--color-border)] rounded-lg py-1 min-w-[120px]"
                style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}
              >
                <span
                  onClick={() => {
                    setShowConfigModal(true)
                    setShowEllipsisMenu(false)
                  }}
                  className="flex items-center px-3 py-1.5 text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-border)]/30 cursor-pointer transition-colors"
                >
                  Configure
                </span>
                <span
                  onClick={() => {
                    setShowHistory(true)
                    setShowEllipsisMenu(false)
                  }}
                  className="flex items-center px-3 py-1.5 text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-border)]/30 cursor-pointer transition-colors"
                >
                  History
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* History floating modal */}
      {showHistory && (
        <>
          <div className="fixed inset-0 z-[90]" onClick={() => setShowHistory(false)} />
          <div
            className="fixed top-[62px] right-4 z-[9999] bg-[var(--color-panel)] border border-[var(--color-border)] rounded-2xl shadow-2xl w-[340px] max-h-[480px] flex flex-col animate-in fade-in zoom-in-95 duration-200 pointer-events-auto"
            style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}
          >
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--color-border)] flex-shrink-0">
              <span className="text-[11px] font-bold text-[var(--kbd-text)] flex-1 uppercase tracking-widest">
                History
              </span>
              <span
                onClick={() => {
                  handleNewChat()
                  setShowHistory(false)
                }}
                className="text-[10px] px-2 py-0.5 rounded cursor-pointer bg-[var(--kbd-bg)] border border-[var(--kbd-border)] text-[var(--kbd-text)] hover:brightness-110 transition-all"
              >
                New Chat
              </span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
              {conversations.length === 0 && (
                <div className="flex items-center justify-center h-20 text-[10px] text-[var(--color-text-muted)]">
                  No chats yet
                </div>
              )}
              {conversations.map((conv) => {
                const preview = conv.messages?.[0]
                const isActive = conv.id === activeConversationId
                return (
                  <div
                    key={conv.id}
                    onClick={() => {
                      switchConversation(conv.id)
                      setShowHistory(false)
                    }}
                    className={`group/hist rounded-lg px-3 py-2 cursor-pointer transition-all ${
                      isActive
                        ? 'bg-[var(--color-bg)] text-[var(--kbd-text)]'
                        : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg)]/50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[11px] overflow-hidden whitespace-nowrap flex-1 ${isActive ? 'font-medium' : ''}`}
                        style={{
                          WebkitMaskImage: 'linear-gradient(to right, black calc(100% - 20px), transparent 100%)',
                          maskImage: 'linear-gradient(to right, black calc(100% - 20px), transparent 100%)',
                        }}
                      >
                        {conv.title}
                      </span>
                      <span
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteConversation(conv.id)
                        }}
                        className="hidden group-hover/hist:flex items-center justify-center w-4 h-4 rounded hover:bg-[var(--color-border)]/50 flex-shrink-0"
                      >
                        <X size={9} className="text-[var(--color-text-muted)]" />
                      </span>
                    </div>
                    {preview && (
                      <div className="text-[9px] text-[var(--color-text-muted)] mt-0.5 truncate opacity-50">
                        {preview.content.slice(0, 50)}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* Configure modal — Audio, Media, Animation */}
      {showConfigModal && (
        <>
          <div className="fixed inset-0 z-[90]" onClick={() => setShowConfigModal(false)} />
          <div
            className="fixed top-[62px] right-4 z-[9999] bg-[var(--color-panel)] border border-[var(--color-border)] rounded-2xl shadow-2xl p-4 w-[760px] pointer-events-auto"
            style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}
          >
            <div className="flex gap-6">
              {/* Presets — category-level batch toggles */}
              <div className="flex-1">
                <div className="px-1 mb-3 border-b border-[var(--color-border)] pb-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">
                    Presets
                  </span>
                </div>
                <div className="space-y-1">
                  {(() => {
                    const presets = [
                      {
                        label: 'Narration',
                        audioIds: [
                          'elevenlabs',
                          'openai-tts',
                          'gemini-tts',
                          'google-tts',
                          'openai-edge-tts',
                          'puter',
                          'web-speech',
                        ],
                        mediaIds: ['heygen'],
                      },
                      {
                        label: 'Media Gen',
                        audioIds: [] as string[],
                        mediaIds: ['veo3', 'googleImageGen', 'imageGen', 'dall-e'],
                      },
                      {
                        label: 'SFX & Music',
                        audioIds: ['elevenlabs-sfx', 'freesound', 'pixabay', 'pixabay-music', 'freesound-music'],
                        mediaIds: [] as string[],
                      },
                      {
                        label: 'Avatar',
                        audioIds: [] as string[],
                        mediaIds: ['talkinghead', 'musetalk', 'fabric', 'aurora', 'heygen'],
                      },
                    ]
                    return presets.map((preset) => {
                      const allOn =
                        preset.audioIds.every((id) => audioProviderEnabled[id] ?? true) &&
                        preset.mediaIds.every((id) => mediaGenEnabled[id] ?? true)
                      return (
                        <span
                          key={preset.label}
                          onClick={() => {
                            const target = !allOn
                            const audioUpdate = { ...audioProviderEnabled }
                            preset.audioIds.forEach((id) => {
                              audioUpdate[id] = target
                            })
                            const mediaUpdate = { ...mediaGenEnabled }
                            preset.mediaIds.forEach((id) => {
                              mediaUpdate[id] = target
                            })
                            useVideoStore.setState({ audioProviderEnabled: audioUpdate, mediaGenEnabled: mediaUpdate })
                          }}
                          className="flex items-center justify-between py-1.5 cursor-pointer select-none"
                        >
                          <span
                            className={`text-[11px] font-medium ${allOn ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)]'}`}
                          >
                            {preset.label}
                          </span>
                          {allOn ? (
                            <ToggleRight size={18} className="text-[var(--color-accent)]" />
                          ) : (
                            <ToggleLeft size={18} className="text-[var(--color-text-muted)]" />
                          )}
                        </span>
                      )
                    })
                  })()}
                </div>
              </div>

              {/* Audio */}
              <div className="flex-1 border-l border-[var(--color-border)] pl-4">
                <div className="px-1 mb-3 border-b border-[var(--color-border)] pb-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">
                    Audio
                  </span>
                </div>
                <div className="space-y-1">
                  {AUDIO_PROVIDERS.filter((p) => audioProviderEnabled[p.id] ?? p.defaultEnabled).map((p) => (
                    <span
                      key={p.id}
                      onClick={() => toggleAudioProvider(p.id)}
                      className="flex items-center justify-between py-1.5 cursor-pointer select-none"
                    >
                      <span className="text-[11px] font-medium text-[var(--color-text-primary)]">{p.name}</span>
                      <ToggleRight size={18} className="text-[var(--color-accent)]" />
                    </span>
                  ))}
                  {AUDIO_PROVIDERS.filter((p) => !(audioProviderEnabled[p.id] ?? p.defaultEnabled)).length > 0 && (
                    <div className="pt-1 border-t border-[var(--color-border)] mt-1">
                      {AUDIO_PROVIDERS.filter((p) => !(audioProviderEnabled[p.id] ?? p.defaultEnabled)).map((p) => (
                        <span
                          key={p.id}
                          onClick={() => toggleAudioProvider(p.id)}
                          className="flex items-center justify-between py-1.5 cursor-pointer select-none"
                        >
                          <span className="text-[11px] font-medium text-[var(--color-text-muted)]">{p.name}</span>
                          <ToggleLeft size={18} className="text-[var(--color-text-muted)]" />
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <span
                  onClick={() => {
                    setShowConfigModal(false)
                    setSettingsTab('models')
                  }}
                  className="inline-block mt-3 text-[10px] text-[var(--color-accent)] hover:underline cursor-pointer"
                >
                  + Add audio model
                </span>
              </div>

              {/* Media — all media gen providers (image, video, avatar, utility) */}
              <div className="flex-1 border-x border-[var(--color-border)] px-4">
                <div className="px-1 mb-3 border-b border-[var(--color-border)] pb-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">
                    Media
                  </span>
                </div>
                <div className="space-y-1">
                  {MEDIA_PROVIDERS.filter((p) => mediaGenEnabled[p.id] ?? p.defaultEnabled).map((p) => (
                    <span
                      key={p.id}
                      onClick={() => toggleMediaGen(p.id)}
                      className="flex items-center justify-between py-1.5 cursor-pointer select-none"
                    >
                      <span className="text-[11px] font-medium text-[var(--color-text-primary)]">{p.name}</span>
                      <ToggleRight size={18} className="text-[var(--color-accent)]" />
                    </span>
                  ))}
                  {MEDIA_PROVIDERS.filter((p) => !(mediaGenEnabled[p.id] ?? p.defaultEnabled)).length > 0 && (
                    <div className="pt-1 border-t border-[var(--color-border)] mt-1">
                      {MEDIA_PROVIDERS.filter((p) => !(mediaGenEnabled[p.id] ?? p.defaultEnabled)).map((p) => (
                        <span
                          key={p.id}
                          onClick={() => toggleMediaGen(p.id)}
                          className="flex items-center justify-between py-1.5 cursor-pointer select-none"
                        >
                          <span className="text-[11px] font-medium text-[var(--color-text-muted)]">{p.name}</span>
                          <ToggleLeft size={18} className="text-[var(--color-text-muted)]" />
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <span
                  onClick={() => {
                    setShowConfigModal(false)
                    setSettingsTab('models')
                  }}
                  className="inline-block mt-3 text-[10px] text-[var(--color-accent)] hover:underline cursor-pointer"
                >
                  + Add media model
                </span>
              </div>

              {/* Animation — scene rendering styles (tool filter chips) */}
              <div className="flex-1 pl-4">
                <div className="px-1 mb-3 border-b border-[var(--color-border)] pb-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">
                    Animation
                  </span>
                </div>
                <div className="space-y-1">
                  {TOOL_FILTER_CHIPS.filter((c) =>
                    ['canvas2d', 'svg', 'd3', 'three', 'lottie', 'zdog', 'html', 'interactions'].includes(c.id),
                  ).map((chip) => {
                    const isOn = activeTools.includes(chip.id)
                    return (
                      <span
                        key={chip.id}
                        onClick={() => toggleActiveTool(chip.id)}
                        className="flex items-center justify-between py-1.5 cursor-pointer select-none"
                      >
                        <span
                          className={`text-[11px] font-medium ${isOn ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)]'}`}
                        >
                          {chip.label}
                        </span>
                        {isOn ? (
                          <ToggleRight size={18} className="text-[var(--color-accent)]" />
                        ) : (
                          <ToggleLeft size={18} className="text-[var(--color-text-muted)]" />
                        )}
                      </span>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6 scrollbar-hide">
        {pausedAgentRun && (
          <div className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2.5 flex items-center gap-2">
            <span className="text-[11px] text-amber-300">
              Paused run: <span className="font-semibold">{pausedAgentRun.toolName}</span> is waiting for permission.
            </span>
            <span
              onClick={() => void handleResumePausedRun()}
              className={`ml-auto text-[11px] font-semibold px-2.5 py-1 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 ${isGenerating ? 'opacity-40' : 'cursor-pointer hover:bg-emerald-500/25'}`}
            >
              Continue
            </span>
            <span
              onClick={() => void persistPausedAgentRun(null)}
              className="text-[11px] font-semibold px-2.5 py-1 rounded-md border border-[var(--color-border)] cursor-pointer hover:bg-[var(--color-border)]/25"
            >
              Dismiss
            </span>
          </div>
        )}
        {runCheckpoint && !isGenerating && (
          <div className="mx-2 mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
            <div className="text-sm font-medium text-amber-200 mb-1">Interrupted run detected</div>
            <div className="text-xs text-[var(--color-text-secondary)] mb-2">
              {runCheckpoint.completedSceneIds.length} of {runCheckpoint.storyboard?.scenes.length ?? '?'} scenes were
              built before the run was interrupted.
            </div>
            <div className="flex gap-2">
              <span
                onClick={handleResumeCheckpoint}
                className="text-xs px-3 py-1 rounded bg-amber-500/20 text-amber-200 hover:bg-amber-500/30 cursor-pointer transition-colors"
              >
                Resume
              </span>
              <span
                onClick={handleDiscardCheckpoint}
                className="text-xs px-3 py-1 rounded bg-[var(--color-panel)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)] cursor-pointer transition-colors"
              >
                Discard
              </span>
            </div>
          </div>
        )}
        {messages
          .filter((m) => m.content)
          .map((msg) => (
            <div key={msg.id}>
              {msg.role === 'user' ? (
                <div className="flex flex-col items-center">
                  <div className="w-full rounded-xl px-3 py-2.5 text-sm leading-relaxed transition-all bg-[var(--color-panel)] border border-[var(--color-border)] text-[var(--color-text-primary)]">
                    {typeof msg.content === 'string' ? (
                      <span className="whitespace-pre-wrap break-words">{msg.content}</span>
                    ) : (
                      <div className="space-y-2">
                        {msg.content.some((b) => b.type === 'image') && (
                          <div className="flex gap-2 flex-wrap">
                            {msg.content
                              .filter((b) => b.type === 'image')
                              .map((b, i) => {
                                const img = (b as { type: 'image'; image: ImageAttachment }).image
                                return (
                                  <div
                                    key={i}
                                    className="relative cursor-pointer group"
                                    onClick={() =>
                                      setPreviewImage({
                                        src: img.dataUri,
                                        alt: img.fileName,
                                        width: img.width,
                                        height: img.height,
                                      })
                                    }
                                  >
                                    <img
                                      src={img.dataUri}
                                      className="max-h-48 max-w-[280px] rounded-lg border border-[var(--color-border)] object-cover"
                                      alt={img.fileName ?? 'Attached'}
                                    />
                                    <div className="absolute inset-0 rounded-lg bg-black/0 group-hover:bg-black/10 transition-colors" />
                                  </div>
                                )
                              })}
                          </div>
                        )}
                        {msg.content
                          .filter((b) => b.type === 'text')
                          .map((b, i) => (
                            <span key={i} className="whitespace-pre-wrap break-words">
                              {(b as { type: 'text'; text: string }).text}
                            </span>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="relative space-y-1">
                  {/* Agent badge */}
                  {msg.agentType && (
                    <div className="flex items-center gap-2">
                      <span
                        className="text-[11px] font-semibold"
                        style={{ color: AGENT_COLORS[msg.agentType] ?? '#6b7280' }}
                      >
                        {AGENT_LABELS[msg.agentType] ?? 'Agent'}
                      </span>
                      {msg.modelId && (
                        <span className="text-[10px] text-[var(--color-text-muted)] bg-[var(--color-panel)] px-1.5 py-0.5 rounded font-mono">
                          {String(msg.modelId).replace('claude-', '').replace('-20251001', '')}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Thinking block */}
                  {msg.thinking && <ThinkingBlock thinking={msg.thinking} />}

                  {/* Message text */}
                  <div className="text-sm leading-relaxed text-[var(--color-text-primary)] whitespace-pre-wrap break-words">
                    {renderMarkdown(typeof msg.content === 'string' ? msg.content : messageContentToText(msg.content))}
                  </div>

                  {/* Tool calls */}
                  {msg.toolCalls && msg.toolCalls.length > 0 && (
                    <div>
                      <div className="text-[10px] text-[var(--color-text-muted)] mb-1 uppercase tracking-wide">
                        {msg.toolCalls.length} tool call{msg.toolCalls.length > 1 ? 's' : ''}
                      </div>
                      {msg.toolCalls.map((call) => (
                        <ToolCallItem key={call.id} call={call} />
                      ))}
                    </div>
                  )}

                  {/* Permission / Generation confirmation cards */}
                  {msg.pendingPermissions && msg.pendingPermissions.length > 0 && (
                    <div className="space-y-2">
                      {msg.pendingPermissions.map((perm, i) => (
                        <GenerationConfirmCard
                          key={`${perm.api}-${i}`}
                          perm={perm}
                          onAllow={(overrides) => {
                            if (overrides) {
                              setGenerationOverride(perm.api, overrides)
                            }
                            handlePermission(msg.id, perm.api, 'allow')
                            void continueAfterPermission(msg, perm.api)
                          }}
                          onDeny={() => handlePermission(msg.id, perm.api, 'deny')}
                          onAutoChoose={(genType, defaults) => {
                            setAutoChooseDefault(genType, defaults)
                            // Also set session permission to always allow this API
                            setSessionPermission(perm.api, 'allow')
                          }}
                        />
                      ))}
                    </div>
                  )}

                  {/* Usage + feedback row */}
                  <div className="flex items-center gap-2 pt-0.5">
                    {msg.usage && <UsageBadge usage={msg.usage} />}
                    <MessageActions
                      msg={msg}
                      onRate={handleRate}
                      onDetails={handleDetails}
                      conversationId={activeConversationId}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}

        <StoryboardReviewCard disabled={isGenerating} onApprove={handleApproveStoryboard} />

        {/* ── Live streaming area ── */}
        {isGenerating && (
          <div className="space-y-2">
            {/* Iteration progress */}
            {currentIteration && currentIteration.iteration > 1 && (
              <div className="flex items-center gap-2 px-1">
                <Loader2 size={11} className="text-[var(--color-text-muted)] animate-spin" />
                <span className="text-[10px] text-[var(--color-text-muted)] font-mono">
                  Step {currentIteration.iteration}/{currentIteration.max}
                </span>
              </div>
            )}

            {/* Extended thinking block (streaming) */}
            {(isThinkingStreaming || streamingThinking) && (
              <div className="px-1">
                <ThinkingBlock thinking={streamingThinking} isStreaming={isThinkingStreaming} />
              </div>
            )}

            {/* Streaming text */}
            {streamingText && (
              <div className="px-1 text-sm leading-relaxed text-[var(--color-text-primary)] whitespace-pre-wrap">
                {renderMarkdown(streamingText)}
                <span className="inline-block w-1.5 h-1.5 bg-[var(--color-text-primary)] ml-1 animate-pulse rounded-full align-middle" />
              </div>
            )}

            {/* Completed tool calls (live) */}
            {streamingToolCalls.length > 0 && (
              <div className="px-1">
                <div className="text-[10px] text-[var(--color-text-muted)] mb-1 uppercase tracking-wide">
                  {streamingToolCalls.length} tool call{streamingToolCalls.length > 1 ? 's' : ''} completed
                </div>
                {streamingToolCalls.map((call) => (
                  <ToolCallItem key={call.id} call={call} />
                ))}
              </div>
            )}

            {/* Active tool indicator */}
            {activeToolName && (
              <div className="flex items-center gap-2 px-1">
                <span
                  className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0"
                  style={{ animation: 'cursorPulse 1.2s ease-in-out infinite' }}
                />
                <span className="text-[11px] text-[var(--color-text-primary)] font-mono truncate">
                  {activeToolName}
                </span>
                <span className="text-[10px] text-blue-400">Running</span>
              </div>
            )}

            {/* Pending indicator — only when nothing else is showing */}
            {!streamingText && !activeToolName && !isThinkingStreaming && !streamingThinking && (
              <div className="px-1">
                <span className="text-xs text-[var(--color-text-muted)]">
                  Thinking
                  <ThinkingDots />
                </span>
              </div>
            )}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Keyword warning */}
      {keywordWarning && (
        <div className="mx-4 mb-1 px-3 py-2 rounded-lg bg-amber-900/30 border border-amber-700/40 flex items-center gap-2 text-[11px]">
          <span className="text-amber-300 flex-1">
            <strong>{keywordWarning.label}</strong> is disabled for this chat.
          </span>
          <button
            onClick={() => {
              toggleActiveTool(keywordWarning.capability)
              setKeywordWarning(null)
            }}
            className="text-[10px] font-medium text-amber-200 hover:text-white px-2 py-0.5 rounded bg-amber-800/50 hover:bg-amber-700/60 transition-colors"
          >
            Enable
          </button>
          <button
            onClick={() => {
              setKeywordWarning(null)
              handleSend()
            }}
            className="text-[10px] text-amber-400/70 hover:text-amber-200 transition-colors"
          >
            Dismiss
          </button>
          <button
            onClick={() => setKeywordWarning(null)}
            className="text-amber-500/50 hover:text-amber-300 transition-colors"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* Input Area */}
      <div className="p-4 bg-gradient-to-t from-[var(--color-bg)] via-[var(--color-bg)] to-transparent pt-8">
        <div
          className={`relative bg-[var(--color-panel)] border rounded-xl shadow-2xl transition-all p-1 ${
            isDraggingImage
              ? 'border-[var(--color-accent)] border-dashed bg-[var(--color-accent)]/5'
              : 'border-[var(--color-border)]'
          }`}
          onDragOver={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setIsDraggingImage(true)
          }}
          onDragLeave={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setIsDraggingImage(false)
          }}
          onDrop={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setIsDraggingImage(false)
            for (const file of Array.from(e.dataTransfer.files)) {
              if (file.type.startsWith('image/')) handleImageFile(file)
            }
          }}
        >
          {/* Pending image chips — above textarea */}
          {pendingImages.length > 0 && (
            <div className="flex gap-1.5 px-3 pt-2 pb-1 overflow-x-auto scrollbar-hide">
              {pendingImages.map((img, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1.5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-md pl-0.5 pr-1.5 py-0.5 shrink-0 group hover:border-[var(--color-text-muted)] transition-colors"
                >
                  <img
                    src={img.dataUri}
                    onClick={() =>
                      setPreviewImage({ src: img.dataUri, alt: img.fileName, width: img.width, height: img.height })
                    }
                    className="h-7 w-7 object-cover rounded cursor-pointer"
                    alt={img.fileName ?? 'Attached'}
                  />
                  <span className="text-[10px] text-[var(--color-text-primary)] truncate max-w-[80px]">
                    {img.fileName ?? 'Image'}
                  </span>
                  <span
                    onClick={() => setPendingImages((prev) => prev.filter((_, j) => j !== i))}
                    className="cursor-pointer text-[var(--color-text-muted)] hover:text-red-400 transition-colors"
                  >
                    <X size={10} />
                  </span>
                </div>
              ))}
            </div>
          )}

          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            onPaste={(e) => {
              const items = e.clipboardData?.items
              if (!items) return
              for (const item of Array.from(items)) {
                if (item.type.startsWith('image/')) {
                  e.preventDefault()
                  const file = item.getAsFile()
                  if (file) handleImageFile(file)
                }
              }
            }}
            placeholder={pendingImages.length > 0 ? 'Add a message or send images...' : 'Talk to Agent...'}
            disabled={isGenerating}
            className="w-full bg-transparent border-none focus:ring-0 focus:outline-none text-sm text-[var(--color-text-primary)] px-4 py-2 min-h-[44px] max-h-[200px] resize-none scrollbar-hide disabled:opacity-50"
            rows={1}
          />

          <div className="flex items-center justify-between px-3 py-2 mt-1 gap-2">
            {!isListening ? (
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <span
                  onClick={() => imageInputRef.current?.click()}
                  className="flex items-center justify-center p-1 h-7 w-7 cursor-pointer"
                  style={{ color: 'var(--color-text-muted)' }}
                  data-tooltip="Attach image"
                  data-tooltip-pos="top"
                >
                  <Plus size={14} strokeWidth={2.5} />
                </span>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    for (const file of Array.from(e.target.files ?? [])) handleImageFile(file)
                    e.target.value = ''
                  }}
                />

                <span
                  onClick={() => !isGenerating && setPlanFirstMode(!planFirstMode)}
                  className={`flex items-center gap-1 px-2 h-7 rounded-md text-[10px] font-medium cursor-pointer border select-none transition-colors ${
                    planFirstMode
                      ? 'border-cyan-500/45 bg-cyan-500/10 text-cyan-300'
                      : 'border-[var(--color-border)]/50 text-[var(--color-text-muted)] hover:border-[var(--color-border)]'
                  } ${isGenerating ? 'opacity-40 pointer-events-none' : ''}`}
                  data-tooltip="Next text-only message runs Planner — review storyboard before Director builds"
                  data-tooltip-pos="top"
                >
                  <ListOrdered size={12} strokeWidth={2.2} />
                  Plan first
                </span>

                <div className="flex items-center gap-2">
                  {/* ── 1. Model Selection ── */}
                  <div className="relative">
                    <button
                      onClick={() => {
                        setShowModelMenu(!showModelMenu)
                        setShowAgentMenu(false)
                        setShowSpeechLangMenu(false)
                      }}
                      className="no-style !flex items-center gap-1 px-1.5 transition-all rounded-md whitespace-nowrap h-7 border border-transparent box-border"
                      style={{ color: showModelMenu ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}
                    >
                      <span className="font-semibold text-xs leading-none">{currentModel.modelName}</span>
                      <ChevronUp size={10} strokeWidth={2.5} className="opacity-70 ml-0.5" />
                    </button>

                    {showModelMenu && (
                      <>
                        <div className="fixed inset-0 z-[90]" onClick={() => setShowModelMenu(false)} />
                        <div
                          className="absolute bottom-[calc(100%+8px)] left-0 z-[100] rounded-xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-1 duration-150"
                          style={{
                            width: 220,
                            background: 'var(--color-panel)',
                            border: '1px solid var(--color-border)',
                          }}
                        >
                          {/* Auto toggle */}
                          <div style={{ padding: '3px 3px 1px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', padding: '3px 6px', borderRadius: 6 }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>
                                  Auto
                                </div>
                                <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 1 }}>
                                  Balanced — picks the best model per task
                                </div>
                              </div>
                              <div
                                onClick={() => {
                                  if (modelTier === 'auto' && !modelOverride) {
                                    setModelTier('budget')
                                  } else {
                                    setModelTier('auto')
                                    setModelOverride(null)
                                  }
                                }}
                                style={{
                                  width: 32,
                                  height: 18,
                                  borderRadius: 9,
                                  cursor: 'pointer',
                                  position: 'relative',
                                  transition: 'background 0.2s',
                                  flexShrink: 0,
                                  marginLeft: 8,
                                  background:
                                    modelTier === 'auto' && !modelOverride
                                      ? 'var(--color-accent)'
                                      : 'var(--color-border)',
                                }}
                              >
                                <div
                                  style={{
                                    width: 14,
                                    height: 14,
                                    borderRadius: 7,
                                    background: 'white',
                                    position: 'absolute',
                                    top: 2,
                                    left: modelTier === 'auto' && !modelOverride ? 16 : 2,
                                    transition: 'left 0.2s',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                                  }}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Expanded options — only when auto is off */}
                          {!(modelTier === 'auto' && !modelOverride) && (
                            <>
                              {/* Tier options (premium + budget only, auto is the switch above) */}
                              <div style={{ borderTop: '1px solid var(--color-border)', padding: '2px 3px 1px' }}>
                                {MODEL_OPTIONS.filter((opt) => opt.id !== 'auto').map((opt) => (
                                  <div
                                    key={opt.id}
                                    onClick={() => {
                                      setModelTier(opt.id)
                                      setModelOverride(null)
                                    }}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      padding: '3px 6px',
                                      borderRadius: 6,
                                      cursor: 'pointer',
                                      color: 'var(--color-text-primary)',
                                    }}
                                    className="hover:bg-white/10 transition-colors"
                                  >
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ fontSize: 13, fontWeight: 500 }}>{opt.modelName}</div>
                                      <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 1 }}>
                                        {opt.tierLabel}
                                      </div>
                                    </div>
                                    {modelTier === opt.id && !modelOverride && (
                                      <Check
                                        size={14}
                                        strokeWidth={2}
                                        style={{ flexShrink: 0, color: 'var(--color-accent)' }}
                                      />
                                    )}
                                  </div>
                                ))}
                              </div>

                              {/* Enabled models */}
                              <div style={{ borderTop: '1px solid var(--color-border)', padding: '2px 3px 1px' }}>
                                <div
                                  style={{
                                    padding: '0 6px 1px',
                                    fontSize: 10,
                                    color: 'var(--color-text-muted)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                  }}
                                >
                                  Models
                                </div>
                                {modelConfigs
                                  .filter((m) => m.enabled)
                                  .map((m) => (
                                    <div
                                      key={m.id}
                                      onClick={() => {
                                        setModelOverride(m.modelId as any)
                                        setShowModelMenu(false)
                                      }}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        padding: '3px 6px',
                                        borderRadius: 6,
                                        cursor: 'pointer',
                                        color: 'var(--color-text-primary)',
                                      }}
                                      className="hover:bg-white/10 transition-colors"
                                    >
                                      <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 13, fontWeight: 500 }}>{m.displayName}</div>
                                        <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 1 }}>
                                          {m.tier}
                                        </div>
                                      </div>
                                      {modelOverride === m.modelId && (
                                        <Check
                                          size={14}
                                          strokeWidth={2}
                                          style={{ flexShrink: 0, color: 'var(--color-accent)' }}
                                        />
                                      )}
                                    </div>
                                  ))}
                              </div>
                              {/* Thinking section */}
                              <div style={{ borderTop: '1px solid var(--color-border)', padding: '1px 3px 1px' }}>
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '2px 6px',
                                  }}
                                >
                                  <span
                                    style={{
                                      fontSize: 10,
                                      color: 'var(--color-text-muted)',
                                      textTransform: 'uppercase',
                                      letterSpacing: '0.05em',
                                    }}
                                  >
                                    Thinking
                                  </span>
                                  <div
                                    onClick={() => setThinkingMode(thinkingMode === 'off' ? 'adaptive' : 'off')}
                                    style={{
                                      width: 32,
                                      height: 18,
                                      borderRadius: 9,
                                      cursor: 'pointer',
                                      position: 'relative',
                                      transition: 'background 0.2s',
                                      background:
                                        thinkingMode !== 'off' ? 'var(--color-accent)' : 'var(--color-border)',
                                    }}
                                  >
                                    <div
                                      style={{
                                        width: 14,
                                        height: 14,
                                        borderRadius: 7,
                                        background: 'white',
                                        position: 'absolute',
                                        top: 2,
                                        left: thinkingMode !== 'off' ? 16 : 2,
                                        transition: 'left 0.2s',
                                        boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                                      }}
                                    />
                                  </div>
                                </div>
                                {thinkingMode !== 'off' &&
                                  (
                                    [
                                      {
                                        id: 'adaptive' as ThinkingMode,
                                        label: 'Auto',
                                        desc: 'Claude decides when to think',
                                      },
                                      { id: 'deep' as ThinkingMode, label: 'Deep', desc: 'Always reasons deeply' },
                                    ] as const
                                  ).map((opt) => (
                                    <div
                                      key={opt.id}
                                      onClick={() => setThinkingMode(opt.id)}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        padding: '3px 6px',
                                        borderRadius: 6,
                                        cursor: 'pointer',
                                        color: 'var(--color-text-primary)',
                                      }}
                                      className="hover:bg-white/10 transition-colors"
                                    >
                                      <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 13, fontWeight: 500 }}>{opt.label}</div>
                                        <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 1 }}>
                                          {opt.desc}
                                        </div>
                                      </div>
                                      {thinkingMode === opt.id && (
                                        <Check
                                          size={14}
                                          strokeWidth={2}
                                          style={{ flexShrink: 0, color: 'var(--color-accent)' }}
                                        />
                                      )}
                                    </div>
                                  ))}
                              </div>

                              {/* Add Model */}
                              <div style={{ borderTop: '1px solid var(--color-border)', padding: '1px 3px 2px' }}>
                                <div
                                  onClick={() => {
                                    setShowModelMenu(false)
                                    setSettingsTab('models')
                                  }}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '3px 6px',
                                    borderRadius: 6,
                                    cursor: 'pointer',
                                  }}
                                  className="hover:bg-white/10 transition-colors"
                                >
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>
                                      Add Model
                                    </div>
                                    <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 1 }}>
                                      Configure in settings
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  {/* ── 2. Agent Mode Selection ── */}
                  <div className="relative">
                    <button
                      onClick={() => {
                        setShowAgentMenu(!showAgentMenu)
                        setShowModelMenu(false)
                        setShowSpeechLangMenu(false)
                      }}
                      className={`no-style !flex items-center gap-1.5 px-2.5 transition-all rounded-full border box-border ${
                        showAgentMenu
                          ? 'border-[var(--color-border)]/50 bg-[var(--color-bg)]'
                          : 'border-[var(--color-border)]/30 hover:border-[var(--color-border)] bg-[var(--color-bg)]/50'
                      } whitespace-nowrap h-7`}
                      style={{
                        color: showAgentMenu
                          ? 'var(--color-text-primary)'
                          : agentOverride
                            ? currentAgent.color
                            : 'var(--color-text-muted)',
                      }}
                    >
                      <AgentIcon size={14} strokeWidth={2.5} />
                      <ChevronUp size={10} strokeWidth={2.5} className="opacity-70 ml-0.5 translate-y-[1px]" />
                    </button>

                    {showAgentMenu && (
                      <>
                        <div className="fixed inset-0 z-[90]" onClick={() => setShowAgentMenu(false)} />
                        <div className="absolute bottom-[calc(100%+8px)] left-0 z-[100] bg-[var(--color-panel)] border border-[var(--color-border)] rounded-xl shadow-2xl p-1.5 flex flex-col w-max min-w-[190px] gap-0.5 animate-in slide-in-from-bottom-1 duration-150">
                          {/* Core agents */}
                          {coreAgents.map((a) => (
                            <button
                              key={a.id ?? 'auto'}
                              onClick={() => {
                                setAgentOverride(a.id)
                                setShowAgentMenu(false)
                              }}
                              className="w-full !flex !flex-row items-center px-3 py-2.5 !rounded-[8px] transition-colors no-style hover:bg-white/10 cursor-pointer"
                            >
                              <a.icon
                                size={14}
                                strokeWidth={2}
                                style={{ color: a.color }}
                                className="flex-shrink-0 mr-2.5"
                              />
                              <div className="flex flex-col items-start flex-1 min-w-0">
                                <span
                                  className="text-[13px] font-medium leading-none whitespace-nowrap"
                                  style={{ color: agentOverride === a.id ? a.color : 'var(--color-text-primary)' }}
                                >
                                  {a.label}
                                </span>
                                <span className="text-[10px] text-[var(--color-text-muted)] mt-1">{a.desc}</span>
                              </div>
                              {agentOverride === a.id && (
                                <Check
                                  size={14}
                                  strokeWidth={2}
                                  className="ml-2 flex-shrink-0"
                                  style={{ color: a.color }}
                                />
                              )}
                            </button>
                          ))}

                          {/* Specialized agents divider */}
                          <div className="border-t border-[var(--color-border)] mt-1 pt-1">
                            <div className="px-3 py-1">
                              <span className="text-[9px] uppercase tracking-widest text-[var(--color-text-muted)] font-semibold">
                                Specialists
                              </span>
                            </div>
                          </div>

                          {specializedAgents.map((a, i) => (
                            <button
                              key={`spec-${i}`}
                              onClick={() => {
                                setAgentOverride(a.id)
                                setShowAgentMenu(false)
                              }}
                              className="w-full !flex !flex-row items-center px-3 py-2.5 !rounded-[8px] transition-colors no-style hover:bg-white/10 cursor-pointer"
                            >
                              <a.icon
                                size={14}
                                strokeWidth={2}
                                style={{ color: a.color }}
                                className="flex-shrink-0 mr-2.5"
                              />
                              <div className="flex flex-col items-start flex-1 min-w-0">
                                <span className="text-[13px] font-medium leading-none whitespace-nowrap text-[var(--color-text-primary)]">
                                  {a.label}
                                </span>
                                <span className="text-[10px] text-[var(--color-text-muted)] mt-1">{a.desc}</span>
                              </div>
                            </button>
                          ))}

                          {/* Add Agent button — same row style as agent options */}
                          <div className="border-t border-[var(--color-border)] mt-1 pt-1">
                            <button
                              onClick={() => {
                                setShowAgentMenu(false)
                                setSettingsTab('agents')
                              }}
                              className="w-full !flex !flex-row items-center px-3 py-2.5 !rounded-[8px] transition-colors no-style hover:bg-white/10 cursor-pointer"
                            >
                              <Plus
                                size={14}
                                strokeWidth={2}
                                className="flex-shrink-0 mr-2.5 text-[var(--color-text-muted)]"
                              />
                              <div className="flex flex-col items-start flex-1 min-w-0">
                                <span className="text-[13px] font-medium leading-none whitespace-nowrap text-[var(--color-text-primary)]">
                                  Add Agent
                                </span>
                                <span className="text-[10px] text-[var(--color-text-muted)] mt-1">
                                  Configure in settings
                                </span>
                              </div>
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <SpeechWaveformLangControl
                  active
                  speechSupported={speechSupported}
                  speechLang={speechLang}
                  showMenu={showSpeechLangMenu}
                  setShowMenu={setShowSpeechLangMenu}
                  onSelectLang={handleSelectSpeechLang}
                  onOpenMenu={() => {
                    setShowModelMenu(false)
                    setShowAgentMenu(false)
                  }}
                />
                <span className="text-[11px] text-[var(--color-text-muted)] truncate">Listening…</span>
              </div>
            )}

            {/* Send / voice / stop */}
            <div className="flex items-center flex-shrink-0 relative gap-2">
              {isGenerating ? (
                <span
                  onClick={handleAbort}
                  className="flex items-center justify-center cursor-pointer"
                  style={{ width: '32px', height: '32px', borderRadius: '9999px', backgroundColor: 'var(--color-bg)' }}
                >
                  <span
                    className="animate-pulse"
                    style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: 'var(--color-text-primary)' }}
                  />
                </span>
              ) : isListening ? (
                <>
                  {canSend && (
                    <button
                      type="button"
                      onClick={handleSend}
                      className="flex items-center justify-center transition-all cursor-pointer no-style"
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '9999px',
                        backgroundColor: 'var(--color-bg)',
                        border: 'none',
                        outline: 'none',
                        boxShadow: 'none',
                        padding: 0,
                        position: 'relative',
                      }}
                      data-tooltip="Send"
                      data-tooltip-pos="top"
                    >
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <img
                          src="/icons/send.png"
                          alt="Send"
                          className="transition-all duration-200 dark-send-icon"
                          style={{
                            width: '26px',
                            height: '26px',
                            objectFit: 'contain',
                            opacity: 1,
                          }}
                        />
                      </div>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => toggleVoiceInput()}
                    className="flex items-center justify-center transition-all cursor-pointer no-style"
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '9999px',
                      backgroundColor: 'var(--color-bg)',
                      border: 'none',
                      outline: 'none',
                      boxShadow: 'none',
                      padding: 0,
                    }}
                    data-tooltip="Stop listening"
                    data-tooltip-pos="top"
                  >
                    <Square
                      size={11}
                      strokeWidth={2.5}
                      className="text-[var(--color-text-primary)]"
                      fill="currentColor"
                    />
                  </button>
                </>
              ) : canSend ? (
                <button
                  type="button"
                  onClick={handleSend}
                  className="flex items-center justify-center transition-all cursor-pointer no-style"
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '9999px',
                    backgroundColor: 'var(--color-bg)',
                    border: 'none',
                    outline: 'none',
                    boxShadow: 'none',
                    padding: 0,
                    position: 'relative',
                  }}
                  data-tooltip="Send"
                  data-tooltip-pos="top"
                >
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <img
                      src="/icons/send.png"
                      alt="Send"
                      className="transition-all duration-200 dark-send-icon"
                      style={{
                        width: '26px',
                        height: '26px',
                        objectFit: 'contain',
                        opacity: 1,
                      }}
                    />
                  </div>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => speechSupported && toggleVoiceInput()}
                  disabled={!speechSupported}
                  className={`flex items-center justify-center transition-all no-style ${
                    speechSupported ? 'cursor-pointer' : 'cursor-not-allowed opacity-40'
                  }`}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '9999px',
                    backgroundColor: 'var(--color-bg)',
                    border: 'none',
                    outline: 'none',
                    boxShadow: 'none',
                    padding: 0,
                  }}
                  data-tooltip={speechSupported ? 'Voice input' : 'Voice input not supported in this browser'}
                  data-tooltip-pos="top"
                >
                  <Mic
                    size={20}
                    strokeWidth={2.25}
                    className="text-[var(--color-text-primary)]"
                    style={{ opacity: speechSupported ? 0.9 : 0.35 }}
                  />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Image preview lightbox */}
      {previewImage && <ImageLightbox image={previewImage} onClose={() => setPreviewImage(null)} />}
    </div>
  )
}
