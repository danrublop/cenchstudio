/**
 * Progress Reporter — console-only phase tracking with per-contact state.
 * Progress updates go to console.log, never to iMessage.
 * The /progress command can query current state via getProgress().
 */

export interface ProgressReporter {
  update(phase: string): void
  stop(): void
}

// Per-contact progress state for /progress queries
const contactProgress = new Map<string, string>()

/** Get the current progress phase for a contact, or null if idle. */
export function getProgress(contactId: string): string | null {
  return contactProgress.get(contactId) ?? null
}

/**
 * Creates a progress reporter that logs to console and tracks state.
 * No iMessage sending — use /progress to opt into status updates.
 */
export function createProgressReporter(contactId: string): ProgressReporter {
  let lastPhase = ''
  let stopped = false

  const PHASE_LABELS: Record<string, string> = {
    generating: 'generating scene',
    rendering: 'rendering frames',
    stitching: 'stitching final video',
    mixing: 'mixing audio',
    done: 'done',
  }

  return {
    update(phase: string) {
      if (stopped) return
      const normalized = normalizePhase(phase)
      if (normalized === lastPhase) return
      lastPhase = normalized

      const label = PHASE_LABELS[normalized] ?? normalized
      contactProgress.set(contactId, label)
      console.log(`  [${contactId.slice(0, 12)}] ${label}`)
    },
    stop() {
      stopped = true
      contactProgress.delete(contactId)
    },
  }
}

function normalizePhase(raw: string): string {
  const lower = raw.toLowerCase()
  if (lower.includes('generat') || lower.includes('running:')) return 'generating'
  if (lower.includes('rendering') || lower.includes('render')) return 'rendering'
  if (lower.includes('stitch')) return 'stitching'
  if (lower.includes('mix') || lower.includes('audio')) return 'mixing'
  if (lower.includes('done') || lower.includes('complete')) return 'done'
  return raw
}
