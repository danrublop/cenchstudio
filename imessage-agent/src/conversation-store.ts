/**
 * Per-contact conversation state stored in SQLite.
 * Tracks project mapping, chat history, and preferences for follow-up edits.
 */

import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const DB_PATH = process.env.AGENT_DB_PATH || './data/conversations.db'

let db: Database.Database

function getDb(): Database.Database {
  if (db) return db

  const dir = path.dirname(DB_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')

  db.exec(`
    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      display_name TEXT,
      project_id TEXT,
      preferences TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contact_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (contact_id) REFERENCES contacts(id)
    );

    CREATE TABLE IF NOT EXISTS scene_refs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contact_id TEXT NOT NULL,
      scene_id TEXT NOT NULL,
      scene_name TEXT,
      scene_type TEXT,
      duration REAL DEFAULT 8,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (contact_id) REFERENCES contacts(id)
    );

    CREATE TABLE IF NOT EXISTS tapbacks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contact_id TEXT NOT NULL,
      message_guid TEXT,
      reaction TEXT NOT NULL,
      timestamp TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (contact_id) REFERENCES contacts(id)
    );

    CREATE INDEX IF NOT EXISTS idx_messages_contact ON messages(contact_id);
    CREATE INDEX IF NOT EXISTS idx_scene_refs_contact ON scene_refs(contact_id);
    CREATE INDEX IF NOT EXISTS idx_tapbacks_contact ON tapbacks(contact_id);
  `)

  return db
}

// ── Contact Management ─────────────────────────────────────────────────────

export interface ContactState {
  id: string
  displayName: string | null
  projectId: string | null
  preferences: Record<string, any>
}

export function getOrCreateContact(contactId: string, displayName?: string): ContactState {
  const d = getDb()

  const existing = d.prepare('SELECT * FROM contacts WHERE id = ?').get(contactId) as any
  if (existing) {
    return {
      id: existing.id,
      displayName: existing.display_name,
      projectId: existing.project_id,
      preferences: JSON.parse(existing.preferences || '{}'),
    }
  }

  d.prepare('INSERT INTO contacts (id, display_name) VALUES (?, ?)').run(contactId, displayName ?? null)

  return { id: contactId, displayName: displayName ?? null, projectId: null, preferences: {} }
}

export function setProjectId(contactId: string, projectId: string): void {
  getDb()
    .prepare("UPDATE contacts SET project_id = ?, updated_at = datetime('now') WHERE id = ?")
    .run(projectId, contactId)
}

export function updatePreferences(contactId: string, updates: Record<string, any>): void {
  const contact = getOrCreateContact(contactId)
  const merged = { ...contact.preferences, ...updates }
  getDb()
    .prepare("UPDATE contacts SET preferences = ?, updated_at = datetime('now') WHERE id = ?")
    .run(JSON.stringify(merged), contactId)
}

// ── Message History ────────────────────────────────────────────────────────

export interface ChatMessage {
  role: string
  content: string
  timestamp: string
}

export function addMessage(contactId: string, role: string, content: string): void {
  getDb().prepare('INSERT INTO messages (contact_id, role, content) VALUES (?, ?, ?)').run(contactId, role, content)
}

export function getHistory(contactId: string, limit = 20): ChatMessage[] {
  const rows = getDb()
    .prepare('SELECT role, content, timestamp FROM messages WHERE contact_id = ? ORDER BY id DESC LIMIT ?')
    .all(contactId, limit) as any[]

  return rows.reverse().map((r) => ({
    role: r.role,
    content: r.content,
    timestamp: r.timestamp,
  }))
}

export function clearHistory(contactId: string): void {
  getDb().prepare('DELETE FROM messages WHERE contact_id = ?').run(contactId)
}

// ── Scene References ───────────────────────────────────────────────────────

export function setLastScenes(
  contactId: string,
  scenes: Array<{ id: string; name?: string; sceneType?: string; duration?: number }>,
): void {
  const d = getDb()
  d.prepare('DELETE FROM scene_refs WHERE contact_id = ?').run(contactId)

  const insert = d.prepare(
    'INSERT INTO scene_refs (contact_id, scene_id, scene_name, scene_type, duration) VALUES (?, ?, ?, ?, ?)',
  )
  for (const s of scenes) {
    insert.run(contactId, s.id, s.name ?? null, s.sceneType ?? 'motion', s.duration ?? 8)
  }
}

export function getLastScenes(
  contactId: string,
): Array<{ id: string; name: string; sceneType: string; duration: number }> {
  const rows = getDb()
    .prepare('SELECT scene_id, scene_name, scene_type, duration FROM scene_refs WHERE contact_id = ? ORDER BY id')
    .all(contactId) as any[]

  return rows.map((r) => ({
    id: r.scene_id,
    name: r.scene_name ?? 'Scene',
    sceneType: r.scene_type ?? 'motion',
    duration: r.duration ?? 8,
  }))
}

// ── Tapback Tracking ───────────────────────────────────────────────────────

export function recordTapback(contactId: string, messageGuid: string, reaction: string): void {
  getDb()
    .prepare('INSERT INTO tapbacks (contact_id, message_guid, reaction) VALUES (?, ?, ?)')
    .run(contactId, messageGuid, reaction)
}

export function getTapbacks(contactId: string, limit = 50): Array<{ reaction: string; timestamp: string }> {
  return getDb()
    .prepare('SELECT reaction, timestamp FROM tapbacks WHERE contact_id = ? ORDER BY id DESC LIMIT ?')
    .all(contactId, limit) as any[]
}

// ── History Pruning ────────────────────────────────────────────────────────

const MAX_MESSAGES_PER_CONTACT = 100

/**
 * Prune old messages per contact, keeping only the most recent MAX_MESSAGES_PER_CONTACT.
 * Call this periodically (e.g., on startup or hourly).
 */
export function pruneHistory(): number {
  const d = getDb()
  const contacts = d.prepare('SELECT id FROM contacts').all() as Array<{ id: string }>
  let pruned = 0

  for (const { id } of contacts) {
    const count = (d.prepare('SELECT COUNT(*) as c FROM messages WHERE contact_id = ?').get(id) as any).c
    if (count > MAX_MESSAGES_PER_CONTACT) {
      const toDelete = count - MAX_MESSAGES_PER_CONTACT
      d.prepare(
        `
        DELETE FROM messages WHERE id IN (
          SELECT id FROM messages WHERE contact_id = ? ORDER BY id ASC LIMIT ?
        )
      `,
      ).run(id, toDelete)
      pruned += toDelete
    }
  }

  return pruned
}

/**
 * Prune old tapbacks (keep last 200 per contact).
 */
const MAX_TAPBACKS_PER_CONTACT = 200

export function pruneTapbacks(): number {
  const d = getDb()
  const contacts = d.prepare('SELECT DISTINCT contact_id FROM tapbacks').all() as Array<{ contact_id: string }>
  let pruned = 0

  for (const { contact_id } of contacts) {
    const count = (d.prepare('SELECT COUNT(*) as c FROM tapbacks WHERE contact_id = ?').get(contact_id) as any).c
    if (count > MAX_TAPBACKS_PER_CONTACT) {
      const toDelete = count - MAX_TAPBACKS_PER_CONTACT
      d.prepare(
        `
        DELETE FROM tapbacks WHERE id IN (
          SELECT id FROM tapbacks WHERE contact_id = ? ORDER BY id ASC LIMIT ?
        )
      `,
      ).run(contact_id, toDelete)
      pruned += toDelete
    }
  }

  return pruned
}

// ── Cleanup ────────────────────────────────────────────────────────────────

export function closeDb(): void {
  if (db) {
    db.close()
    db = undefined as any
  }
}
