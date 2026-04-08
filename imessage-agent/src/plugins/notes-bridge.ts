/**
 * Notes Bridge Plugin — SDK contribution for imessage-kit.
 *
 * Read/write Apple Notes via AppleScript. Gives iMessage agents
 * a persistent scratchpad — leave notes, read them back, search.
 *
 * Usage:
 *   sdk.use(createNotesBridgePlugin({ defaultFolder: 'My Agent' }))
 *   await createNote('Shopping List', 'eggs, milk, bread')
 *   const note = await readNote('Shopping List')
 *
 * Contribution target: @photon-ai/imessage-kit core or plugin registry
 */

import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

// ── Types ──────────────────────────────────────────────────────────────────

export interface NotesBridgeOptions {
  defaultFolder?: string // Notes folder name, default 'iMessage Agent'
  autoCapture?: boolean // listen for "note:" prefix in messages
  scriptTimeout?: number // osascript timeout in ms, default 10000
}

export interface NoteEntry {
  name: string
  body: string
  folder: string
}

// ── Configuration ──────────────────────────────────────────────────────────

let _defaultFolder = 'iMessage Agent'
let _scriptTimeout = 10_000

// ── AppleScript Helpers ────────────────────────────────────────────────────

function escapeAS(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// Serialize AppleScript calls to avoid overwhelming Notes.app
let scriptQueue = Promise.resolve<string>('')

async function runScript(script: string): Promise<string> {
  const job = scriptQueue.then(async () => {
    const { stdout } = await execFileAsync('osascript', ['-e', script], {
      timeout: _scriptTimeout,
    })
    return stdout.trim()
  })
  // Chain but don't propagate errors to the queue
  scriptQueue = job.catch(() => '')
  return job
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Ensure a folder exists in Notes.app. Creates it if missing.
 */
export async function ensureFolder(folderName?: string): Promise<void> {
  const folder = escapeAS(folderName ?? _defaultFolder)
  await runScript(`
tell application "Notes"
  if not (exists folder "${folder}") then
    make new folder with properties {name:"${folder}"}
  end if
end tell`)
}

/**
 * Create a new note. Returns the note name on success.
 */
export async function createNote(title: string, body: string, folder?: string): Promise<string> {
  const f = escapeAS(folder ?? _defaultFolder)
  const t = escapeAS(title)
  const b = escapeAS(body.replace(/\n/g, '<br>'))

  await ensureFolder(folder ?? _defaultFolder)

  await runScript(`
tell application "Notes"
  tell folder "${f}"
    make new note with properties {name:"${t}", body:"${b}"}
  end tell
end tell`)

  return title
}

/**
 * Read a note by title. Returns null if not found.
 */
export async function readNote(title: string, folder?: string): Promise<NoteEntry | null> {
  const f = escapeAS(folder ?? _defaultFolder)
  const t = escapeAS(title)

  try {
    const result = await runScript(`
tell application "Notes"
  tell folder "${f}"
    set theNote to first note whose name is "${t}"
    return (name of theNote) & "|||DELIM|||" & (body of theNote)
  end tell
end tell`)

    const parts = result.split('|||DELIM|||')
    if (parts.length < 2) return null

    return {
      name: parts[0].trim(),
      body: stripHtml(parts.slice(1).join('|||DELIM|||')),
      folder: folder ?? _defaultFolder,
    }
  } catch {
    return null
  }
}

/**
 * Append text to an existing note. Creates the note if it doesn't exist.
 */
export async function appendToNote(title: string, text: string, folder?: string): Promise<void> {
  const existing = await readNote(title, folder)
  if (!existing) {
    await createNote(title, text, folder)
    return
  }

  const f = escapeAS(folder ?? _defaultFolder)
  const t = escapeAS(title)
  const appendHtml = escapeAS(text.replace(/\n/g, '<br>'))

  await runScript(`
tell application "Notes"
  tell folder "${f}"
    set theNote to first note whose name is "${t}"
    set body of theNote to (body of theNote) & "<br>" & "${appendHtml}"
  end tell
end tell`)
}

/**
 * List all notes in a folder.
 */
export async function listNotes(folder?: string): Promise<Array<{ name: string }>> {
  const f = escapeAS(folder ?? _defaultFolder)

  try {
    const result = await runScript(`
tell application "Notes"
  if not (exists folder "${f}") then return ""
  tell folder "${f}"
    set noteNames to {}
    repeat with n in notes
      set end of noteNames to name of n
    end repeat
    set AppleScript's text item delimiters to "|||"
    return noteNames as text
  end tell
end tell`)

    if (!result) return []
    return result
      .split('|||')
      .map((name) => ({ name: name.trim() }))
      .filter((n) => n.name)
  } catch {
    return []
  }
}

/**
 * Delete a note by title. Returns true if found and deleted.
 */
export async function deleteNote(title: string, folder?: string): Promise<boolean> {
  const f = escapeAS(folder ?? _defaultFolder)
  const t = escapeAS(title)

  try {
    await runScript(`
tell application "Notes"
  tell folder "${f}"
    delete (first note whose name is "${t}")
  end tell
end tell`)
    return true
  } catch {
    return false
  }
}

/**
 * Search notes by content across all folders.
 */
export async function searchNotes(query: string): Promise<NoteEntry[]> {
  const q = escapeAS(query).toLowerCase()

  try {
    const result = await runScript(`
tell application "Notes"
  set matches to {}
  repeat with n in notes
    if (body of n) contains "${q}" or (name of n) contains "${q}" then
      set end of matches to (name of n) & "|||BODY|||" & (body of n) & "|||NOTE|||"
    end if
  end repeat
  return matches as text
end tell`)

    if (!result) return []
    return result
      .split('|||NOTE|||')
      .filter((s) => s.trim())
      .map((entry) => {
        const parts = entry.split('|||BODY|||')
        return {
          name: parts[0].trim(),
          body: stripHtml(parts.slice(1).join('|||BODY|||')),
          folder: _defaultFolder,
        }
      })
  } catch {
    return []
  }
}

// ── Plugin Factory ─────────────────────────────────────────────────────────

export function createNotesBridgePlugin(opts?: NotesBridgeOptions) {
  _defaultFolder = opts?.defaultFolder ?? 'iMessage Agent'
  _scriptTimeout = opts?.scriptTimeout ?? 10_000
  const autoCapture = opts?.autoCapture ?? false

  return {
    name: 'notes-bridge',
    version: '1.0.0',
    description: 'Apple Notes integration for iMessage agents via AppleScript',

    async onInit() {
      try {
        await ensureFolder()
        console.log(`📝 Notes bridge ready (folder: "${_defaultFolder}")`)
      } catch (err) {
        console.warn(`⚠️ Notes bridge: could not access Notes.app — ${err}`)
      }
    },

    async onNewMessage(msg: any) {
      if (!autoCapture) return
      const text: string = msg.text ?? ''
      const sender = msg.sender ?? ''
      if (!text || msg.isFromMe || msg.isReaction) return

      // Capture "note: ..." messages
      const match = text.match(/^note:\s*(.+)/i)
      if (!match) return

      const noteText = match[1].trim()
      const timestamp = new Date().toLocaleString()
      await appendToNote(`Notes from ${sender}`, `[${timestamp}] ${noteText}`).catch((err) =>
        console.warn(`Notes capture failed: ${err}`),
      )

      console.log(`📝 Captured note from ${sender}: "${noteText.slice(0, 50)}"`)
    },
  }
}
