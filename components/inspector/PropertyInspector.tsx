'use client'

import { useCallback } from 'react'
import { useVideoStore } from '@/lib/store'
import { Section } from './Section'
import { ColorPicker } from './controls/ColorPicker'
import { NumberInput } from './controls/NumberInput'
import { SliderInput } from './controls/SliderInput'
import { ToggleInput } from './controls/ToggleInput'
import { SelectInput } from './controls/SelectInput'
import { TextareaInput } from './controls/TextareaInput'
import { AgentEditButton } from './controls/AgentEditButton'
import { ELEMENT_PROPERTY_MAP, type SceneElement } from '@/lib/types/elements'
import { patchElementInIframe } from '@/lib/scene-patcher'
import { MousePointerClick, Layers, Box } from 'lucide-react'

export default function PropertyInspector() {
  const {
    inspectorSelectedElement,
    inspectorSelectedLayerId,
    inspectorElements,
    patchInspectorElement,
    scenes,
    selectedSceneId,
    globalStyle,
  } = useVideoStore()

  const scene = scenes.find((s) => s.id === selectedSceneId)

  // Get the current palette from globalStyle for color pickers
  const palette = globalStyle.paletteOverride ?? ['#2d2d2d', '#e84545', '#4a90d9', '#50c878']

  // Patch an element property: live preview only (no HTML regen — saveSceneHTML
  // regenerates from scene store which doesn't contain inspector changes)
  const handlePatch = useCallback(
    (elementId: string, property: string, value: unknown) => {
      patchInspectorElement(elementId, property, value)

      const iframe = document.querySelector(`iframe[data-scene-id="${selectedSceneId}"]`) as HTMLIFrameElement | null
      patchElementInIframe(iframe, elementId, property, value)
    },
    [patchInspectorElement, selectedSceneId],
  )

  // ── No selection ─────────────────────────────────────────
  if (!inspectorSelectedElement && !inspectorSelectedLayerId) {
    return <EmptyInspector elementCount={Object.keys(inspectorElements).length} />
  }

  // ── Element selected ─────────────────────────────────────
  if (inspectorSelectedElement) {
    return (
      <div className="h-full overflow-y-auto">
        <ElementInspector
          element={inspectorSelectedElement}
          layerId={inspectorSelectedLayerId}
          sceneId={selectedSceneId}
          palette={palette}
          onPatch={handlePatch}
        />
      </div>
    )
  }

  // ── Layer selected (no element) ──────────────────────────
  return (
    <div className="h-full overflow-y-auto">
      <LayerInspector layerId={inspectorSelectedLayerId!} sceneId={selectedSceneId} />
    </div>
  )
}

// ── Empty state ─────────────────────────────────────────────
function EmptyInspector({ elementCount }: { elementCount: number }) {
  return (
    <div className="flex flex-col items-center justify-center h-48 px-6 text-center gap-3">
      <MousePointerClick size={24} className="text-[#3a3a42]" />
      <div className="space-y-1">
        <p className="text-xs text-[#6b6b7a]">Click an element in the scene to inspect it</p>
        {elementCount > 0 && (
          <p className="text-[10px] text-[#4a4a52]">
            {elementCount} element{elementCount !== 1 ? 's' : ''} registered
          </p>
        )}
      </div>
    </div>
  )
}

