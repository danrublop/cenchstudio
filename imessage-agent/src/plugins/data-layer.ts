/**
 * Data Layer Plugin — SDK contribution for imessage-kit.
 *
 * Generic per-contact key-value store with namespace scoping.
 * Gives plugins a shared, persistent data backend instead of
 * each plugin rolling its own SQLite tables.
 *
 * Usage:
 *   const plugin = createDataLayerPlugin({ dbPath: './data/plugin-data.db' })
 *   sdk.use(plugin)
 *   const store = plugin.dataLayer.scope('my-plugin')
 *   store.set(contactId, 'preference', { theme: 'dark' })
 *
 * Contribution target: @photon-ai/imessage-kit core or plugin registry
 */

import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

// ── Types ──────────────────────────────────────────────────────────────────

export interface DataLayerOptions {
  dbPath?: string // default './data/plugin-data.db'
  autoTrackContacts?: boolean // auto-update lastSeen/messageCount on each message
}

export interface ScopedStore {
  get<T = unknown>(contactId: string, key: string): T | null
  set<T = unknown>(contactId: string, key: string, value: T): void
  delete(contactId: string, key: string): boolean
  getAll(contactId: string): Record<string, unknown>
  deleteAll(contactId: string): number
  getGlobal<T = unknown>(key: string): T | null
  setGlobal<T = unknown>(key: string, value: T): void
  deleteGlobal(key: string): boolean
  listPush(contactId: string, key: string, value: string): void
  listGet(contactId: string, key: string): string[]
  listRemove(contactId: string, key: string, value: string): boolean
}

export interface DataLayer {
  scope(namespace: string): ScopedStore
  get<T = unknown>(namespace: string, contactId: string, key: string): T | null
  set<T = unknown>(namespace: string, contactId: string, key: string, value: T): void
  delete(namespace: string, contactId: string, key: string): boolean
  getAll(namespace: string, contactId: string): Record<string, unknown>
  deleteAll(namespace: string, contactId: string): number
  listPush(namespace: string, contactId: string, key: string, value: string): void
  listGet(namespace: string, contactId: string, key: string): string[]
  listRemove(namespace: string, contactId: string, key: string, value: string): boolean
  getContactsWithKey(namespace: string, key: string): string[]
  close(): void
}

// ── Constants ──────────────────────────────────────────────────────────────

const GLOBAL_CONTACT = '_global'
const DEFAULT_DB_PATH = './data/plugin-data.db'

// ── Implementation ─────────────────────────────────────────────────────────

let db: Database.Database | null = null

