'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, CheckCircle2, XCircle } from 'lucide-react'
import type { ToolCallRecord } from '@/lib/agents/types'

const TOOL_DISPLAY_NAMES: Record<string, string> = {
  add_canvas_layer: 'Creating canvas animation',
  add_svg_layer: 'Creating SVG graphic',
  add_three_layer: 'Creating 3D scene',
  add_d3_layer: 'Creating data visualization',
  add_lottie_layer: 'Adding Lottie animation',
  add_zdog_layer: 'Creating Zdog illustration',
  regenerate_layer: 'Regenerating layer',
  edit_layer: 'Editing layer',
  delete_layer: 'Deleting layer',
  rename_scene: 'Renaming scene',
  add_scene: 'Adding scene',
  delete_scene: 'Deleting scene',
  reorder_scenes: 'Reordering scenes',
  update_global_style: 'Updating global style',
  add_interaction: 'Adding interaction',
  remove_interaction: 'Removing interaction',
  generate_image: 'Generating image',
  generate_audio: 'Generating audio',
  generate_video: 'Generating video clip',
  search_web: 'Searching the web',
  read_url: 'Reading URL',
}

export interface ToolCallItemProps {
  call: ToolCallRecord
}

export function ToolCallItem({ call }: ToolCallItemProps) {
  const [open, setOpen] = useState(false)
  const displayName = TOOL_DISPLAY_NAMES[call.toolName] ?? call.toolName
  const isSuccess = call.output?.success
  const isError = call.output && !call.output.success

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
