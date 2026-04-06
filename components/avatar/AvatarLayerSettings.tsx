'use client'

import { useCallback, useRef } from 'react'
import { useVideoStore } from '@/lib/store'
import { Section } from '@/components/inspector/Section'
import { SelectInput } from '@/components/inspector/controls/SelectInput'
import { SliderInput } from '@/components/inspector/controls/SliderInput'
import { NumberInput } from '@/components/inspector/controls/NumberInput'
import { ToggleInput } from '@/components/inspector/controls/ToggleInput'
import { ControlRow } from '@/components/inspector/controls/ControlRow'
import { sendAvatarCommand } from '@/lib/scene-patcher'
import type {
  AvatarLayer,
  NarrationScript,
  AvatarMood,
  AvatarView,
  AvatarPosition,
  AvatarCharacter,
  PipShape,
} from '@/lib/types'

interface Props {
  sceneId: string
  layer: AvatarLayer
  getIframe: () => HTMLIFrameElement | null
}

const MOODS: { value: AvatarMood; label: string }[] = [
  { value: 'neutral', label: 'Neutral' },
  { value: 'happy', label: 'Happy' },
  { value: 'sad', label: 'Sad' },
  { value: 'angry', label: 'Angry' },
  { value: 'fear', label: 'Fear' },
  { value: 'surprise', label: 'Surprise' },
]

const VIEWS: { value: AvatarView; label: string }[] = [
  { value: 'full', label: 'Full body' },
  { value: 'mid', label: 'Mid shot' },
  { value: 'upper', label: 'Upper body' },
  { value: 'head', label: 'Head only' },
]

const POSITIONS: { value: AvatarPosition; label: string }[] = [
  { value: 'pip_bottom_right', label: 'PIP Bottom Right' },
  { value: 'pip_bottom_left', label: 'PIP Bottom Left' },
  { value: 'pip_top_right', label: 'PIP Top Right' },
  { value: 'fullscreen', label: 'Fullscreen' },
  { value: 'fullscreen_left', label: 'Fullscreen Left' },
  { value: 'fullscreen_right', label: 'Fullscreen Right' },
]

const PIP_SHAPES: { value: PipShape; label: string }[] = [
  { value: 'circle', label: 'Circle' },
  { value: 'rounded', label: 'Rounded' },
  { value: 'square', label: 'Square' },
]

const GESTURES: { name: string; label: string; emoji: string }[] = [
  { name: 'wave', label: 'Wave', emoji: '👋' },
  { name: 'index', label: 'Point', emoji: '👆' },
  { name: 'thumbup', label: 'Thumbs', emoji: '👍' },
  { name: 'shrug', label: 'Shrug', emoji: '🤷' },
  { name: 'handup', label: 'Hand up', emoji: '✋' },
  { name: 'ok', label: 'OK', emoji: '👌' },
  { name: 'thumbdown', label: 'Down', emoji: '👎' },
  { name: 'side', label: 'Side', emoji: '↔' },
]

const CHARACTERS: { value: AvatarCharacter; label: string }[] = [
  { value: 'friendly', label: 'Friendly' },
  { value: 'professional', label: 'Professional' },
  { value: 'energetic', label: 'Energetic' },
]

const ENTRANCES = ['fade', 'scale-in', 'slide-up'] as const
const EXITS = ['fade', 'scale-out', 'slide-down'] as const

