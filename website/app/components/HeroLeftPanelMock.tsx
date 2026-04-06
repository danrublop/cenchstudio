'use client'

import { useCallback, useState, type CSSProperties, type ReactNode } from 'react'
import {
  LAYERS_TAB_META,
  type LayersTabSectionId,
} from '../../../lib/layers-tab-header'
import {
  Plus,
  MoreHorizontal,
  FolderOpen,
  Download,
  ChevronDown,
  ChevronRight,
  Film,
  Layers,
  Eye,
  Activity,
  Palette,
  Type,
  Music,
  Box,
  Grid3X3,
} from 'lucide-react'

/** Same custom media tab icon as `components/Editor.tsx` */
function MediaIcon({ size = 19 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21.1935 16.793C20.8437 19.2739 20.6689 20.5143 19.7717 21.2572C18.8745 22 17.5512 22 14.9046 22H9.09536C6.44881 22 5.12553 22 4.22834 21.2572C3.33115 20.5143 3.15626 19.2739 2.80648 16.793L2.38351 13.793C1.93748 10.6294 1.71447 9.04765 2.66232 8.02383C3.61017 7 5.29758 7 8.67239 7H15.3276C18.7024 7 20.3898 7 21.3377 8.02383C22.0865 8.83268 22.1045 9.98979 21.8592 12" />
      <path d="M19.5617 7C19.7904 5.69523 18.7863 4.5 17.4617 4.5H6.53788C5.21323 4.5 4.20922 5.69523 4.43784 7" />
      <path d="M17.4999 4.5C17.5283 4.24092 17.5425 4.11135 17.5427 4.00435C17.545 2.98072 16.7739 2.12064 15.7561 2.01142C15.6494 2 15.5194 2 15.2588 2H8.74099C8.48035 2 8.35002 2 8.24362 2.01142C7.22584 2.12064 6.45481 2.98072 6.45704 4.00434C6.45727 4.11135 6.47146 4.2409 6.49983 4.5" />
      <circle cx="16.5" cy="11.5" r="1.5" />
      <path d="M19.9999 20L17.1157 17.8514C16.1856 17.1586 14.8004 17.0896 13.7766 17.6851L13.5098 17.8403C12.7984 18.2542 11.8304 18.1848 11.2156 17.6758L7.37738 14.4989C6.6113 13.8648 5.38245 13.8309 4.5671 14.4214L3.24316 15.3803" />
    </svg>
  )
}

/** Hero: Scenes, Properties (in-app Setup / `scene`), Transitions, Audio, Text — no separate `properties` tab. */
const SUBHEADER_TAB_IDS: LayersTabSectionId[] = LAYERS_TAB_META.map((m) => m.id).filter(
  (id) => id !== 'interact' && id !== 'properties',
)

function subheaderTabLabel(id: LayersTabSectionId): string {
  if (id === 'scene') return 'Properties'
  return LAYERS_TAB_META.find((m) => m.id === id)?.label ?? id
}

/** Active strip tab is Setup content (`scene`) labeled “Properties” above. */
const SUBHEADER_ACTIVE_TAB: LayersTabSectionId = 'scene'

/** Mirrors `SECTION_COLORS` in `components/tabs/LayersTab.tsx` */
const SETUP_SECTION_ACCENTS: Record<string, string> = {
  'Scene Settings': '#e8a849',
  Style: '#c678dd',
  'Scene Style': '#e06c75',
  'Grid & Snapping': '#61afef',
  '3D Studio': '#5ec4b6',
  Motion: '#56b6c2',
  'SVG Objects': '#e5c07b',
  'Video Layer': '#61afef',
  Charts: '#98c379',
  Physics: '#5ec4b6',
  Canvas: '#d19a66',
}

type MockCollapsibleProps = {
  title: string
  accent: string
  active: boolean
  open: boolean
  onToggle: () => void
  children?: ReactNode
}