// ── Element Inspector ───────────────────────────────────────
export function ElementInspector({
  element,
  layerId,
  sceneId,
  palette,
  onPatch,
}: {
  element: SceneElement
  layerId: string | null
  sceneId: string | null
  palette: string[]
  onPatch: (elementId: string, property: string, value: unknown) => void
}) {
  const patch = (prop: string, val: unknown) => onPatch(element.id, prop, val)

  return (
    <div>
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-[var(--color-border,#2a2a32)] flex items-center gap-2">
        <Box size={12} className="text-[#e84545] flex-shrink-0" />
        <span className="text-xs text-[var(--color-text-primary,#f0ece0)] font-medium truncate">
          {element.label || element.id}
        </span>
        <span className="ml-auto text-[9px] font-mono text-[#4a4a52] bg-[#1a1a1f] px-1.5 py-0.5 rounded flex-shrink-0">
          {element.type}
        </span>
      </div>

      {/* Visibility */}
      <Section title="Visibility">
        <ToggleInput label="Visible" value={element.visible} onChange={(v) => patch('visible', v)} />
        <SliderInput
          label="Opacity"
          value={element.opacity}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => patch('opacity', v)}
        />
      </Section>

      {/* Animation timing */}
      <Section title="Animation">
        <NumberInput
          label="Start at"
          value={element.animStartTime}
          min={0}
          step={0.1}
          suffix="s"
          onChange={(v) => patch('animStartTime', v)}
        />
        <NumberInput
          label="Duration"
          value={element.animDuration}
          min={0.1}
          step={0.1}
          suffix="s"
          onChange={(v) => patch('animDuration', v)}
        />
      </Section>

      {/* Type-specific properties */}
      <TypeProperties element={element} palette={palette} onPatch={patch} />

      {/* Agent edit */}
      <Section title="AI Edit">
        <AgentEditButton
          label="Describe what to change"
          context={{
            type: 'element',
            elementId: element.id,
            elementType: element.type,
            layerId: layerId ?? undefined,
            sceneId: sceneId ?? undefined,
            elementDefinition: element,
          }}
        />
      </Section>
    </div>
  )
}

// ── Type-specific property renderer ─────────────────────────
function TypeProperties({
  element,
  palette,
  onPatch,
}: {
  element: SceneElement
  palette: string[]
  onPatch: (property: string, value: unknown) => void
}) {
  const properties = ELEMENT_PROPERTY_MAP[element.type]
  if (!properties || properties.length === 0) {
    // Complex types — agent-only editing
    if (['d3-chart', 'three-object', 'zdog-shape'].includes(element.type)) {
      return (
        <Section title="Note">
          <p className="text-[10px] text-[#6b6b7a] leading-relaxed">
            This element type is best edited via the AI agent. Use the Edit button below to describe your changes.
          </p>
        </Section>
      )
    }
    return null
  }

  // Group properties into Style and Position sections
  const styleProps = properties.filter((p) =>
    [
      'color',
      'fill',
      'stroke',
      'strokeWidth',
      'fillAlpha',
      'fillOpacity',
      'tool',
      'text',
      'fontSize',
      'fontWeight',
      'textAlign',
      'textAnchor',
      'fontFamily',
      'arrowheadSize',
      'cornerRadius',
      'rotation',
      'cardPreset',
      'cardBg',
      'cardBorder',
      'cardShadow',
      'cardText',
      'cardBlur',
      'cardRadius',
      'cardPadding',
      'titleColor',
      'bodyColor',
      'titleSize',
      'bodySize',
      'equationSize',
      'simScale',
    ].includes(p.key),
  )
  const positionProps = properties.filter((p) =>
    ['x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'radius', 'width', 'height', 'cardX', 'cardY', 'cardWidth'].includes(
      p.key,
    ),
  )

  return (
    <>
      {styleProps.length > 0 && (
        <Section title="Style">
          {styleProps.map((prop) => (
            <PropertyControl
              key={prop.key}
              prop={prop}
              value={(element as unknown as Record<string, unknown>)[prop.key]}
              palette={palette}
              onChange={(v) => onPatch(prop.key, v)}
            />
          ))}
        </Section>
      )}
      {positionProps.length > 0 && (
        <Section title="Position">
          {positionProps.map((prop) => (
            <PropertyControl
              key={prop.key}
              prop={prop}
              value={(element as unknown as Record<string, unknown>)[prop.key]}
              palette={palette}
              onChange={(v) => onPatch(prop.key, v)}
            />
          ))}
        </Section>
      )}
    </>
  )
}

// ── Generic property control renderer ───────────────────────
function PropertyControl({
  prop,
  value,
  palette,
  onChange,
}: {
  prop: {
    key: string
    label: string
    control: string
    min?: number
    max?: number
    step?: number
    suffix?: string
    options?: string[]
    optionLabels?: string[]
    allowNone?: boolean
  }
  value: unknown
  palette: string[]
  onChange: (value: unknown) => void
}) {
  switch (prop.control) {
    case 'color':
      return (
        <ColorPicker
          label={prop.label}
          value={String(value ?? 'none')}
          palette={palette}
          allowNone={prop.allowNone}
          onChange={(v) => onChange(v === 'none' ? null : v)}
        />
      )
    case 'number':
      return (
        <NumberInput
          label={prop.label}
          value={Number(value ?? 0)}
          min={prop.min}
          max={prop.max}
          step={prop.step ?? 1}
          suffix={prop.suffix}
          onChange={(v) => onChange(v)}
        />
      )
    case 'slider':
      return (
        <SliderInput
          label={prop.label}
          value={Number(value ?? 0)}
          min={prop.min ?? 0}
          max={prop.max ?? 1}
          step={prop.step ?? 0.01}
          onChange={(v) => onChange(v)}
        />
      )
    case 'select':
      return (
        <SelectInput
          label={prop.label}
          value={String(value ?? '')}
          options={prop.options ?? []}
          optionLabels={prop.optionLabels}
          onChange={(v) => onChange(v)}
        />
      )
    case 'toggle':
      return <ToggleInput label={prop.label} value={Boolean(value)} onChange={(v) => onChange(v)} />
    case 'textarea':
      return <TextareaInput label={prop.label} value={String(value ?? '')} onChange={(v) => onChange(v)} />
    default:
      return null
  }
}

// ── Layer Inspector ─────────────────────────────────────────
function LayerInspector({ layerId, sceneId }: { layerId: string; sceneId: string | null }) {
  return (
    <div>
      <div className="px-3 py-2.5 border-b border-[var(--color-border,#2a2a32)] flex items-center gap-2">
        <Layers size={12} className="text-[#e84545] flex-shrink-0" />
        <span className="text-xs text-[var(--color-text-primary,#f0ece0)] font-medium">Layer: {layerId}</span>
      </div>

      <Section title="AI Edit">
        <AgentEditButton
          label="Edit with AI"
          context={{
            type: 'layer',
            layerId,
            sceneId: sceneId ?? undefined,
          }}
        />
      </Section>
    </div>
  )
}
