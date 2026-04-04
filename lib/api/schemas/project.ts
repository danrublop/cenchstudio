import { z } from 'zod'

export const createProjectSchema = z.object({
  name: z.string().default('Untitled Project'),
  outputMode: z.enum(['mp4', 'interactive']).default('mp4'),
  presetId: z.string().optional(),
})
