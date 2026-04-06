import { db } from '../index'
import { githubLinks } from '../schema'
import { eq } from 'drizzle-orm'
import { encrypt, decrypt, isEncryptionConfigured } from '@/lib/crypto'

/**
 * Get the GitHub link for a project, decrypting tokens.
 */
export async function getGithubLink(projectId: string) {
  const row = await db.query.githubLinks.findFirst({
    where: eq(githubLinks.projectId, projectId),
  })
  if (!row) return null

  return {
    ...row,
    accessToken: isEncryptionConfigured() ? decrypt(row.accessToken) : row.accessToken,
    refreshToken: row.refreshToken && isEncryptionConfigured() ? decrypt(row.refreshToken) : row.refreshToken,
  }
}

/**
 * Create or update a GitHub link, encrypting tokens before storage.
 */
export async function upsertGithubLink(data: {
  projectId: string
  repoFullName: string
  defaultBranch?: string
  accessToken: string
  refreshToken?: string | null
  tokenExpiresAt?: Date | null
}) {
  if (!isEncryptionConfigured()) {
    throw new Error('ENCRYPTION_KEY must be configured before storing GitHub tokens')
  }

  const encryptedAccess = encrypt(data.accessToken)
  const encryptedRefresh = data.refreshToken ? encrypt(data.refreshToken) : null

  const [row] = await db
    .insert(githubLinks)
    .values({
      projectId: data.projectId,
      repoFullName: data.repoFullName,
      defaultBranch: data.defaultBranch ?? 'main',
      accessToken: encryptedAccess,
      refreshToken: encryptedRefresh,
      tokenExpiresAt: data.tokenExpiresAt ?? null,
    })
    .onConflictDoUpdate({
      target: githubLinks.projectId,
      set: {
        repoFullName: data.repoFullName,
        defaultBranch: data.defaultBranch ?? 'main',
        accessToken: encryptedAccess,
        refreshToken: encryptedRefresh,
        tokenExpiresAt: data.tokenExpiresAt ?? null,
        updatedAt: new Date(),
      },
    })
    .returning()

  return row
}

/**
 * Delete a GitHub link for a project.
 */
export async function deleteGithubLink(projectId: string) {
  await db.delete(githubLinks).where(eq(githubLinks.projectId, projectId))
}
