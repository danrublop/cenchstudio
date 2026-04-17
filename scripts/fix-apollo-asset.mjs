import pg from 'pg'
import fs from 'fs/promises'

const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
await client.connect()

const PROJECT_ID = '2e2a7af7-3719-4a7b-bcd6-0b8cfedf27df'
const ASSET_ID = '94116dbb-8f67-4a29-ba61-7e0c4d2ab6ae'
const DIR = `/Users/daniellopez/SVG.vide.new/public/uploads/projects/${PROJECT_ID}/ingested`
const newFilename = `${ASSET_ID}.mp4`
const newPublicUrl = `/uploads/projects/${PROJECT_ID}/ingested/${newFilename}`
const newPath = `${DIR}/${newFilename}`
const oldPath = `${DIR}/${ASSET_ID}.ogv`

const size = (await fs.stat(newPath)).size

await client.query(
  `UPDATE project_assets
   SET filename = $1, storage_path = $2, public_url = $3, mime_type = $4, size_bytes = $5
   WHERE id = $6`,
  [newFilename, newPath, newPublicUrl, 'video/mp4', size, ASSET_ID],
)
console.log('Updated asset row:', { newPublicUrl, sizeBytes: size })

await fs.unlink(oldPath).catch(() => {})
console.log('Deleted old .ogv')

await client.end()
