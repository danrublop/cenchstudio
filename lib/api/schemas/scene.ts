import { z } from 'zod'

export const writeSceneHtmlSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9\-]+$/, 'ID must be alphanumeric with hyphens only'),
  html: z.string().min(1, 'html is required'),
})

export const patchSceneSchema = z.object({
  sceneId: z.string().min(1, 'sceneId is required'),
  layerId: z.string().min(1, 'layerId is required'),
  generatedCode: z.string().min(1, 'generatedCode is required'),
  prompt: z.string().optional(),
})