function getDb(dbPath: string): Database.Database {
  if (db) return db

  const dir = path.dirname(dbPath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')

  db.exec(`
    CREATE TABLE IF NOT EXISTS kv_store (
      namespace TEXT NOT NULL,
      contact_id TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (namespace, contact_id, key)
    );

    CREATE INDEX IF NOT EXISTS idx_kv_ns_contact
      ON kv_store(namespace, contact_id);

    CREATE TABLE IF NOT EXISTS kv_lists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      namespace TEXT NOT NULL,
      contact_id TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(namespace, contact_id, key, value)
    );

    CREATE INDEX IF NOT EXISTS idx_kvl_ns_contact_key
      ON kv_lists(namespace, contact_id, key);
  `)

  return db
}

function createDataLayer(dbPath: string): DataLayer {
  const d = () => getDb(dbPath)

  const layer: DataLayer = {
    get<T = unknown>(namespace: string, contactId: string, key: string): T | null {
      const row = d()
        .prepare('SELECT value FROM kv_store WHERE namespace = ? AND contact_id = ? AND key = ?')
        .get(namespace, contactId, key) as { value: string } | undefined
      if (!row) return null
      try {
        return JSON.parse(row.value) as T
      } catch {
        return null
      }
    },

    set<T = unknown>(namespace: string, contactId: string, key: string, value: T): void {
      d()
        .prepare(
          `
          INSERT INTO kv_store (namespace, contact_id, key, value, updated_at)
          VALUES (?, ?, ?, ?, datetime('now'))
          ON CONFLICT(namespace, contact_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
        `,
        )
        .run(namespace, contactId, key, JSON.stringify(value))
    },

    delete(namespace: string, contactId: string, key: string): boolean {
      const result = d()
        .prepare('DELETE FROM kv_store WHERE namespace = ? AND contact_id = ? AND key = ?')
        .run(namespace, contactId, key)
      return result.changes > 0
    },

    getAll(namespace: string, contactId: string): Record<string, unknown> {
      const rows = d()
        .prepare('SELECT key, value FROM kv_store WHERE namespace = ? AND contact_id = ?')
        .all(namespace, contactId) as Array<{ key: string; value: string }>
      const result: Record<string, unknown> = {}
      for (const row of rows) {
        try {
          result[row.key] = JSON.parse(row.value)
        } catch {
          result[row.key] = row.value
        }
      }
      return result
    },

    deleteAll(namespace: string, contactId: string): number {
      const r1 = d().prepare('DELETE FROM kv_store WHERE namespace = ? AND contact_id = ?').run(namespace, contactId)
      const r2 = d().prepare('DELETE FROM kv_lists WHERE namespace = ? AND contact_id = ?').run(namespace, contactId)
      return r1.changes + r2.changes
    },

    listPush(namespace: string, contactId: string, key: string, value: string): void {
      const maxOrder = d()
        .prepare('SELECT MAX(sort_order) as m FROM kv_lists WHERE namespace = ? AND contact_id = ? AND key = ?')
        .get(namespace, contactId, key) as { m: number | null } | undefined
      const next = (maxOrder?.m ?? -1) + 1
      d()
        .prepare(
          `
          INSERT OR IGNORE INTO kv_lists (namespace, contact_id, key, value, sort_order)
          VALUES (?, ?, ?, ?, ?)
        `,
        )
        .run(namespace, contactId, key, value, next)
    },

    listGet(namespace: string, contactId: string, key: string): string[] {
      const rows = d()
        .prepare('SELECT value FROM kv_lists WHERE namespace = ? AND contact_id = ? AND key = ? ORDER BY sort_order')
        .all(namespace, contactId, key) as Array<{ value: string }>
      return rows.map((r) => r.value)
    },

    listRemove(namespace: string, contactId: string, key: string, value: string): boolean {
      const result = d()
        .prepare('DELETE FROM kv_lists WHERE namespace = ? AND contact_id = ? AND key = ? AND value = ?')
        .run(namespace, contactId, key, value)
      return result.changes > 0
    },

    getContactsWithKey(namespace: string, key: string): string[] {
      const rows = d()
        .prepare('SELECT DISTINCT contact_id FROM kv_store WHERE namespace = ? AND key = ? AND contact_id != ?')
        .all(namespace, key, GLOBAL_CONTACT) as Array<{ contact_id: string }>
      return rows.map((r) => r.contact_id)
    },

    scope(namespace: string): ScopedStore {
      return {
        get: <T = unknown>(contactId: string, key: string) => layer.get<T>(namespace, contactId, key),
        set: <T = unknown>(contactId: string, key: string, value: T) => layer.set(namespace, contactId, key, value),
        delete: (contactId: string, key: string) => layer.delete(namespace, contactId, key),
        getAll: (contactId: string) => layer.getAll(namespace, contactId),
        deleteAll: (contactId: string) => layer.deleteAll(namespace, contactId),
        getGlobal: <T = unknown>(key: string) => layer.get<T>(namespace, GLOBAL_CONTACT, key),
        setGlobal: <T = unknown>(key: string, value: T) => layer.set(namespace, GLOBAL_CONTACT, key, value),
        deleteGlobal: (key: string) => layer.delete(namespace, GLOBAL_CONTACT, key),
        listPush: (contactId: string, key: string, value: string) => layer.listPush(namespace, contactId, key, value),
        listGet: (contactId: string, key: string) => layer.listGet(namespace, contactId, key),
        listRemove: (contactId: string, key: string, value: string) =>
          layer.listRemove(namespace, contactId, key, value),
      }
    },

    close(): void {
      if (db) {
        db.close()
        db = null
      }
    },
  }

  return layer
}

// ── Plugin Factory ─────────────────────────────────────────────────────────

export function createDataLayerPlugin(opts?: DataLayerOptions) {
  const dbPath = opts?.dbPath ?? DEFAULT_DB_PATH
  const autoTrack = opts?.autoTrackContacts ?? true
  const layer = createDataLayer(dbPath)
  const systemStore = layer.scope('_system')

  return {
    name: 'data-layer',
    version: '1.0.0',
    description: 'Generic per-contact key-value store for plugins',

    dataLayer: layer,

    onInit() {
      getDb(dbPath)
    },

    onNewMessage(msg: any) {
      if (!autoTrack) return
      const sender = msg.sender ?? msg.handle
      if (!sender || msg.isReaction) return

      const now = new Date().toISOString()
      systemStore.set(sender, 'lastSeen', now)

      // Atomic increment — single DB operation instead of read + write
      const d = getDb(dbPath)
      d.prepare(
        `
        INSERT INTO kv_store (namespace, contact_id, key, value, updated_at)
        VALUES ('_system', ?, 'messageCount', '1', datetime('now'))
        ON CONFLICT(namespace, contact_id, key) DO UPDATE
        SET value = CAST(CAST(value AS INTEGER) + 1 AS TEXT), updated_at = datetime('now')
      `,
      ).run(sender)
    },

    onDestroy() {
      layer.close()
    },
  }
}
