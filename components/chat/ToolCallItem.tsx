'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, CheckCircle2, XCircle } from 'lucide-react'
import type { ToolCallRecord } from '@/lib/agents/types'

const TOOL_DISPLAY_NAMES: Record<string, string> = {
  add_layer: 'Creating layer',
  add_canvas_layer: 'Creating canvas animation',
  add_svg_layer: 'Creating SVG graphic',
  add_three_layer: 'Creating 3D scene',
  add_d3_layer: 'Creating data visualization',
  add_lottie_layer: 'Adding Lottie animation',
  add_zdog_layer: 'Creating Zdog illustration',
  regenerate_layer: 'Regenerating layer',
  edit_layer: 'Editing layer',
  patch_layer_code: 'Patching layer code',
  delete_layer: 'Deleting layer',
  rename_scene: 'Renaming scene',
  add_scene: 'Adding scene',
  delete_scene: 'Deleting scene',
  reorder_scenes: 'Reordering scenes',
  update_global_style: 'Updating global style',
  set_global_style: 'Setting global style',
  add_interaction: 'Adding interaction',
  add_multiple_interactions: 'Adding interactions',
  edit_interaction: 'Editing interaction',
  remove_interaction: 'Removing interaction',
  generate_image: 'Generating image',
  generate_audio: 'Generating audio',
  generate_video: 'Generating video clip',
  generate_avatar_narration: 'Adding avatar narrator',
  generate_avatar_scene: 'Creating avatar scene',
  generate_chart: 'Creating chart',
  add_narration: 'Adding narration',
  add_sound_effect: 'Adding sound effect',
  add_background_music: 'Adding background music',
  verify_scene: 'Verifying scene',
  plan_scenes: 'Planning scenes',
  set_transition: 'Setting transition',
  search_web: 'Searching the web',
  read_url: 'Reading URL',
  web_search: 'Searching the web',
  fetch_url_content: 'Reading article',
  find_stock_videos: 'Finding stock video',
  connect_scenes: 'Connecting scenes',
  define_scene_variable: 'Defining variable',
  set_video_layer: 'Setting video layer',
}

/** Extract a human-readable one-line summary from tool output */
function summarizeOutput(call: ToolCallRecord): string | null {
  const output = call.output
  if (!output) return null

  const changes = output.changes
  if (changes && Array.isArray(changes) && changes.length > 0) {
    return changes
      .map((c: { description?: string }) => c.description)
      .filter(Boolean)
      .join('; ')
  }

  if (output.error) return output.error

  // For specific tools, extract key details from the data field
  const data = output.data as Record<string, unknown> | undefined
  if (!data) return null

  if (call.toolName === 'verify_scene' && data.checks) {
    const issues = (data.issues as unknown[])?.length ?? 0
    return issues > 0 ? `${issues} issue(s) found` : 'All checks passed'
  }

  if (call.toolName === 'plan_scenes' && data.sceneCount) {
    return `Planned ${data.sceneCount} scene(s)`
  }

  if (call.toolName === 'web_search' && Array.isArray(data.results)) {
    const n = data.results.length
    const q = typeof data.query === 'string' ? ` "${data.query}"` : ''
    return `${n} result${n === 1 ? '' : 's'}${q}`
  }

  if (call.toolName === 'fetch_url_content') {
    const title = typeof data.title === 'string' ? data.title : ''
    const words = typeof data.wordCount === 'number' ? data.wordCount : 0
    if (title) return `${title.slice(0, 70)}${title.length > 70 ? '…' : ''} · ${words} words`
    if (words > 0) return `${words} words`
  }

  if (call.toolName === 'find_stock_videos' && Array.isArray(data.results)) {
    const n = data.results.length
    const prov = typeof data.provider === 'string' ? ` · ${data.provider}` : ''
    return `${n} clip${n === 1 ? '' : 's'}${prov}`
  }

  return null
}

export interface ToolCallItemProps {
  call: ToolCallRecord
}

export function ToolCallItem({ call }: ToolCallItemProps) {
  const [open, setOpen] = useState(false)
  const displayName = TOOL_DISPLAY_NAMES[call.toolName] ?? call.toolName
  const isSuccess = call.output?.success
  const isError = call.output && !call.output.success
  const summary = summarizeOutput(call)

  return (
    <div className="mt-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] overflow-hidden text-[12px]">
      <span
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-2.5 py-2 text-left hover:bg-[var(--color-border)]/20 transition-colors cursor-pointer select-none"
      >
        <span className="font-mono text-[var(--color-text-primary)] flex-1 truncate">{displayName}</span>
        {isSuccess && (
          <span className="flex items-center gap-1 text-emerald-400">
            <CheckCircle2 size={11} />
            <span className="text-[11px]">Done</span>
          </span>
        )}
        {isError && (
          <span className="flex items-center gap-1 text-red-400">
            <XCircle size={11} />
            <span className="text-[11px]">Error</span>
          </span>
        )}
        {call.durationMs !== undefined && (
          <span className="text-[var(--color-text-muted)] text-[11px]">{call.durationMs}ms</span>
        )}
        {open ? (
          <ChevronDown size={10} className="flex-shrink-0 text-[var(--color-text-muted)]" />
        ) : (
          <ChevronRight size={10} className="flex-shrink-0 text-[var(--color-text-muted)]" />
        )}
      </span>

      {/* One-line summary (shown when collapsed) */}
      {!open && summary && (
        <div className="px-2.5 pb-1.5 -mt-0.5 text-[11px] text-[var(--color-text-muted)] truncate">{summary}</div>
      )}

      {open && (
        <div className="px-2.5 pb-2.5 space-y-1.5 border-t border-[var(--color-border)]">
          <div>
            <div className="text-[var(--color-text-muted)] text-[11px] mb-0.5 mt-1.5 uppercase tracking-wide">
              Input
            </div>
            <pre className="text-[11px] text-[var(--color-text-muted)] whitespace-pre-wrap font-mono overflow-x-auto max-h-32 bg-[var(--color-panel)] rounded p-1.5">
              {JSON.stringify(call.input, null, 2)}
            </pre>
          </div>
          {call.output && (
            <div>
              <div className="text-[var(--color-text-muted)] text-[11px] mb-0.5 uppercase tracking-wide">Output</div>
              <pre
                className={`text-[11px] whitespace-pre-wrap font-mono overflow-x-auto max-h-32 bg-[var(--color-panel)] rounded p-1.5 ${
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
