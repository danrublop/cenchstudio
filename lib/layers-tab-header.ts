/** Persisted Layers tab strip (second header) — mirrors Agent chat tab UX. */

export type LayersTabSectionId =
  | 'scenes'
  | 'scene'
  | 'properties'
  | 'transitions'
  | 'audio'
  | 'elements'
  | 'text'
  | 'interact'

/** Old tab ids → Scene panel (Content tab removed) */
const LEGACY_TAB_TO_SCENE = new Set(['media', 'ai', 'content'])

/** Persisted `style` tab → Scene panel */
const LEGACY_STYLE_TO_SCENE = 'style'

/** Tabs shown in the strip config (⋯) — Elements is opened via preview only, not listed here */
export const LAYERS_TAB_META: { id: LayersTabSectionId; label: string }[] = [
  { id: 'scenes', label: 'Scenes' },
  { id: 'scene', label: 'Setup' },
  { id: 'properties', label: 'Properties' },
  { id: 'transitions', label: 'Transitions' },
  { id: 'audio', label: 'Audio' },
  { id: 'text', label: 'Text' },
  { id: 'interact', label: 'Interact' },
]

const EXTRA_TAB_LABELS: Partial<Record<LayersTabSectionId, string>> = {
  elements: 'Elements',
}

export function layersTabLabel(id: LayersTabSectionId): string {
  return LAYERS_TAB_META.find((m) => m.id === id)?.label ?? EXTRA_TAB_LABELS[id] ?? id
}

export const DEFAULT_LAYERS_VISIBLE_TABS: LayersTabSectionId[] = ['scene', 'properties', 'transitions', 'audio', 'text']

const STORAGE_KEY = 'cench.layersTab.subheader.v1'

export type LayersTabHeaderPersisted = {
  visibleTabIds: LayersTabSectionId[]
  activeTabId: LayersTabSectionId
}

const DEFAULT_PERSISTED: LayersTabHeaderPersisted = {
  visibleTabIds: [...DEFAULT_LAYERS_VISIBLE_TABS],
  activeTabId: 'scene',
}

function migrateVisibleTabs(rawIds: unknown): LayersTabSectionId[] {
  const allowed = new Set(LAYERS_TAB_META.map((m) => m.id))
  const arr = Array.isArray(rawIds) ? rawIds : DEFAULT_LAYERS_VISIBLE_TABS
  const mapped = arr.map((id) => {
    if (typeof id !== 'string') return id as LayersTabSectionId
    if (id === LEGACY_STYLE_TO_SCENE) return 'scene'
    if (LEGACY_TAB_TO_SCENE.has(id)) return 'scene'
    return id as LayersTabSectionId
  })
  const deduped: LayersTabSectionId[] = []
  for (const id of mapped) {
    if (!allowed.has(id)) continue
    if (!deduped.includes(id)) deduped.push(id)
  }
  return deduped.length > 0 ? deduped : [...DEFAULT_LAYERS_VISIBLE_TABS]
}

export function loadLayersTabHeader(): LayersTabHeaderPersisted {
  if (typeof window === 'undefined') return { ...DEFAULT_PERSISTED, visibleTabIds: [...DEFAULT_LAYERS_VISIBLE_TABS] }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_PERSISTED, visibleTabIds: [...DEFAULT_LAYERS_VISIBLE_TABS] }
    const p = JSON.parse(raw) as {
      visibleTabIds?: unknown
      activeTabId?: string
    }
    const allowed = new Set(LAYERS_TAB_META.map((m) => m.id))
    let visible = migrateVisibleTabs(p.visibleTabIds)
    let activeRaw: string | undefined = p.activeTabId
    if (typeof activeRaw === 'string') {
      if (activeRaw === LEGACY_STYLE_TO_SCENE) activeRaw = 'scene'
      else if (LEGACY_TAB_TO_SCENE.has(activeRaw)) activeRaw = 'scene'
    }
    let active = (
      activeRaw && allowed.has(activeRaw as LayersTabSectionId) ? activeRaw : visible[0]
    ) as LayersTabSectionId
    if (!visible.includes(active)) active = visible[0]
    return {
      visibleTabIds: visible,
      activeTabId: active,
    }
  } catch {
    return { ...DEFAULT_PERSISTED, visibleTabIds: [...DEFAULT_LAYERS_VISIBLE_TABS] }
  }
}

export function saveLayersTabHeader(p: LayersTabHeaderPersisted): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p))
  } catch {
    /* ignore */
  }
}
