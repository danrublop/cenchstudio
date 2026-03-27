'use client'

import { useState } from 'react'
import { useVideoStore } from '@/lib/store'
import { v4 as uuidv4 } from 'uuid'
import { Trash2, Edit3, ChevronDown, ChevronRight, Plus, X } from 'lucide-react'
import type {
  Scene,
  InteractionElement,
  HotspotElement,
  ChoiceElement,
  QuizElement,
  GateElement,
  TooltipElement,
  FormInputElement,
  ChoiceOption,
  QuizOption,
  FormField,
} from '@/lib/types'

const TYPE_COLORS: Record<string, string> = {
  hotspot: '#f59e0b',
  choice: '#3b82f6',
  quiz: '#8b5cf6',
  gate: '#10b981',
  tooltip: '#06b6d4',
  form: '#ec4899',
}

const TYPE_ICONS: Record<string, string> = {
  hotspot: '🎯',
  choice: '🔀',
  quiz: '❓',
  gate: '🚪',
  tooltip: '💬',
  form: '📋',
}

function createDefaultInteraction(type: InteractionElement['type']): InteractionElement {
  const base = {
    id: uuidv4(),
    x: 40,
    y: 40,
    width: 20,
    height: 10,
    appearsAt: 0,
    hidesAt: null as null,
    entranceAnimation: 'fade' as const,
  }

  switch (type) {
    case 'hotspot':
      return {
        ...base,
        type: 'hotspot',
        label: 'Click me',
        shape: 'circle',
        style: 'pulse',
        color: '#e84545',
        triggersEdgeId: null,
        jumpsToSceneId: null,
      } as HotspotElement
    case 'choice':
      return {
        ...base,
        type: 'choice',
        question: 'What would you like to do?',
        layout: 'horizontal',
        options: [
          { id: uuidv4(), label: 'Option A', icon: null, jumpsToSceneId: '', color: null },
          { id: uuidv4(), label: 'Option B', icon: null, jumpsToSceneId: '', color: null },
        ],
      } as ChoiceElement
    case 'quiz':
      const optA = uuidv4()
      const optB = uuidv4()
      return {
        ...base,
        type: 'quiz',
        question: 'Which answer is correct?',
        options: [
          { id: optA, label: 'Option A' },
          { id: optB, label: 'Option B' },
        ],
        correctOptionId: optA,
        onCorrect: 'continue',
        onCorrectSceneId: null,
        onWrong: 'retry',
        onWrongSceneId: null,
        explanation: null,
      } as QuizElement
    case 'gate':
      return {
        ...base,
        type: 'gate',
        buttonLabel: 'Continue →',
        buttonStyle: 'primary',
        minimumWatchTime: 0,
      } as GateElement
    case 'tooltip':
      return {
        ...base,
        width: 5,
        height: 5,
        type: 'tooltip',
        triggerShape: 'circle',
        triggerColor: '#3b82f6',
        triggerLabel: null,
        tooltipTitle: 'Tip',
        tooltipBody: 'Enter your tooltip text here.',
        tooltipPosition: 'top',
        tooltipMaxWidth: 240,
      } as TooltipElement
    case 'form':
      return {
        ...base,
        type: 'form',
        fields: [{ id: uuidv4(), label: 'Your name', type: 'text', placeholder: 'Enter name...', options: [], required: true }],
        submitLabel: 'Continue',
        setsVariables: [],
        jumpsToSceneId: null,
      } as FormInputElement
  }
}

// ── Element Editor ────────────────────────────────────────────────────────────

