import path from 'path'
import fs from 'fs/promises'

const isCloud = process.env.STORAGE_MODE === 'cloud'

export async function saveGeneratedMedia(buffer: Buffer, filename: string, contentType: string): Promise<string> {
  if (!isCloud) {
    // Local: save to /public/generated/
    const dir = path.join(process.cwd(), 'public', 'generated')
    await fs.mkdir(dir, { recursive: true })
    const filePath = path.join(dir, filename)
    await fs.writeFile(filePath, buffer)
    return `/generated/${filename}`
  } else {
    // Cloud: upload to S3/R2/Backblaze
    return uploadToCloudStorage(buffer, filename, contentType)
  }
}

export async function getMediaUrl(storedPath: string): Promise<string> {
  if (storedPath.startsWith('/generated/')) {
    return storedPath
  }
  return storedPath
}

async function uploadToCloudStorage(buffer: Buffer, filename: string, contentType: string): Promise<string> {
  const bucket = process.env.CLOUD_STORAGE_BUCKET
  const region = process.env.CLOUD_STORAGE_REGION
  const accessKey = process.env.CLOUD_STORAGE_ACCESS_KEY
  const secretKey = process.env.CLOUD_STORAGE_SECRET_KEY
  const endpoint = process.env.CLOUD_STORAGE_ENDPOINT

  if (!bucket || !accessKey || !secretKey) {
    throw new Error(
      'Cloud storage not configured. Set CLOUD_STORAGE_BUCKET, ' +
        'CLOUD_STORAGE_ACCESS_KEY, and CLOUD_STORAGE_SECRET_KEY in .env.local',
    )
  }

  // Dynamic import to avoid loading S3 SDK in local mode
  // Install @aws-sdk/client-s3 when using cloud storage mode
  // @ts-expect-error - optional dependency, only needed in cloud mode
  const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3')

  const client = new S3Client({
    region: region || 'auto',
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
    ...(endpoint ? { endpoint } : {}),
  })

  const key = `generated/${filename}`
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }),
  )

  if (endpoint) {
    // R2/Backblaze style
    return `${endpoint}/${bucket}/${key}`
  }
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`
}
