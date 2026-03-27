// Agent tool definitions for AI media generation
// These are the tool schemas that get injected into the agent's tool list

export interface ToolDefinition {
  name: string
  description: string
  input_schema: Record<string, string>
}

export const PERMISSION_TOOL: ToolDefinition = {
  name: 'request_permission',
  description: `ALWAYS call this before calling any external paid API including generate_avatar, generate_veo3_video, generate_image, generate_sticker, remove_background, elevenlabs_tts.
Wait for permission before proceeding.
If permission mode is always_allow, this resolves immediately.
If permission mode is always_deny, do not call the API.`,
  input_schema: {
    api: 'string — api identifier (heygen | veo3 | imageGen | backgroundRemoval | elevenLabs)',
    estimatedCost: 'string — human readable cost estimate',
    reason: "string — why you need this API for the user's request",
    details: 'object — what will be generated (prompt, duration, model etc)',
  },
}

export const LIST_AVATARS_TOOL: ToolDefinition = {
  name: 'list_avatars',
  description: 'List available HeyGen avatars. Call this when user asks to see avatar options or when you need to find an appropriate avatar for a scene.',
  input_schema: {},
}

export const GENERATE_AVATAR_TOOL: ToolDefinition = {
  name: 'generate_avatar',
  description: `Generate a talking head avatar video using HeyGen.
The avatar will speak the provided script.
Background is automatically removed for transparent overlay.
MUST call request_permission('heygen', cost, reason) first.
Generation takes 1-5 minutes — inform the user.`,
  input_schema: {
    sceneId: 'string',
    script: 'string — what the avatar will say',
    avatarId: 'string — HeyGen avatar ID (call list_avatars first if unsure)',
    voiceId: 'string — HeyGen voice ID',
    x: 'number — center x position 0-1920',
    y: 'number — center y position 0-1080',
    width: 'number — avatar width in px (default 400)',
    removeBackground: 'boolean — default true',
    label: 'string — layer name',
  },
}

export const GENERATE_VEO3_TOOL: ToolDefinition = {
  name: 'generate_veo3_video',
  description: `Generate a video clip using Google Veo 3.
Best for: atmospheric backgrounds, b-roll footage, abstract motion,
product showcases, nature scenes, urban environments.
NOT for: diagrams, explanations, talking heads (use HeyGen for that).
Clips are 5 or 8 seconds. Loop if scene is longer.
MUST call request_permission('veo3', cost, reason) first.
Generation takes 2-10 minutes.`,
  input_schema: {
    sceneId: 'string',
    prompt: 'string — detailed description of the video to generate',
    negativePrompt: 'string | null — what to avoid',
    aspectRatio: '16:9 | 9:16 | 1:1',
    duration: '5 | 8',
    loop: 'boolean — loop if scene duration is longer than clip',
    asBackground: 'boolean — if true, places behind other layers at z:0',
    label: 'string',
  },
}

export const GENERATE_IMAGE_TOOL: ToolDefinition = {
  name: 'generate_image',
  description: `Generate an AI image and place it in a scene.
For stickers (transparent bg): set removeBackground: true.
For background images: set removeBackground: false.
Choose model based on content type — see model guide.
MUST call request_permission('imageGen', cost, reason) first.`,
  input_schema: {
    sceneId: 'string',
    layerId: 'string | null — null = create new layer',
    prompt: 'string',
    negativePrompt: 'string | null',
    model: 'flux-1.1-pro | flux-schnell | ideogram-v3 | recraft-v3 | stable-diffusion-3 | dall-e-3',
    aspectRatio: '1:1 | 16:9 | 9:16 | 4:3 | 3:4',
    x: 'number',
    y: 'number',
    width: 'number',
    height: 'number',
    removeBackground: 'boolean',
    style: 'photorealistic | illustration | flat | sketch | 3d | pixel | watercolor | null',
  },
}

export const GENERATE_STICKER_TOOL: ToolDefinition = {
  name: 'generate_sticker',
  description: `Generate an image with background removed for use as
a floating sticker/illustration in a scene.
Best for: icons, characters, objects, logos, decorative elements.
Uses illustration or flat style by default for clean edges after bg removal.
MUST call request_permission('imageGen', estimatedCost, reason) first.`,
  input_schema: {
    sceneId: 'string',
    prompt: 'string — describe the sticker (object, character, icon)',
    model: 'ImageModel — default: recraft-v3 for illustrations',
    style: 'illustration | flat | sketch | 3d — default: illustration',
    x: 'number',
    y: 'number',
    size: 'number — width and height in px (stickers are square)',
    rotation: 'number — degrees, default 0',
    animateIn: 'boolean — pop in with scale animation, default true',
  },
}

// All media generation tools
export const MEDIA_TOOLS: ToolDefinition[] = [
  PERMISSION_TOOL,
  LIST_AVATARS_TOOL,
  GENERATE_AVATAR_TOOL,
  GENERATE_VEO3_TOOL,
  GENERATE_IMAGE_TOOL,
  GENERATE_STICKER_TOOL,
]

// Tool filter presets
export interface ToolPreset {
  name: string
  description: string
  enabledTools: string[]
}

export const TOOL_PRESETS: ToolPreset[] = [
  {
    name: 'Whiteboard',
    description: 'Canvas2D + SVG + Assets + HTML (no media gen)',
    enabledTools: ['canvas2d', 'svg', 'assets', 'html'],
  },
  {
    name: 'Full Production',
    description: 'All tools enabled',
    enabledTools: ['canvas2d', 'svg', 'd3', 'three', 'lottie', 'assets', 'html', 'audio', 'video', 'avatars', 'ai-video', 'ai-images', 'stickers', 'interactions'],
  },
  {
    name: 'Budget Mode',
    description: 'No Avatars, no Veo3, Images allowed',
    enabledTools: ['canvas2d', 'svg', 'd3', 'three', 'lottie', 'assets', 'html', 'audio', 'video', 'ai-images', 'stickers', 'interactions'],
  },
  {
    name: 'Offline',
    description: 'No media generation at all',
    enabledTools: ['canvas2d', 'svg', 'd3', 'three', 'lottie', 'assets', 'html', 'audio', 'video', 'interactions'],
  },
]

// Tool filter chip definitions
export const TOOL_FILTER_CHIPS = [
  { id: 'canvas2d', label: 'Canvas2D', default: true },
  { id: 'svg', label: 'SVG', default: true },
  { id: 'd3', label: 'D3', default: true },
  { id: 'three', label: 'Three.js', default: true },
  { id: 'lottie', label: 'Lottie', default: true },
  { id: 'assets', label: 'Assets', default: true },
  { id: 'html', label: 'HTML', default: true },
  { id: 'audio', label: 'Audio', default: true },
  { id: 'video', label: 'Video', default: true },
  { id: 'avatars', label: 'HeyGen', default: true },
  { id: 'ai-video', label: 'Veo3', default: true },
  { id: 'ai-images', label: 'AI Images', default: true },
  { id: 'stickers', label: 'Stickers', default: true },
  { id: 'eleven-labs', label: 'ElevenLabs', default: true },
  { id: 'unsplash', label: 'Unsplash', default: true },
  { id: 'interactions', label: 'Interactions', default: true },
]
