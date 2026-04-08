/**
 * Contact Tagger Plugin — SDK contribution for imessage-kit.
 *
 * Per-contact tagging system for routing, filtering, and permissions.
 * Tags are persisted in SQLite and can be used by other plugins
 * (e.g., agent-commands for permission checks).
 *
 * Usage:
 *   sdk.use(createContactTaggerPlugin())
 *   addTag('+15551234567', 'vip')
 *   addTag('+15551234567', 'team')
 *   getContactsByTag('vip') // → ['+15551234567']
 *
 * Contribution target: @photon-ai/imessage-kit core or plugin registry
 */

import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

// ── Types ──────────────────────────────────────────────────────────────────

export interface ContactTaggerOptions {
  dbPath?: string // default './data/contact-tags.db'
  autoTagNew?: string[] // tags to auto-apply to first-time contacts
}

// ── State ──────────────────────────────────────────────────────────────────

const DEFAULT_DB_PATH = './data/contact-tags.db'
let db: Database.Database | null = null
const knownContacts = new Set<string>()

function getDb(dbPath: string): Database.Database {
  if (db) return db

  const dir = path.dirname(dbPath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')

  db.exec(`
    CREATE TABLE IF NOT EXISTS contact_tags (
      contact_id TEXT NOT NULL,
      tag TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (contact_id, tag)
    );

    CREATE INDEX IF NOT EXISTS idx_tags_by_tag ON contact_tags(tag);
  `)

  // Load known contacts into memory for fast autoTag checks
  const rows = db.prepare('SELECT DISTINCT contact_id FROM contact_tags').all() as Array<{ contact_id: string }>
  for (const row of rows) knownContacts.add(row.contact_id)

  return db
}

// ── Helpers ────────────────────────────────────────────────────────────────

function normalize(tag: string): string {
  return tag.trim().toLowerCase()
}

// ── Public API ─────────────────────────────────────────────────────────────

let _dbPath = DEFAULT_DB_PATH

export function addTag(contactId: string, tag: string): void {
  const t = normalize(tag)
  if (!t) return
  getDb(_dbPath).prepare('INSERT OR IGNORE INTO contact_tags (contact_id, tag) VALUES (?, ?)').run(contactId, t)
  knownContacts.add(contactId)
}

export function removeTag(contactId: string, tag: string): void {
  const t = normalize(tag)
  getDb(_dbPath).prepare('DELETE FROM contact_tags WHERE contact_id = ? AND tag = ?').run(contactId, t)
}

export function getTags(contactId: string): string[] {
  const rows = getDb(_dbPath)
    .prepare('SELECT tag FROM contact_tags WHERE contact_id = ? ORDER BY tag')
    .all(contactId) as Array<{ tag: string }>
  return rows.map((r) => r.tag)
}

export function getContactsByTag(tag: string): string[] {
  const t = normalize(tag)
  const rows = getDb(_dbPath).prepare('SELECT contact_id FROM contact_tags WHERE tag = ?').all(t) as Array<{
    contact_id: string
  }>
  return rows.map((r) => r.contact_id)
}

export function hasTag(contactId: string, tag: string): boolean {
  const t = normalize(tag)
  const row = getDb(_dbPath).prepare('SELECT 1 FROM contact_tags WHERE contact_id = ? AND tag = ?').get(contactId, t)
  return !!row
}

export function setTags(contactId: string, tags: string[]): void {
  const d = getDb(_dbPath)
  const tx = d.transaction(() => {
    d.prepare('DELETE FROM contact_tags WHERE contact_id = ?').run(contactId)
    const insert = d.prepare('INSERT INTO contact_tags (contact_id, tag) VALUES (?, ?)')
    for (const tag of tags) {
      const t = normalize(tag)
      if (t) insert.run(contactId, t)
    }
  })
  tx()
  knownContacts.add(contactId)
}

export function getAllTags(): string[] {
  const rows = getDb(_dbPath).prepare('SELECT DISTINCT tag FROM contact_tags ORDER BY tag').all() as Array<{
    tag: string
  }>
  return rows.map((r) => r.tag)
}

export function matchesTags(contactId: string, required: string[], excluded?: string[]): boolean {
  const tags = getTags(contactId)
  const tagSet = new Set(tags)
  for (const r of required) {
    if (!tagSet.has(normalize(r))) return false
  }
  if (excluded) {
    for (const e of excluded) {
      if (tagSet.has(normalize(e))) return false
    }
  }
  return true
}

// ── Plugin Factory ─────────────────────────────────────────────────────────

export function createContactTaggerPlugin(opts?: ContactTaggerOptions) {
  _dbPath = opts?.dbPath ?? DEFAULT_DB_PATH
  const autoTagNew = opts?.autoTagNew ?? []

  return {
    name: 'contact-tagger',
    version: '1.0.0',
    description: 'Per-contact tagging for routing, filtering, and permissions',

    onInit() {
      getDb(_dbPath)
    },

    onNewMessage(msg: any) {
      if (autoTagNew.length === 0) return
      const sender = msg.sender ?? msg.handle
      if (!sender || msg.isFromMe || msg.isReaction) return

      // Auto-tag first-time contacts
      if (!knownContacts.has(sender)) {
        knownContacts.add(sender)
        for (const tag of autoTagNew) {
          addTag(sender, tag)
        }
        console.log(`🏷️ Auto-tagged new contact ${sender}: ${autoTagNew.join(', ')}`)
      }
    },

    onDestroy() {
      if (db) {
        db.close()
        db = null
      }
    },
  }
}
