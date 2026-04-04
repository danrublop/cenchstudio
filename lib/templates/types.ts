import type { SceneLayer, SceneStyleOverride } from '../types'

export type TemplateCategory =
  | 'title-card'
  | 'diagram'
  | 'comparison'
  | 'data'
  | 'process'
  | 'quote'
  | 'transition'
  | 'chalkboard'
  | 'technical'
  | 'interactive'
  | 'custom'

export interface SceneTemplate {
  id: string
  name: string
  description: string
  category: TemplateCategory
  tags: string[]
  thumbnail: string | null

  layers: Omit<SceneLayer, 'id'>[]
  duration: number
  styleOverride: SceneStyleOverride

  isBuiltIn: boolean
  isPublic: boolean
  authorId: string | null
  useCount: number
  createdAt: string

  placeholders: string[]

  /** Pre-configured interactions for interactive templates.
   *  Each interaction omits `id` (generated during instantiation).
   *  Uses Record to allow type-specific fields from the union. */
  interactions?: Array<Record<string, any>>
}

export const TEMPLATE_CATEGORIES: { value: TemplateCategory; label: string }[] = [
  { value: 'title-card', label: 'Title Cards' },
  { value: 'diagram', label: 'Diagrams' },
  { value: 'data', label: 'Data & Charts' },
  { value: 'process', label: 'Process' },
  { value: 'comparison', label: 'Comparison' },
  { value: 'quote', label: 'Quotes / Text' },
  { value: 'transition', label: 'Transitions' },
  { value: 'technical', label: 'Technical' },
  { value: 'chalkboard', label: 'Chalkboard' },
  { value: 'interactive', label: 'Interactive' },
  { value: 'custom', label: 'Custom' },
]