/** Same structure as `CollapsibleSection` in `LayersTab.tsx` — chevron closed until expanded. */
function MockCollapsibleSection({ title, accent, active, open, onToggle, children }: MockCollapsibleProps) {
  const chevronColor = active ? accent : 'var(--color-text-muted)'
  const titleColor = active ? accent : 'var(--color-text-muted)'
  /** One size for every section title (matches tab strip + `LayersTab` subheader). */
  const titleClass =
    'min-w-0 flex-1 truncate text-[11px] font-semibold tracking-widest uppercase transition-colors'
  return (
    <section className="overflow-hidden transition-all duration-200">
      <button
        type="button"
        className="no-style flex w-full cursor-pointer items-center gap-1.5 py-2 pr-3 pl-1.5 text-left transition-colors select-none hover:bg-white/[0.03]"
        onClick={onToggle}
      >
        <ChevronRight
          size={14}
          strokeWidth={2.5}
          className={`shrink-0 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
          style={{ color: chevronColor }}
        />
        <span className={titleClass} style={{ color: titleColor }}>
          {title}
        </span>
        {active ? <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: accent }} /> : null}
      </button>
      <div
        className={`transition-all duration-300 ease-in-out overflow-hidden ${
          open ? 'max-h-[8000px] opacity-100' : 'max-h-0 opacity-0 pointer-events-none'
        }`}
      >
        <div className="space-y-4 pt-1 pr-3 pb-3 pl-7">
          {children ?? (
            <p className="text-[11px] leading-snug text-[#6b6b7a]">Content matches the in-app Setup panel.</p>
          )}
        </div>
      </div>
    </section>
  )
}

function MockLayerRow({
  Icon,
  label,
  prominent,
  selected,
}: {
  Icon: typeof Activity
  label: string
  prominent?: boolean
  selected?: boolean
}) {
  return (
    <div
      className={`flex cursor-default items-center gap-0.5 rounded px-1 text-[11px] ${
        prominent ? 'min-h-[30px] py-1' : 'py-0.5'
      } ${
        selected
          ? 'bg-[var(--color-accent)]/15 ring-1 ring-[var(--color-accent)]/40'
          : 'hover:bg-white/[0.04]'
      }`}
    >
      <span className="mock-tb-btn flex h-6 w-6 shrink-0 items-center justify-center text-[var(--color-text-muted)]">
        <Eye size={13} strokeWidth={2} />
      </span>
      <span className="inline-block h-6 w-5 shrink-0" aria-hidden />
      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center text-[var(--color-text-muted)]">
        <Icon size={11} strokeWidth={2.25} />
      </span>
      <span className="min-w-0 flex-1 truncate font-medium text-[var(--color-text-primary)]">{label}</span>
    </div>
  )
}

/** Bottom `SceneLayersStackPanel` — Scene 1 collapsed, Scene 2 expanded with layer rows. */
function HeroLayerStackPanelMock() {
  return (
    <div
      className="flex w-full shrink-0 flex-col border-t bg-[var(--color-panel)]"
      style={{ borderTopColor: 'var(--color-hairline)' }}
      aria-hidden
    >
      <div className="flex flex-shrink-0 items-center bg-[var(--color-panel)] px-2 py-1">
        <span className="mock-tb-btn mr-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-[var(--color-text-muted)]">
          <ChevronDown size={12} className="transition-transform" />
        </span>
        <span className="flex-1 select-none text-[11px] font-semibold tracking-widest text-[var(--color-text-muted)] uppercase">
          Layers
        </span>
        <span className="mock-tb-btn flex h-6 w-6 flex-shrink-0 items-center justify-center rounded text-[var(--color-text-muted)]">
          <Plus size={12} />
        </span>
      </div>

      <div className="agent-mock-scrollbar-hide flex-shrink-0 px-1 py-1.5" style={{ scrollbarWidth: 'none' }}>
        <div className="space-y-2">
          {/* Scene 1 — collapsed */}
          <div className="rounded bg-[var(--color-bg)]/30">
            <div className="flex items-center gap-0.5 rounded px-1 py-0.5 text-[11px]">
              <span className="mock-tb-btn flex h-7 w-7 shrink-0 items-center justify-center rounded text-[var(--color-text-muted)]">
                <ChevronRight size={14} />
              </span>
              <span className="mock-tb-btn flex min-w-0 flex-1 cursor-default items-center gap-1 rounded py-1 pl-0.5 pr-2 text-left">
                <Film size={12} className="shrink-0 text-[var(--color-text-muted)]" />
                <span className="min-w-0 flex-1 truncate font-medium text-[var(--color-text-primary)]">Scene 1</span>
              </span>
            </div>
          </div>

          {/* Scene 2 — expanded (current) */}
          <div className="rounded bg-[var(--color-bg)]/30">
            <div className="flex items-center gap-0.5 rounded px-1 py-0.5 text-[11px] hover:bg-white/[0.04]">
              <span className="mock-tb-btn flex h-7 w-7 shrink-0 items-center justify-center rounded text-[var(--color-text-muted)]">
                <ChevronRight size={14} className="rotate-90 transition-transform" />
              </span>
              <span className="mock-tb-btn flex min-w-0 flex-1 cursor-default items-center gap-1 rounded py-1 pl-0.5 pr-2 text-left">
                <Film size={12} className="shrink-0 text-[var(--color-text-muted)]" />
                <span className="min-w-0 flex-1 truncate font-medium text-[var(--color-text-primary)]">Scene 2</span>
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500/50" />
              </span>
            </div>
            <div className="px-1 pt-0.5 pb-1">
              <ul className="space-y-0.5">
                <li>
                  <MockLayerRow Icon={Activity} label="Motion" prominent selected />
                </li>
                <li>
                  <MockLayerRow Icon={Palette} label="Background" />
                </li>
                <li>
                  <MockLayerRow Icon={Type} label="Text" />
                </li>
                <li>
                  <MockLayerRow Icon={Music} label="Audio" prominent />
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/** In-app Setup (`scene`), shown under the “Properties” tab in this hero mock — same collapsibles as `LayersTab`. */
function HeroSetupTabMock() {
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const toggle = useCallback((key: string) => {
    setOpen((o) => ({ ...o, [key]: !o[key] }))
  }, [])

  const sceneAccent = SETUP_SECTION_ACCENTS['Scene Settings'] ?? '#e8a849'
  const styleAccent = SETUP_SECTION_ACCENTS.Style ?? '#c678dd'
  const sceneStyleAccent = SETUP_SECTION_ACCENTS['Scene Style'] ?? '#e06c75'
  const gridAccent = SETUP_SECTION_ACCENTS['Grid & Snapping'] ?? '#61afef'
  const studio3dAccent = SETUP_SECTION_ACCENTS['3D Studio'] ?? '#5ec4b6'
  const motionAccent = SETUP_SECTION_ACCENTS.Motion ?? '#56b6c2'
  const svgObjectsAccent = SETUP_SECTION_ACCENTS['SVG Objects'] ?? '#e5c07b'
  const videoAccent = SETUP_SECTION_ACCENTS['Video Layer'] ?? '#61afef'
  const chartsAccent = SETUP_SECTION_ACCENTS.Charts ?? '#98c379'
  const physicsAccent = SETUP_SECTION_ACCENTS.Physics ?? '#5ec4b6'
  const canvasAccent = SETUP_SECTION_ACCENTS.Canvas ?? '#d19a66'

  return (
    <div className="agent-mock-scrollbar-hide min-h-0 flex-1 overflow-y-auto overscroll-contain pl-1 pr-4 py-2 [scrollbar-gutter:stable]">
      <div className="space-y-4">
        <MockCollapsibleSection
          title="Scene Settings"
          accent={sceneAccent}
          active
          open={!!open.scene}
          onToggle={() => toggle('scene')}
        >
          <div>
            <label className="mb-1.5 block text-[11px] tracking-wider text-[#6b6b7a] uppercase">Name</label>
            <div
                className="w-full rounded border px-3 py-2 text-[11px] text-[var(--color-text-primary)]"
                style={{
                  backgroundColor: 'var(--color-input-bg)',
                  borderColor: 'var(--color-border)',
                }}
              >
                Scene 2
              </div>
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] tracking-wider text-[#6b6b7a] uppercase">Duration: 12s</label>
            <input type="range" min={3} max={20} value={12} readOnly className="pointer-events-none w-full opacity-90" />
            <div className="mt-0.5 flex justify-between text-[11px] text-[#6b6b7a]">
              <span>3s</span>
              <span>20s</span>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] tracking-wider text-[#6b6b7a] uppercase">Background color</label>
            <div className="flex items-center gap-2">
              <div
                className="h-8 w-8 shrink-0 overflow-hidden rounded-lg border-2"
                style={{ background: '#1a1f2e', borderColor: 'var(--color-border)' }}
                aria-hidden
              />
                <div
                  className="flex-1 rounded border px-3 py-1.5 font-mono text-[11px] text-[var(--color-text-primary)]"
                  style={{
                    backgroundColor: 'var(--color-input-bg)',
                    borderColor: 'var(--color-border)',
                  }}
                >
                  #1a1f2e
                </div>
            </div>
          </div>

          <div className="mt-1 space-y-2 border-t pt-3" style={{ borderColor: 'var(--color-border)' }}>
            <div className="flex items-center gap-2">
              <Box size={12} className="shrink-0 text-[#6b6b7a]" />
              <span className="text-[11px] tracking-wider text-[#6b6b7a] uppercase">3D stage environment</span>
            </div>
            <p className="text-[11px] leading-snug text-[#6b6b7a]">
              For Three.js scenes: built-in world behind your models (
              <span className="font-mono text-[var(--color-text-muted)]">applyCenchThreeEnvironment</span>
              ). With an empty scene code, choosing an environment creates a starter Three.js scene you can edit.
              Animated worlds need{' '}
              <span className="font-mono text-[var(--color-text-muted)]">updateCenchThreeEnvironment(t)</span> each
              frame.
            </p>
            <div
              className="no-style flex w-full cursor-default items-center justify-between gap-1.5 rounded border px-2 py-1 text-[11px]"
              style={{
                backgroundColor: 'var(--color-input-bg)',
                borderColor: 'var(--color-border)',
              }}
            >
              <span className="truncate font-medium text-[#e8a849]">None (custom backdrop only)</span>
              <ChevronDown size={14} className="shrink-0 opacity-60" strokeWidth={2} />
            </div>
          </div>

          <p className="text-[11px] leading-snug text-[#6b6b7a]">
            Transitions and camera moves are in the{' '}
            <span className="text-[var(--color-text-muted)]">Transitions</span> tab.
          </p>
        </MockCollapsibleSection>

        <MockCollapsibleSection
          title="Style"
          accent={styleAccent}
          active
          open={!!open.style}
          onToggle={() => toggle('style')}
        >
          <p className="text-[11px] text-[#6b6b7a]">Project-wide preset, font, and overrides.</p>
          <div className="grid grid-cols-2 gap-1.5">
            {(['Clean', 'Neon', 'Data story', 'Whiteboard', 'Blueprint', 'Kraft'] as const).map((name) => (
              <span
                key={name}
                className={`kbd flex h-7 items-center justify-center ${name === 'Clean' ? 'border-[#e84545] text-[#e84545] shadow-[#800]' : ''}`}
              >
                {name}
              </span>
            ))}
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] tracking-wider text-[#6b6b7a] uppercase">Font</label>
            <div
              className="w-full rounded border px-3 py-2 text-[11px] text-[var(--color-text-primary)]"
              style={{
                backgroundColor: 'var(--color-input-bg)',
                borderColor: 'var(--color-border)',
              }}
            >
              Inter · from preset
            </div>
          </div>
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center gap-1 text-[11px] text-[#6b6b7a] select-none [&::-webkit-details-marker]:hidden">
              <ChevronDown size={10} className="transition-transform group-open:rotate-180" />
              Advanced overrides
            </summary>
            <div className="mt-2 space-y-3">
              <div>
                <label className="mb-1.5 block text-[11px] tracking-wider text-[#6b6b7a] uppercase">
                  Palette override
                </label>
                <div className="flex gap-1">
                  {['#374151', '#e84545', '#4a90d9', '#50c878'].map((c) => (
                    <div
                      key={c}
                      className="h-6 w-8 rounded border border-[var(--color-border)]"
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] tracking-wider text-[#6b6b7a] uppercase">
                  Background override
                </label>
                <div className="h-6 w-8 rounded border border-[var(--color-border)] bg-white" />
              </div>
            </div>
          </details>
        </MockCollapsibleSection>

        <MockCollapsibleSection
          title="Scene Style"
          accent={sceneStyleAccent}
          active={false}
          open={!!open.sceneStyle}
          onToggle={() => toggle('sceneStyle')}
        >
          <div className="space-y-2">
            <p className="text-[11px] text-[#6b6b7a]">Inheriting from project style</p>
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center gap-1 text-[11px] text-[#e84545] select-none [&::-webkit-details-marker]:hidden">
                <ChevronDown size={10} className="transition-transform group-open:rotate-180" />
                Apply scene override
              </summary>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                {(['Minimal', 'Bold', 'Soft', 'Neon'] as const).map((name) => (
                  <span key={name} className="kbd flex h-7 items-center gap-1.5">
                    <span className="flex gap-0.5">
                      <span className="h-2 w-2 rounded-full bg-[#6b7280]" />
                      <span className="h-2 w-2 rounded-full bg-[#9ca3af]" />
                    </span>
                    <span className="truncate">{name}</span>
                  </span>
                ))}
              </div>
            </details>
          </div>
        </MockCollapsibleSection>

        <MockCollapsibleSection
          title="Grid & Snapping"
          accent={gridAccent}
          active
          open={!!open.grid}
          onToggle={() => toggle('grid')}
        >
          <label className="flex cursor-default items-center gap-2">
            <input type="checkbox" defaultChecked className="accent-[#e84545]" disabled />
            <span className="text-[11px] text-[var(--color-text-primary)]">Enable snapping</span>
          </label>
          <div>
            <label className="mb-1.5 block text-[11px] tracking-wider text-[#6b6b7a] uppercase">Grid size</label>
            <div className="flex gap-1.5">
              {([20, 40, 80] as const).map((size) => (
                <span
                  key={size}
                  className={`kbd flex h-7 flex-1 items-center justify-center ${size === 40 ? 'border-[#e84545] text-[#e84545] shadow-[#800]' : ''}`}
                >
                  {size}px
                </span>
              ))}
            </div>
          </div>
          <label className="flex cursor-default items-center gap-2">
            <input type="checkbox" className="accent-[#e84545]" disabled />
            <span className="text-[11px] text-[var(--color-text-primary)]">Show grid overlay</span>
            <span className="ml-auto text-[11px] text-[#6b6b7a]">G</span>
          </label>
          <label className="flex cursor-default items-center gap-2">
            <input type="checkbox" defaultChecked className="accent-[#e84545]" disabled />
            <span className="text-[11px] text-[var(--color-text-primary)]">Snap to other elements</span>
          </label>
        </MockCollapsibleSection>

        {/* Same sections as `LayersTab` Setup (`panelSectionId === 'scene'`) — all start collapsed */}
        <MockCollapsibleSection
          title="3D Studio"
          accent={studio3dAccent}
          active={false}
          open={!!open.zdog}
          onToggle={() => toggle('zdog')}
        >
          <p className="text-[11px] leading-snug text-[#6b6b7a]">
            Pseudo-3D shapes and illustration — edit in the 3D studio panel.
          </p>
          <span className="kbd flex h-8 w-full items-center justify-center text-[11px] text-[#6b6b7a]">
            Open 3D Studio
          </span>
        </MockCollapsibleSection>

        <MockCollapsibleSection
          title="Motion"
          accent={motionAccent}
          active
          open={!!open.motion}
          onToggle={() => toggle('motion')}
        >
          <p className="text-[11px] leading-snug text-[#6b6b7a]">
            Main scene layer (Motion / HTML). Edit in the preview or via the agent.
          </p>
          <div
            className="rounded border px-2 py-2 font-mono text-[11px] text-[var(--color-text-muted)]"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-input-bg)' }}
          >
            12.4k chars · scene code
          </div>
        </MockCollapsibleSection>

        <MockCollapsibleSection
          title="SVG Objects"
          accent={svgObjectsAccent}
          active={false}
          open={!!open.svgObjects}
          onToggle={() => toggle('svgObjects')}
        >
          <p className="text-[11px] text-[#6b6b7a]">transparent stickers</p>
          <div className="flex justify-end">
            <span className="kbd flex h-6 items-center gap-1 px-2 text-[11px] text-[#6b6b7a]">
              <Plus size={11} strokeWidth={2} />
              Add
            </span>
          </div>
          <div
            className="rounded border border-dashed py-3 text-center text-[11px] text-[#6b6b7a]"
            style={{ borderColor: 'var(--color-border)' }}
          >
            No SVG objects
          </div>
        </MockCollapsibleSection>

        <MockCollapsibleSection
          title="Video Layer"
          accent={videoAccent}
          active={false}
          open={!!open.video}
          onToggle={() => toggle('video')}
        >
          <span className="kbd flex h-8 w-full items-center justify-center gap-2 border-dashed text-[11px] text-[#6b6b7a]">
            <Plus size={14} strokeWidth={1.5} />
            <span>Upload MP4</span>
          </span>
          <p className="text-[11px] text-[#6b6b7a]">Or paste URL below when expanded in the app.</p>
        </MockCollapsibleSection>

        <MockCollapsibleSection
          title="Charts"
          accent={chartsAccent}
          active={false}
          open={!!open.charts}
          onToggle={() => toggle('charts')}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-[#6b6b7a]">0 charts</span>
            <span className="kbd flex h-6 items-center gap-1 px-2 text-[11px] text-[#6b6b7a]">
              <Plus size={11} strokeWidth={2} />
              Add
            </span>
          </div>
          <div
            className="rounded border border-dashed py-3 text-center text-[11px] text-[#6b6b7a]"
            style={{ borderColor: 'var(--color-border)' }}
          >
            No chart layers yet. Add one to edit directly in Layers.
          </div>
        </MockCollapsibleSection>

        <MockCollapsibleSection
          title="Physics"
          accent={physicsAccent}
          active={false}
          open={!!open.physics}
          onToggle={() => toggle('physics')}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-[#6b6b7a]">0 layers</span>
            <span className="kbd flex h-6 items-center gap-1 px-2 text-[11px] text-[#6b6b7a]">
              <Plus size={11} strokeWidth={2} />
              Add
            </span>
          </div>
          <div
            className="rounded border border-dashed py-3 text-center text-[11px] text-[#6b6b7a]"
            style={{ borderColor: 'var(--color-border)' }}
          >
            No physics layers yet. Add one to edit simulation params manually.
          </div>
        </MockCollapsibleSection>

        <MockCollapsibleSection
          title="Canvas"
          accent={canvasAccent}
          active={false}
          open={!!open.canvas}
          onToggle={() => toggle('canvas')}
        >
          <p className="text-[11px] leading-snug text-[#6b6b7a]">
            Canvas 2D scene code — procedural drawing on <span className="font-mono text-[11px]">#c</span>.
          </p>
          <span className="kbd flex h-7 w-full items-center justify-center text-[11px] text-[#6b6b7a]">
            Edit canvas scene
          </span>
        </MockCollapsibleSection>
      </div>
    </div>
  )
}

/**
 * Static electron left rail: tool row + tab strip (Setup shown as “Properties”, no duplicate Properties tab) + body + layer stack.
 */
export function HeroLeftPanelMock() {
  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-[var(--color-panel)]">
      {/* Sidebar header — Media / Layers / Projects / Export */}
      <div className="flex flex-shrink-0 justify-between gap-2 px-3 pt-2 pb-2">
        <div className="flex w-full flex-row items-center justify-center gap-2">
          <div className="mock-tb-btn electron-titlebar-icon flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors">
            <MediaIcon size={19} />
          </div>
          <div className="mock-tb-btn electron-titlebar-icon electron-titlebar-icon-active flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors">
            <Layers size={19} strokeWidth={1.5} />
          </div>
          <div className="mock-tb-btn electron-titlebar-icon flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors">
            <FolderOpen size={19} strokeWidth={1.5} />
          </div>
          <div className="mock-tb-btn electron-titlebar-icon flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors">
            <Download size={19} strokeWidth={1.5} />
          </div>
        </div>
      </div>

      {/* `LayersTabSubheader` */}
      <div className="flex flex-shrink-0 items-center gap-0.5 bg-[var(--color-panel)] px-1 py-1">
        <div
          className="agent-mock-scrollbar-hide flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto"
          style={{ scrollbarWidth: 'none' }}
        >
          {SUBHEADER_TAB_IDS.map((id) => {
            const active = id === SUBHEADER_ACTIVE_TAB
            const label = subheaderTabLabel(id)
            return (
              <span
                key={id}
                role="tab"
                aria-selected={active}
                className={`chat-tab max-w-[120px] flex-shrink-0 cursor-default select-none overflow-hidden rounded px-2 py-1 text-[11px] outline-none transition-all ${
                  active
                    ? 'bg-[var(--agent-chat-user-surface)] text-[var(--color-text-primary)]'
                    : 'text-[var(--color-text-muted)] hover:bg-[var(--color-panel)]/50 hover:text-[var(--kbd-text)]'
                } whitespace-nowrap`}
                style={
                  {
                    '--tab-bg': active ? 'var(--color-panel)' : 'var(--color-bg)',
                  } as CSSProperties
                }
              >
                <span className="inline-block max-w-[108px] truncate align-bottom">{label}</span>
              </span>
            )
          })}
        </div>
        <div className="relative ml-0.5 flex flex-shrink-0">
          <button
            type="button"
            className="hero-mock-layers-more no-style flex h-7 w-7 cursor-default items-center justify-center rounded hover:bg-[var(--color-panel)]/50"
            aria-label="Configure tabs"
            tabIndex={-1}
          >
            <MoreHorizontal size={14} strokeWidth={2} className="shrink-0" />
          </button>
        </div>
      </div>

      <HeroSetupTabMock />

      <HeroLayerStackPanelMock />
    </div>
  )
}