export default function AvatarLayerSettings({ sceneId, layer, getIframe }: Props) {
  const { updateAILayer, saveSceneHTML } = useVideoStore()
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const ns: NarrationScript = layer.narrationScript ?? {
    mood: 'happy',
    view: 'upper',
    lipsyncHeadMovement: true,
    eyeContact: 0.7,
    position: (layer.avatarPlacement as AvatarPosition) ?? 'pip_bottom_right',
    pipShape: 'circle',
    avatarScale: 1.15,
    containerEnabled: true,
    containerBlur: 16,
    containerBgOpacity: 0.2,
    containerBorderOpacity: 0.35,
    containerBorderWidth: 2,
    containerShadowOpacity: 0.35,
    containerInnerGlow: 0.08,
    lines: [],
  }

  const isPip = ns.position?.startsWith('pip')

  // Update narrationScript field, persist debounced, send live preview
  const update = useCallback(
    (partial: Partial<NarrationScript>) => {
      const updated = { ...ns, ...partial }
      updateAILayer(sceneId, layer.id, { narrationScript: updated })

      // Debounce HTML regeneration
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => saveSceneHTML(sceneId), 600)
    },
    [sceneId, layer.id, ns, updateAILayer, saveSceneHTML],
  )

  const liveCommand = useCallback(
    (command: string, args: Record<string, unknown> = {}) => {
      sendAvatarCommand(getIframe(), command, args)
    },
    [getIframe],
  )

  return (
    <div className="space-y-0">
      {/* ── Character ──────────────────────────────────────────── */}
      <Section title="Character" defaultOpen>
        <SelectInput
          label="Avatar"
          value={ns.character ?? 'friendly'}
          options={CHARACTERS.map((c) => c.value)}
          optionLabels={CHARACTERS.map((c) => c.label)}
          onChange={(v) => update({ character: v as AvatarCharacter })}
        />
      </Section>

      {/* ── Mood & Energy ──────────────────────────────────────── */}
      <Section title="Mood & Energy" defaultOpen>
        <SelectInput
          label="Mood"
          value={ns.mood}
          options={MOODS.map((m) => m.value)}
          optionLabels={MOODS.map((m) => m.label)}
          onChange={(v) => {
            update({ mood: v as AvatarMood })
            liveCommand('setMood', { mood: v })
          }}
        />
        <ToggleInput
          label="Head move"
          value={ns.lipsyncHeadMovement}
          onChange={(v) => update({ lipsyncHeadMovement: v })}
        />
        <SliderInput
          label="Eye contact"
          value={ns.eyeContact}
          min={0}
          max={1}
          step={0.1}
          onChange={(v) => update({ eyeContact: v })}
        />
        <SelectInput
          label="View"
          value={ns.view}
          options={VIEWS.map((v) => v.value)}
          optionLabels={VIEWS.map((v) => v.label)}
          onChange={(v) => {
            update({ view: v as AvatarView })
            liveCommand('setView', { view: v })
          }}
        />
      </Section>

      {/* ── Gestures ───────────────────────────────────────────── */}
      <Section title="Gestures" defaultOpen={false}>
        <div className="grid grid-cols-4 gap-1">
          {GESTURES.map((g) => (
            <span
              key={g.name}
              role="button"
              tabIndex={0}
              onClick={() => liveCommand('playGesture', { gesture: g.name, duration: 2 })}
              className="flex flex-col items-center gap-0.5 p-1.5 rounded cursor-pointer hover:bg-white/10 transition-colors select-none"
              title={g.label}
            >
              <span className="text-base leading-none">{g.emoji}</span>
              <span className="text-[10px] text-[#6b6b7a]">{g.label}</span>
            </span>
          ))}
        </div>
      </Section>

      {/* ── Scene Layout ───────────────────────────────────────── */}
      <Section title="Scene Layout" defaultOpen>
        <SelectInput
          label="Position"
          value={ns.position}
          options={POSITIONS.map((p) => p.value)}
          optionLabels={POSITIONS.map((p) => p.label)}
          onChange={(v) => update({ position: v as AvatarPosition })}
        />
        {isPip && (
          <>
            <NumberInput
              label="PIP size"
              value={ns.pipSize ?? 280}
              min={120}
              max={500}
              step={10}
              onChange={(v) => update({ pipSize: v })}
            />
            <SelectInput
              label="PIP shape"
              value={ns.pipShape ?? 'circle'}
              options={PIP_SHAPES.map((s) => s.value)}
              optionLabels={PIP_SHAPES.map((s) => s.label)}
              onChange={(v) => update({ pipShape: v as PipShape })}
            />
            <SliderInput
              label="Avatar scale"
              value={ns.avatarScale ?? 1.15}
              min={1}
              max={1.8}
              step={0.05}
              onChange={(v) => update({ avatarScale: v })}
            />
          </>
        )}
        <ControlRow label="Background">
          <input
            type="color"
            value={ns.background ?? '#6366f1'}
            onChange={(e) => update({ background: e.target.value })}
            className="w-6 h-6 rounded cursor-pointer border-0 p-0"
          />
        </ControlRow>
      </Section>

      {/* ── Container Style ──────────────────────────────────── */}
      <Section title="Container Style" defaultOpen={false}>
        <ToggleInput
          label="Enable container"
          value={ns.containerEnabled !== false}
          onChange={(v) => update({ containerEnabled: v })}
        />
        <SliderInput
          label="Blur"
          value={ns.containerBlur ?? 0}
          min={0}
          max={40}
          step={1}
          onChange={(v) => update({ containerBlur: v })}
        />
        <SliderInput
          label="BG opacity"
          value={ns.containerBgOpacity ?? 1}
          min={0}
          max={1}
          step={0.05}
          onChange={(v) => update({ containerBgOpacity: v })}
        />
        <ControlRow label="Border color">
          <input
            type="color"
            value={ns.containerBorderColor ?? '#ffffff'}
            onChange={(e) => update({ containerBorderColor: e.target.value })}
            className="w-6 h-6 rounded cursor-pointer border-0 p-0"
          />
        </ControlRow>
        <SliderInput
          label="Border opacity"
          value={ns.containerBorderOpacity ?? 0.3}
          min={0}
          max={1}
          step={0.05}
          onChange={(v) => update({ containerBorderOpacity: v })}
        />
        <NumberInput
          label="Border width"
          value={ns.containerBorderWidth ?? 3}
          min={0}
          max={8}
          step={1}
          onChange={(v) => update({ containerBorderWidth: v })}
        />
        <SliderInput
          label="Shadow"
          value={ns.containerShadowOpacity ?? 0.4}
          min={0}
          max={1}
          step={0.05}
          onChange={(v) => update({ containerShadowOpacity: v })}
        />
        <SliderInput
          label="Inner glow"
          value={ns.containerInnerGlow ?? 0}
          min={0}
          max={1}
          step={0.05}
          onChange={(v) => update({ containerInnerGlow: v })}
        />
      </Section>

      {/* ── Sequence ───────────────────────────────────────────── */}
      <Section title="Sequence" defaultOpen={false}>
        <NumberInput
          label="Enter at"
          value={ns.enterAt ?? 0}
          min={0}
          max={60}
          step={0.1}
          onChange={(v) => update({ enterAt: v })}
        />
        <NumberInput
          label="Exit at"
          value={ns.exitAt ?? 0}
          min={0}
          max={60}
          step={0.1}
          onChange={(v) => update({ exitAt: v || undefined })}
        />
        <SelectInput
          label="Entrance"
          value={ns.entranceAnimation ?? 'fade'}
          options={[...ENTRANCES]}
          optionLabels={['Fade', 'Scale In', 'Slide Up']}
          onChange={(v) => update({ entranceAnimation: v as (typeof ENTRANCES)[number] })}
        />
        <SelectInput
          label="Exit"
          value={ns.exitAnimation ?? 'fade'}
          options={[...EXITS]}
          optionLabels={['Fade', 'Scale Out', 'Slide Down']}
          onChange={(v) => update({ exitAnimation: v as (typeof EXITS)[number] })}
        />
      </Section>
    </div>
  )
}
