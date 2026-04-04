'use client'

import { useState, useMemo } from 'react'
import { X } from 'lucide-react'
import type { SceneTemplate, TemplateCategory } from '@/lib/templates/types'
import { TEMPLATE_CATEGORIES } from '@/lib/templates/types'
import { BUILT_IN_TEMPLATES } from '@/lib/templates/built-in'

interface TemplatePickerProps {
  onSelect: (template: SceneTemplate) => void
  onSkip: () => void
  onClose: () => void
  suggestedCategory?: TemplateCategory | null
}

export default function TemplatePicker({ onSelect, onSkip, onClose, suggestedCategory }: TemplatePickerProps) {
  const [category, setCategory] = useState<string>(suggestedCategory ?? 'all')
  const [search, setSearch] = useState('')

  const filteredTemplates = useMemo(() => {
    let list = BUILT_IN_TEMPLATES
    if (category !== 'all') {
      list = list.filter((t) => t.category === category)
    }
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.tags.some((tag) => tag.includes(q)),
      )
    }
    return list
  }, [category, search])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="rounded-xl border shadow-2xl w-[640px] max-h-[80vh] overflow-hidden flex flex-col"
        style={{ backgroundColor: 'var(--color-panel-bg)', borderColor: 'var(--color-border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Choose a Template</h2>
          <button onClick={onClose} className="text-[#6b6b7a] hover:text-[var(--color-text-primary)]">
            <X size={16} />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 pt-3">
          <input
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#e84545] transition-colors"
            style={{
              backgroundColor: 'var(--color-input-bg)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text-primary)',
            }}
          />
        </div>

        {/* Category pills */}
        <div className="px-5 pt-3 flex gap-1.5 flex-wrap">
          <button
            onClick={() => setCategory('all')}
            className="rounded-full px-3 py-1 text-[11px] border transition-colors"
            style={{
              background: category === 'all' ? '#e84545' : 'transparent',
              borderColor: category === 'all' ? '#e84545' : 'var(--color-border)',
              color: category === 'all' ? '#fff' : '#6b6b7a',
            }}
          >
            All
          </button>
          {TEMPLATE_CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setCategory(cat.value)}
              className="rounded-full px-3 py-1 text-[11px] border transition-colors"
              style={{
                background: category === cat.value ? '#e84545' : 'transparent',
                borderColor: category === cat.value ? '#e84545' : 'var(--color-border)',
                color: category === cat.value ? '#fff' : '#6b6b7a',
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Template grid */}
        <div className="flex-1 overflow-y-auto p-5">
          <div className="grid grid-cols-3 gap-3">
            {/* Blank scene option */}
            <div
              onClick={onSkip}
              className="border-2 border-dashed rounded-lg cursor-pointer hover:border-[#e84545] transition-colors flex flex-col items-center justify-center"
              style={{ borderColor: 'var(--color-border)', aspectRatio: '16/9' }}
            >
              <span className="text-xl text-[#6b6b7a]">+</span>
              <span className="text-[11px] text-[#6b6b7a] mt-1">Blank scene</span>
            </div>

            {filteredTemplates.map((template) => (
              <div
                key={template.id}
                onClick={() => onSelect(template)}
                className="border rounded-lg cursor-pointer overflow-hidden hover:border-[#e84545] transition-colors group"
                style={{ borderColor: 'var(--color-border)' }}
              >
                {/* Thumbnail placeholder */}
                <div
                  className="w-full flex items-center justify-center"
                  style={{
                    aspectRatio: '16/9',
                    background: template.styleOverride.bgColor ?? 'var(--color-input-bg)',
                  }}
                >
                  {template.styleOverride.palette ? (
                    <div className="flex gap-1.5">
                      {template.styleOverride.palette.map((c, i) => (
                        <div key={i} className="w-4 h-4 rounded-full" style={{ background: c }} />
                      ))}
                    </div>
                  ) : (
                    <span className="text-[10px] text-[#6b6b7a] uppercase tracking-wider">{template.category}</span>
                  )}
                </div>
                <div className="p-2">
                  <div className="text-[11px] font-semibold text-[var(--color-text-primary)] truncate">
                    {template.name}
                  </div>
                  <div className="text-[9px] text-[#6b6b7a] mt-0.5 line-clamp-2">{template.description}</div>
                </div>
              </div>
            ))}
          </div>

          {filteredTemplates.length === 0 && (
            <div className="text-center py-8 text-[#6b6b7a] text-sm">No templates match your search</div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t flex justify-end" style={{ borderColor: 'var(--color-border)' }}>
          <button onClick={onSkip} className="text-[11px] text-[#6b6b7a] hover:text-[var(--color-text-primary)]">
            Skip — start blank
          </button>
        </div>
      </div>
    </div>
  )
}
