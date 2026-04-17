import pg from 'pg'

const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
await client.connect()

const statements = [
  `ALTER TABLE "media_cache" ADD COLUMN IF NOT EXISTS "content_hash" text`,
  `ALTER TABLE "project_assets" ADD COLUMN IF NOT EXISTS "content_hash" text`,
  `ALTER TABLE "project_assets" ADD COLUMN IF NOT EXISTS "source_url" text`,
  `ALTER TABLE "project_assets" ADD COLUMN IF NOT EXISTS "classification_timestamp" timestamp`,
  `CREATE INDEX IF NOT EXISTS "media_cache_content_hash_idx" ON "media_cache" USING btree ("content_hash")`,
  `CREATE INDEX IF NOT EXISTS "project_assets_content_hash_idx" ON "project_assets" USING btree ("content_hash")`,
]

for (const stmt of statements) {
  try {
    await client.query(stmt)
    console.log('OK:', stmt.slice(0, 90))
  } catch (e) {
    console.error('FAIL:', stmt.slice(0, 90), '\n   ', e.message)
  }
}

await client.end()
console.log('done')