function ElementEditor({ scene, el, onClose }: { scene: Scene; el: InteractionElement; onClose: () => void }) {
  const { updateInteraction } = useVideoStore()
  const update = (updates: Partial<InteractionElement>) => updateInteraction(scene.id, el.id, updates)

  const fieldClass = 'w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-2 py-1 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)]'
  const labelClass = 'text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-1 block'

  return (
    <div className="space-y-3 p-3 border-t border-[var(--color-border)]">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-[var(--color-text-primary)]">
          {TYPE_ICONS[el.type]} Edit {el.type}
        </span>
        <button onClick={onClose} className="kbd w-6 h-6 p-0 flex items-center justify-center text-[10px]">
          <X size={10} />
        </button>
      </div>

      {/* Common base fields */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={labelClass}>X (%)</label>
          <input type="number" className={fieldClass} value={Math.round(el.x)} min={0} max={100}
            onChange={e => update({ x: Number(e.target.value) } as any)} />
        </div>
        <div>
          <label className={labelClass}>Y (%)</label>
          <input type="number" className={fieldClass} value={Math.round(el.y)} min={0} max={100}
            onChange={e => update({ y: Number(e.target.value) } as any)} />
        </div>
        <div>
          <label className={labelClass}>Width (%)</label>
          <input type="number" className={fieldClass} value={Math.round(el.width)} min={1} max={100}
            onChange={e => update({ width: Number(e.target.value) } as any)} />
        </div>
        <div>
          <label className={labelClass}>Height (%)</label>
          <input type="number" className={fieldClass} value={Math.round(el.height)} min={1} max={100}
            onChange={e => update({ height: Number(e.target.value) } as any)} />
        </div>
        <div>
          <label className={labelClass}>Appears at (s)</label>
          <input type="number" className={fieldClass} value={el.appearsAt} min={0} step={0.5}
            onChange={e => update({ appearsAt: Number(e.target.value) } as any)} />
        </div>
        <div>
          <label className={labelClass}>Hides at (s)</label>
          <input type="number" className={fieldClass} value={el.hidesAt ?? ''} placeholder="never"
            min={0} step={0.5}
            onChange={e => update({ hidesAt: e.target.value ? Number(e.target.value) : null } as any)} />
        </div>
      </div>

      <div>
        <label className={labelClass}>Entrance animation</label>
        <select className={fieldClass} value={el.entranceAnimation}
          onChange={e => update({ entranceAnimation: e.target.value as any })}>
          <option value="fade">Fade</option>
          <option value="slide-up">Slide up</option>
          <option value="pop">Pop</option>
          <option value="none">None</option>
        </select>
      </div>

      {/* Type-specific fields */}
      {el.type === 'hotspot' && <HotspotFields el={el} update={update} fieldClass={fieldClass} labelClass={labelClass} />}
      {el.type === 'choice' && <ChoiceFields scene={scene} el={el} update={update} fieldClass={fieldClass} labelClass={labelClass} />}
      {el.type === 'quiz' && <QuizFields scene={scene} el={el} update={update} fieldClass={fieldClass} labelClass={labelClass} />}
      {el.type === 'gate' && <GateFields el={el} update={update} fieldClass={fieldClass} labelClass={labelClass} />}
      {el.type === 'tooltip' && <TooltipFields el={el} update={update} fieldClass={fieldClass} labelClass={labelClass} />}
      {el.type === 'form' && <FormFields scene={scene} el={el} update={update} fieldClass={fieldClass} labelClass={labelClass} />}
    </div>
  )
}

function HotspotFields({ el, update, fieldClass, labelClass }: any) {
  return (
    <>
      <div>
        <label className={labelClass}>Label</label>
        <input className={fieldClass} value={el.label} onChange={e => update({ label: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={labelClass}>Shape</label>
          <select className={fieldClass} value={el.shape} onChange={e => update({ shape: e.target.value })}>
            <option value="circle">Circle</option>
            <option value="rectangle">Rectangle</option>
            <option value="pill">Pill</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Style</label>
          <select className={fieldClass} value={el.style} onChange={e => update({ style: e.target.value })}>
            <option value="pulse">Pulse</option>
            <option value="glow">Glow</option>
            <option value="border">Border</option>
            <option value="filled">Filled</option>
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>Color</label>
        <input type="color" className="w-full h-7 rounded border border-[var(--color-border)] bg-transparent cursor-pointer"
          value={el.color} onChange={e => update({ color: e.target.value })} />
      </div>
    </>
  )
}

function ChoiceFields({ scene, el, update, fieldClass, labelClass }: any) {
  return (
    <>
      <div>
        <label className={labelClass}>Question</label>
        <input className={fieldClass} value={el.question ?? ''} placeholder="Optional question text"
          onChange={e => update({ question: e.target.value || null })} />
      </div>
      <div>
        <label className={labelClass}>Layout</label>
        <select className={fieldClass} value={el.layout} onChange={e => update({ layout: e.target.value })}>
          <option value="horizontal">Horizontal</option>
          <option value="vertical">Vertical</option>
          <option value="grid">Grid</option>
        </select>
      </div>
      <div>
        <label className={labelClass}>Options</label>
        <div className="space-y-1.5">
          {(el.options as ChoiceOption[]).map((opt, i) => (
            <div key={opt.id} className="flex gap-1 items-center">
              <input className={`${fieldClass} flex-1`} value={opt.label} placeholder={`Option ${i + 1}`}
                onChange={e => {
                  const options = el.options.map((o: ChoiceOption) => o.id === opt.id ? { ...o, label: e.target.value } : o)
                  update({ options })
                }} />
              <button className="kbd w-6 h-6 p-0 flex items-center justify-center shrink-0"
                onClick={() => update({ options: el.options.filter((o: ChoiceOption) => o.id !== opt.id) })}>
                <Trash2 size={10} />
              </button>
            </div>
          ))}
          <button className="kbd w-full h-6 text-[10px] flex items-center justify-center gap-1"
            onClick={() => update({ options: [...el.options, { id: uuidv4(), label: 'New option', icon: null, jumpsToSceneId: '', color: null }] })}>
            <Plus size={10} /> Add option
          </button>
        </div>
      </div>
    </>
  )
}

function QuizFields({ scene, el, update, fieldClass, labelClass }: any) {
  return (
    <>
      <div>
        <label className={labelClass}>Question</label>
        <textarea className={`${fieldClass} h-14 resize-none`} value={el.question}
          onChange={e => update({ question: e.target.value })} />
      </div>
      <div>
        <label className={labelClass}>Options & Correct Answer</label>
        <div className="space-y-1.5">
          {(el.options as QuizOption[]).map((opt, i) => (
            <div key={opt.id} className="flex gap-1 items-center">
              <input type="radio" name={`quiz-correct-${el.id}`} checked={el.correctOptionId === opt.id}
                onChange={() => update({ correctOptionId: opt.id })}
                className="shrink-0 accent-green-500" />
              <input className={`${fieldClass} flex-1`} value={opt.label} placeholder={`Option ${i + 1}`}
                onChange={e => {
                  const options = el.options.map((o: QuizOption) => o.id === opt.id ? { ...o, label: e.target.value } : o)
                  update({ options })
                }} />
              <button className="kbd w-6 h-6 p-0 flex items-center justify-center shrink-0"
                onClick={() => update({ options: el.options.filter((o: QuizOption) => o.id !== opt.id) })}>
                <Trash2 size={10} />
              </button>
            </div>
          ))}
          <button className="kbd w-full h-6 text-[10px] flex items-center justify-center gap-1"
            onClick={() => update({ options: [...el.options, { id: uuidv4(), label: 'New option' }] })}>
            <Plus size={10} /> Add option
          </button>
        </div>
      </div>
      <div>
        <label className={labelClass}>Explanation (shown after answering)</label>
        <input className={fieldClass} value={el.explanation ?? ''} placeholder="Optional explanation"
          onChange={e => update({ explanation: e.target.value || null })} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={labelClass}>On correct</label>
          <select className={fieldClass} value={el.onCorrect} onChange={e => update({ onCorrect: e.target.value })}>
            <option value="continue">Continue</option>
            <option value="jump">Jump to scene</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>On wrong</label>
          <select className={fieldClass} value={el.onWrong} onChange={e => update({ onWrong: e.target.value })}>
            <option value="retry">Retry</option>
            <option value="continue">Continue</option>
            <option value="jump">Jump to scene</option>
          </select>
        </div>
      </div>
    </>
  )
}

function GateFields({ el, update, fieldClass, labelClass }: any) {
  return (
    <>
      <div>
        <label className={labelClass}>Button label</label>
        <input className={fieldClass} value={el.buttonLabel} onChange={e => update({ buttonLabel: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={labelClass}>Button style</label>
          <select className={fieldClass} value={el.buttonStyle} onChange={e => update({ buttonStyle: e.target.value })}>
            <option value="primary">Primary</option>
            <option value="outline">Outline</option>
            <option value="minimal">Minimal</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Min. watch time (s)</label>
          <input type="number" className={fieldClass} value={el.minimumWatchTime} min={0}
            onChange={e => update({ minimumWatchTime: Number(e.target.value) })} />
        </div>
      </div>
    </>
  )
}

function TooltipFields({ el, update, fieldClass, labelClass }: any) {
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={labelClass}>Trigger shape</label>
          <select className={fieldClass} value={el.triggerShape} onChange={e => update({ triggerShape: e.target.value })}>
            <option value="circle">Circle</option>
            <option value="rectangle">Rectangle</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Trigger color</label>
          <input type="color" className="w-full h-7 rounded border border-[var(--color-border)] bg-transparent cursor-pointer"
            value={el.triggerColor} onChange={e => update({ triggerColor: e.target.value })} />
        </div>
      </div>
      <div>
        <label className={labelClass}>Tooltip title</label>
        <input className={fieldClass} value={el.tooltipTitle} onChange={e => update({ tooltipTitle: e.target.value })} />
      </div>
      <div>
        <label className={labelClass}>Tooltip body</label>
        <textarea className={`${fieldClass} h-16 resize-none`} value={el.tooltipBody}
          onChange={e => update({ tooltipBody: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={labelClass}>Position</label>
          <select className={fieldClass} value={el.tooltipPosition} onChange={e => update({ tooltipPosition: e.target.value })}>
            <option value="top">Top</option>
            <option value="bottom">Bottom</option>
            <option value="left">Left</option>
            <option value="right">Right</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Max width (px)</label>
          <input type="number" className={fieldClass} value={el.tooltipMaxWidth}
            onChange={e => update({ tooltipMaxWidth: Number(e.target.value) })} />
        </div>
      </div>
    </>
  )
}

function FormFields({ scene, el, update, fieldClass, labelClass }: any) {
  return (
    <>
      <div>
        <label className={labelClass}>Submit button label</label>
        <input className={fieldClass} value={el.submitLabel} onChange={e => update({ submitLabel: e.target.value })} />
      </div>
      <div>
        <label className={labelClass}>Fields</label>
        <div className="space-y-2">
          {(el.fields as FormField[]).map((field, i) => (
            <div key={field.id} className="border border-[var(--color-border)] rounded p-2 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-[var(--color-text-muted)]">Field {i + 1}</span>
                <button className="kbd w-5 h-5 p-0 flex items-center justify-center"
                  onClick={() => update({ fields: el.fields.filter((f: FormField) => f.id !== field.id) })}>
                  <X size={9} />
                </button>
              </div>
              <input className={fieldClass} value={field.label} placeholder="Field label"
                onChange={e => {
                  const fields = el.fields.map((f: FormField) => f.id === field.id ? { ...f, label: e.target.value } : f)
                  update({ fields })
                }} />
              <select className={fieldClass} value={field.type}
                onChange={e => {
                  const fields = el.fields.map((f: FormField) => f.id === field.id ? { ...f, type: e.target.value } : f)
                  update({ fields })
                }}>
                <option value="text">Text input</option>
                <option value="select">Dropdown</option>
                <option value="radio">Radio</option>
              </select>
            </div>
          ))}
          <button className="kbd w-full h-6 text-[10px] flex items-center justify-center gap-1"
            onClick={() => update({ fields: [...el.fields, { id: uuidv4(), label: 'New field', type: 'text', placeholder: null, options: [], required: false }] })}>
            <Plus size={10} /> Add field
          </button>
        </div>
      </div>
    </>
  )
}

// ── InteractTab ───────────────────────────────────────────────────────────────

export default function InteractTab({ scene }: { scene: Scene }) {
  const {
    addInteraction, removeInteraction, project,
    setShowModeModal, setPendingMode
  } = useVideoStore()
  const [editingId, setEditingId] = useState<string | null>(null)

  const interactions: InteractionElement[] = scene.interactions ?? []

  const handleModeToggle = () => {
    const nextMode = project.outputMode === 'mp4' ? 'interactive' : 'mp4'
    setPendingMode(nextMode)
    setShowModeModal(true)
  }

  const addElement = (type: InteractionElement['type']) => {
    const el = createDefaultInteraction(type)
    addInteraction(scene.id, el)
    setEditingId(el.id)
  }

  const typeButtons: { type: InteractionElement['type']; label: string }[] = [
    { type: 'hotspot', label: '🎯 Hotspot' },
    { type: 'choice', label: '🔀 Choice' },
    { type: 'quiz', label: '❓ Quiz' },
    { type: 'gate', label: '🚪 Gate' },
    { type: 'tooltip', label: '💬 Tooltip' },
    { type: 'form', label: '📋 Form' },
  ]

  return (
    <div className="p-3 space-y-4">
      {/* Mode Toggle Switch */}
      <div className="flex items-center justify-between p-3 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl shadow-sm">
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] font-bold text-[var(--color-text-primary)]">Interactive Video</span>
          <span className="text-[10px] text-[var(--color-text-muted)]">Enable branching & hotspots</span>
        </div>
        <div className="flex-shrink-0">
          <input
            id="interactive-mode-toggle"
            type="checkbox"
            className="tgl"
            checked={project.outputMode === 'interactive'}
            onChange={handleModeToggle}
          />
          <label className="tgl-btn" htmlFor="interactive-mode-toggle" />
        </div>
      </div>

      <div className="border-t border-[var(--color-border)]" />

      {/* Add buttons */}
      <div>
        <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
          Add interaction element
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {typeButtons.map(({ type, label }) => (
            <button
              key={type}
              onClick={() => addElement(type)}
              className="kbd h-7 text-[11px] font-bold flex items-center justify-center gap-1"
              style={{ borderColor: TYPE_COLORS[type] + '60', color: TYPE_COLORS[type] }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* List of existing interactions */}
      {interactions.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-[11px] text-[var(--color-text-muted)]">No interactions yet.</p>
          <p className="text-[10px] text-[#3a3a45] mt-1">Add hotspots, choices, quizzes, and more above.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
            {interactions.length} element{interactions.length !== 1 ? 's' : ''}
          </p>
          {interactions.map((el) => {
            const color = TYPE_COLORS[el.type] ?? '#e84545'
            const isEditing = editingId === el.id

            return (
              <div
                key={el.id}
                className="border border-[var(--color-border)] rounded-lg overflow-hidden"
                style={{ borderColor: isEditing ? color : undefined }}
              >
                {/* Card header */}
                <div className="flex items-center gap-2 px-3 py-2">
                  <span className="text-sm">{TYPE_ICONS[el.type]}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-[var(--color-text-primary)] capitalize">{el.type}</p>
                    <p className="text-[9px] text-[var(--color-text-muted)]">
                      {Math.round(el.x)}%, {Math.round(el.y)}% · appears at {el.appearsAt}s
                    </p>
                  </div>
                  <button
                    onClick={() => setEditingId(isEditing ? null : el.id)}
                    className="kbd w-6 h-6 p-0 flex items-center justify-center"
                  >
                    {isEditing ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  </button>
                  <button
                    onClick={() => {
                      removeInteraction(scene.id, el.id)
                      if (editingId === el.id) setEditingId(null)
                    }}
                    className="kbd w-6 h-6 p-0 flex items-center justify-center text-[#ef4444]"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>

                {/* Inline editor */}
                {isEditing && (
                  <ElementEditor scene={scene} el={el} onClose={() => setEditingId(null)} />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
