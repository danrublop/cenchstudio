import { z } from 'zod'

const paletteSchema = z.array(z.string()).min(1).max(8)

export const generateSvgSchema = z.object({
  prompt: z.string().optional(),
  palette: paletteSchema.default(['#1a1a2e', '#16213e', '#0f3460', '#e94560']),
  strokeWidth: z.number().default(2),
  font: z.string().default('Caveat'),
  duration: z.number().default(8),
  previousSummary: z.string().default(''),
  enhance: z.boolean().default(false),
  summarize: z.boolean().default(false),
  edit: z.boolean().default(false),
  editInstruction: z.string().default(''),
  svgContent: z.string().default(''),
})

export const generateCanvasSchema = z.object({
  prompt: z.string().min(1, 'prompt is required'),
  palette: paletteSchema.default(['#1a1a2e', '#e84545', '#16a34a', '#2563eb']),
  bgColor: z.string().default('#fffef9'),
  duration: z.number().default(8),
  previousSummary: z.string().default(''),
})

export const generateD3Schema = z.object({
  prompt: z.string().min(1, 'prompt is required'),
  palette: paletteSchema.optional(),
  chartType: z.string().optional(),
  duration: z.number().default(8),
  data: z.unknown().optional(),
  previousSummary: z.string().default(''),
})

export const generateThreeSchema = z.object({
  prompt: z.string().min(1, 'prompt is required'),
  palette: paletteSchema.optional(),
  duration: z.number().default(8),
  previousSummary: z.string().default(''),
})

export const generateMotionSchema = z.object({
  prompt: z.string().min(1, 'prompt is required'),
  palette: paletteSchema.optional(),
  duration: z.number().default(8),
  previousSummary: z.string().default(''),
})

export const generateLottieSchema = z.object({
  prompt: z.string().min(1, 'prompt is required'),
  palette: paletteSchema.optional(),
  duration: z.number().default(8),
})
