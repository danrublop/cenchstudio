/**
 * Complete tool definitions for the Cench Studio agent system.
 * These are formatted for the Claude API tool_use feature.
 */

import type { ClaudeToolDefinition } from './types'

// ── Scene Tools ───────────────────────────────────────────────────────────────

export const CREATE_SCENE: ClaudeToolDefinition = {
  name: 'create_scene',
  description: `Create a new scene in the project. Use this when you need to add a new scene.
After creating a scene, use add_layer or set_scene_background to populate it.
Returns the new scene's ID.`,
  input_schema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Human-readable scene name, e.g. "Opening Hook" or "Data Overview"' },
      prompt: { type: 'string', description: 'One-sentence description of what this scene should show' },
      duration: { type: 'number', description: 'Scene duration in seconds (3–30)' },
      bgColor: { type: 'string', description: 'Background hex color, e.g. "#1a1a2e"' },
      position: { type: 'number', description: 'Index to insert at (0 = beginning). Omit to append at end.' },
    },
    required: ['name', 'prompt', 'duration'],
  },
}

export const DELETE_SCENE: ClaudeToolDefinition = {
  name: 'delete_scene',
  description: 'Delete a scene from the project. This is permanent.',
  input_schema: {
    type: 'object',
    properties: {
      sceneId: { type: 'string', description: 'ID of the scene to delete' },
    },
    required: ['sceneId'],
  },
}

export const DUPLICATE_SCENE: ClaudeToolDefinition = {
  name: 'duplicate_scene',
  description: 'Duplicate an existing scene. The copy is inserted immediately after the original.',
  input_schema: {
    type: 'object',
    properties: {
      sceneId: { type: 'string', description: 'ID of the scene to duplicate' },
    },
    required: ['sceneId'],
  },
}

export const REORDER_SCENES: ClaudeToolDefinition = {
  name: 'reorder_scenes',
  description: 'Move a scene from one position to another in the timeline.',
  input_schema: {
    type: 'object',
    properties: {
      fromIndex: { type: 'number', description: 'Current 0-based index of the scene' },
      toIndex: { type: 'number', description: 'Target 0-based index to move it to' },
    },
    required: ['fromIndex', 'toIndex'],
  },
}

export const SET_SCENE_DURATION: ClaudeToolDefinition = {
  name: 'set_scene_duration',
  description: 'Set the playback duration of a scene.',
  input_schema: {
    type: 'object',
    properties: {
      sceneId: { type: 'string', description: 'Scene ID' },
      duration: { type: 'number', description: 'Duration in seconds (3–30)' },
    },
    required: ['sceneId', 'duration'],
  },
}

export const SET_SCENE_BACKGROUND: ClaudeToolDefinition = {
  name: 'set_scene_background',
  description: 'Set the background color of a scene.',
  input_schema: {
    type: 'object',
    properties: {
      sceneId: { type: 'string', description: 'Scene ID' },
      bgColor: { type: 'string', description: 'Hex color string, e.g. "#0d0d0d"' },
    },
    required: ['sceneId', 'bgColor'],
  },
}

export const SET_TRANSITION: ClaudeToolDefinition = {
  name: 'set_transition',
  description: 'Set the transition effect that plays between this scene and the next.',
  input_schema: {
    type: 'object',
    properties: {
      sceneId: { type: 'string', description: 'Scene ID' },
      transition: {
        type: 'string',
        enum: ['none', 'crossfade', 'wipe-left', 'wipe-right'],
        description: 'Transition type. "none" = instant cut.',
      },
    },
    required: ['sceneId', 'transition'],
  },
}

// ── Layer Tools ───────────────────────────────────────────────────────────────

export const ADD_LAYER: ClaudeToolDefinition = {
  name: 'add_layer',
  description: `Add a new animated layer to a scene. This generates the layer's visual content using AI.
For SVG: generates animated SVG illustration.
For canvas2d: generates Canvas2D animation code.
For d3: generates D3.js chart/visualization.
For three: generates Three.js 3D scene.
For motion: generates CSS/JS choreographed animation.`,
  input_schema: {
    type: 'object',
    properties: {
      sceneId: { type: 'string', description: 'Scene ID to add the layer to' },
      layerType: {
        type: 'string',
        enum: ['svg', 'canvas2d', 'd3', 'three', 'motion', 'lottie'],
        description: 'Type of layer to generate',
      },
      prompt: { type: 'string', description: 'Detailed description of what to generate' },
      zIndex: { type: 'number', description: 'Stack order (higher = on top). Default: 2' },
      opacity: { type: 'number', description: 'Layer opacity 0–1. Default: 1' },
      startAt: { type: 'number', description: 'Seconds into scene when layer appears. Default: 0' },
    },
    required: ['sceneId', 'layerType', 'prompt'],
  },
}

export const REMOVE_LAYER: ClaudeToolDefinition = {
  name: 'remove_layer',
  description: 'Remove a layer from a scene.',
  input_schema: {
    type: 'object',
    properties: {
      sceneId: { type: 'string', description: 'Scene ID' },
      layerId: { type: 'string', description: 'Layer/object ID to remove' },
    },
    required: ['sceneId', 'layerId'],
  },
}

export const REORDER_LAYER: ClaudeToolDefinition = {
  name: 'reorder_layer',
  description: 'Change the z-index (stacking order) of a layer within a scene.',
  input_schema: {
    type: 'object',
    properties: {
      sceneId: { type: 'string', description: 'Scene ID' },
      layerId: { type: 'string', description: 'Layer ID' },
      zIndex: { type: 'number', description: 'New z-index value' },
    },
    required: ['sceneId', 'layerId', 'zIndex'],
  },
}

export const SET_LAYER_OPACITY: ClaudeToolDefinition = {
  name: 'set_layer_opacity',
  description: 'Set the opacity of a layer.',
  input_schema: {
    type: 'object',
    properties: {
      sceneId: { type: 'string', description: 'Scene ID' },
      layerId: { type: 'string', description: 'Layer ID' },
      opacity: { type: 'number', description: 'Opacity value 0–1' },
    },
    required: ['sceneId', 'layerId', 'opacity'],
  },
}

export const SET_LAYER_VISIBILITY: ClaudeToolDefinition = {
  name: 'set_layer_visibility',
  description: 'Show or hide a layer (without deleting it).',
  input_schema: {
    type: 'object',
    properties: {
      sceneId: { type: 'string', description: 'Scene ID' },
      layerId: { type: 'string', description: 'Layer ID' },
      visible: { type: 'boolean', description: 'true = visible, false = hidden' },
    },
    required: ['sceneId', 'layerId', 'visible'],
  },
}

export const SET_LAYER_TIMING: ClaudeToolDefinition = {
  name: 'set_layer_timing',
  description: 'Set when a layer starts appearing within the scene.',
  input_schema: {
    type: 'object',
    properties: {
      sceneId: { type: 'string', description: 'Scene ID' },
      layerId: { type: 'string', description: 'Layer ID' },
      startAt: { type: 'number', description: 'Seconds into scene when layer becomes visible' },
    },
    required: ['sceneId', 'layerId', 'startAt'],
  },
}

export const REGENERATE_LAYER: ClaudeToolDefinition = {
  name: 'regenerate_layer',
  description: 'Completely regenerate a layer with a new or updated prompt. Use when the user wants to redo a layer from scratch.',
  input_schema: {
    type: 'object',
    properties: {
      sceneId: { type: 'string', description: 'Scene ID' },
      layerId: { type: 'string', description: 'Layer ID to regenerate' },
      prompt: { type: 'string', description: 'New prompt for generation. Can be same or updated.' },
    },
    required: ['sceneId', 'layerId', 'prompt'],
  },
}

export const PATCH_LAYER_CODE: ClaudeToolDefinition = {
  name: 'patch_layer_code',
  description: `Make a surgical code edit to an existing layer's code (SVG markup, Canvas JS, D3 JS, Three.js, etc.).
Finds oldCode as an exact substring in the layer's code and replaces with newCode.
Use for targeted fixes: color changes, timing adjustments, removing unwanted animations.
IMPORTANT: oldCode must be an exact match — copy it precisely from the world state.`,
  input_schema: {
    type: 'object',
    properties: {
      sceneId: { type: 'string', description: 'Scene ID' },
      layerId: { type: 'string', description: 'Layer/object ID whose code to patch' },
      oldCode: { type: 'string', description: 'Exact substring to find and replace' },
      newCode: { type: 'string', description: 'Replacement code' },
    },
    required: ['sceneId', 'layerId', 'oldCode', 'newCode'],
  },
}

// ── Element Tools ─────────────────────────────────────────────────────────────

export const ADD_ELEMENT: ClaudeToolDefinition = {
  name: 'add_element',
  description: 'Add a text overlay element to a scene.',
  input_schema: {
    type: 'object',
    properties: {
      sceneId: { type: 'string', description: 'Scene ID' },
      content: { type: 'string', description: 'Text content to display' },
      font: { type: 'string', description: 'Font family, e.g. "Caveat", "Inter", "Playfair Display"' },
      size: { type: 'number', description: 'Font size in pixels (16–120)' },
      color: { type: 'string', description: 'Text hex color' },
      x: { type: 'number', description: 'Horizontal position as % of canvas width (0–100)' },
      y: { type: 'number', description: 'Vertical position as % of canvas height (0–100)' },
      animation: {
        type: 'string',
        enum: ['fade-in', 'slide-up', 'none'],
        description: 'Entrance animation for the text element. Default: "fade-in"',
      },
      duration: { type: 'number', description: 'Animation duration in seconds. Default: 0.6' },
      delay: { type: 'number', description: 'Delay before animation starts (seconds). Default: 0' },
    },
    required: ['sceneId', 'content', 'x', 'y'],
  },
}

export const EDIT_ELEMENT: ClaudeToolDefinition = {
  name: 'edit_element',
  description: 'Edit properties of an existing text overlay element.',
  input_schema: {
    type: 'object',
    properties: {
      sceneId: { type: 'string', description: 'Scene ID' },
      elementId: { type: 'string', description: 'Text overlay ID' },
      content: { type: 'string', description: 'New text content (optional)' },
      font: { type: 'string', description: 'New font family (optional)' },
      size: { type: 'number', description: 'New font size in px (optional)' },
      color: { type: 'string', description: 'New hex color (optional)' },
      animation: { type: 'string', enum: ['fade-in', 'slide-up', 'none'], description: 'New animation (optional)' },
      duration: { type: 'number', description: 'New animation duration in seconds (optional)' },
      delay: { type: 'number', description: 'New animation delay in seconds (optional)' },
    },
    required: ['sceneId', 'elementId'],
  },
}

export const DELETE_ELEMENT: ClaudeToolDefinition = {
  name: 'delete_element',
  description: 'Delete a text overlay element from a scene.',
  input_schema: {
    type: 'object',
    properties: {
      sceneId: { type: 'string', description: 'Scene ID' },
      elementId: { type: 'string', description: 'Text overlay ID to delete' },
    },
    required: ['sceneId', 'elementId'],
  },
}

export const MOVE_ELEMENT: ClaudeToolDefinition = {
  name: 'move_element',
  description: 'Move a text overlay element to a new position.',
  input_schema: {
    type: 'object',
    properties: {
      sceneId: { type: 'string', description: 'Scene ID' },
      elementId: { type: 'string', description: 'Text overlay ID' },
      x: { type: 'number', description: 'New x position as % of canvas width (0–100)' },
      y: { type: 'number', description: 'New y position as % of canvas height (0–100)' },
    },
    required: ['sceneId', 'elementId', 'x', 'y'],
  },
}

export const RESIZE_ELEMENT: ClaudeToolDefinition = {
  name: 'resize_element',
  description: 'Resize a text overlay element (changes font size).',
  input_schema: {
    type: 'object',
    properties: {
      sceneId: { type: 'string', description: 'Scene ID' },
      elementId: { type: 'string', description: 'Text overlay ID' },
      size: { type: 'number', description: 'New font size in px' },
    },
    required: ['sceneId', 'elementId', 'size'],
  },
}

export const REORDER_ELEMENT: ClaudeToolDefinition = {
  name: 'reorder_element',
  description: 'Change the visual stacking order of a text overlay (via z-index concept — animation delay).',
  input_schema: {
    type: 'object',
    properties: {
      sceneId: { type: 'string', description: 'Scene ID' },
      elementId: { type: 'string', description: 'Text overlay ID' },
      zIndex: { type: 'number', description: 'New z-index — higher values appear on top of other elements' },
    },
    required: ['sceneId', 'elementId', 'zIndex'],
  },
}

export const ADJUST_ELEMENT_TIMING: ClaudeToolDefinition = {
  name: 'adjust_element_timing',
  description: 'Adjust when and how long a text overlay animates.',
  input_schema: {
    type: 'object',
    properties: {
      sceneId: { type: 'string', description: 'Scene ID' },
      elementId: { type: 'string', description: 'Text overlay ID' },
      delay: { type: 'number', description: 'Seconds before animation starts' },
      duration: { type: 'number', description: 'Animation duration in seconds' },
    },
    required: ['sceneId', 'elementId'],
  },
}

// ── Asset / Media Tools ───────────────────────────────────────────────────────

export const SEARCH_IMAGES: ClaudeToolDefinition = {
  name: 'search_images',
  description: 'Search Unsplash for royalty-free stock photos. Returns a list of image URLs and descriptions.',
  input_schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query, e.g. "mountain sunset" or "technology abstract"' },
      count: { type: 'number', description: 'Number of results to return (1–10). Default: 5' },
    },
    required: ['query'],
  },
}

export const PLACE_IMAGE: ClaudeToolDefinition = {
  name: 'place_image',
  description: 'Place a stock photo or uploaded image into a scene as an image layer.',
  input_schema: {
    type: 'object',
    properties: {
      sceneId: { type: 'string', description: 'Scene ID' },
      imageUrl: { type: 'string', description: 'URL of the image to place' },
      x: { type: 'number', description: 'Left position in pixels (0–1920)' },
      y: { type: 'number', description: 'Top position in pixels (0–1080)' },
      width: { type: 'number', description: 'Width in pixels' },
      height: { type: 'number', description: 'Height in pixels' },
      opacity: { type: 'number', description: 'Opacity 0–1. Default: 1' },
      zIndex: { type: 'number', description: 'Stack order. Default: 1' },
    },
    required: ['sceneId', 'imageUrl', 'x', 'y', 'width', 'height'],
  },
}

export const SET_AUDIO_LAYER: ClaudeToolDefinition = {
  name: 'set_audio_layer',
  description: 'Configure the audio layer for a scene (background music or narration).',
  input_schema: {
    type: 'object',
    properties: {
      sceneId: { type: 'string', description: 'Scene ID' },
      src: { type: 'string', description: 'Audio file URL or null to clear' },
      volume: { type: 'number', description: 'Volume 0–1. Default: 1' },
      fadeIn: { type: 'boolean', description: 'Fade in at start. Default: false' },
      fadeOut: { type: 'boolean', description: 'Fade out at end. Default: false' },
      startOffset: { type: 'number', description: 'Start playback at this offset in seconds. Default: 0' },
    },
    required: ['sceneId'],
  },
}

export const SET_VIDEO_LAYER: ClaudeToolDefinition = {
  name: 'set_video_layer',
  description: 'Configure the background video layer for a scene.',
  input_schema: {
    type: 'object',
    properties: {
      sceneId: { type: 'string', description: 'Scene ID' },
      src: { type: 'string', description: 'Video file URL or null to clear' },
      opacity: { type: 'number', description: 'Video opacity 0–1. Default: 1' },
      trimStart: { type: 'number', description: 'Start playback at this second. Default: 0' },
      trimEnd: { type: 'number', description: 'Stop playback at this second. null = play to end' },
    },
    required: ['sceneId'],
  },
}

// ── Global Style Tools ────────────────────────────────────────────────────────

export const SET_GLOBAL_STYLE: ClaudeToolDefinition = {
  name: 'set_global_style',
  description: 'Set the global visual style applied across all scenes.',
  input_schema: {
    type: 'object',
    properties: {
      palette: {
        type: 'array',
        description: 'Array of exactly 5 hex colors: [bg, bg2, accent, dark, light]',
        items: { type: 'string', description: 'Hex color string' },
      },
      font: {
        type: 'string',
        description: 'Google Font family name, e.g. "Caveat", "Inter", "Playfair Display", "Space Mono", "Oswald"',
      },
      strokeWidth: {
        type: 'number',
        description: 'Global stroke/line weight 1–5. Lower = precise, higher = hand-drawn look',
      },
      theme: {
        type: 'string',
        enum: ['dark', 'light'],
        description: 'Overall editor theme',
      },
      duration: {
        type: 'number',
        description: 'Default scene duration in seconds for newly created scenes',
      },
    },
    required: [],
  },
}

export const SET_ALL_TRANSITIONS: ClaudeToolDefinition = {
  name: 'set_all_transitions',
  description: 'Apply the same transition type to every scene in the project.',
  input_schema: {
    type: 'object',
    properties: {
      transition: {
        type: 'string',
        enum: ['none', 'crossfade', 'wipe-left', 'wipe-right'],
        description: 'Transition type to apply to all scenes',
      },
    },
    required: ['transition'],
  },
}

export const SET_ROUGHNESS_ALL: ClaudeToolDefinition = {
  name: 'set_roughness_all',
  description: 'Set the stroke width (roughness/precision level) for all hand-drawn elements globally.',
  input_schema: {
    type: 'object',
    properties: {
      strokeWidth: {
        type: 'number',
        description: 'Stroke width 1–5. 1=crisp/precise, 3=casual hand-drawn, 5=very rough',
      },
    },
    required: ['strokeWidth'],
  },
}

export const PLAN_SCENES: ClaudeToolDefinition = {
  name: 'plan_scenes',
  description: `Plan the complete scene structure for a video project before creating scenes.
Returns the plan as confirmation — then use create_scene for each scene.
Use this as a "thinking out loud" tool to structure your work.`,
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Project/video title' },
      scenes: {
        type: 'array',
        description: 'Planned scenes in order',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Scene name' },
            purpose: { type: 'string', description: 'What this scene accomplishes narratively' },
            sceneType: { type: 'string', description: 'Layer type: svg, canvas2d, d3, three, motion' },
            duration: { type: 'number', description: 'Duration in seconds' },
            transition: { type: 'string', description: 'Transition to next scene' },
          },
          required: ['name', 'purpose', 'sceneType', 'duration'],
        },
      },
      totalDuration: { type: 'number', description: 'Total planned duration in seconds' },
      styleNotes: { type: 'string', description: 'Visual style direction for the whole piece' },
    },
    required: ['title', 'scenes', 'totalDuration'],
  },
}

// ── Interaction Tools ─────────────────────────────────────────────────────────

export const ADD_INTERACTION: ClaudeToolDefinition = {
  name: 'add_interaction',
  description: `Add an interactive element to a scene (for Interactive output mode only).
Supports: hotspot (clickable pulse), choice (branching options), quiz (quiz question),
gate (force watch before continuing), tooltip (hover info), form (data collection).`,
  input_schema: {
    type: 'object',
    properties: {
      sceneId: { type: 'string', description: 'Scene ID' },
      type: {
        type: 'string',
        enum: ['hotspot', 'choice', 'quiz', 'gate', 'tooltip', 'form'],
        description: 'Interaction element type',
      },
      x: { type: 'number', description: 'X position as % of canvas (0–100)' },
      y: { type: 'number', description: 'Y position as % of canvas (0–100)' },
      width: { type: 'number', description: 'Width as % of canvas (0–100)' },
      height: { type: 'number', description: 'Height as % of canvas (0–100)' },
      appearsAt: { type: 'number', description: 'Seconds into scene when element appears' },
      config: {
        type: 'object',
        description: 'Type-specific configuration (label, options, question, etc.)',
        properties: {},
      },
    },
    required: ['sceneId', 'type', 'x', 'y', 'width', 'height', 'appearsAt', 'config'],
  },
}

export const EDIT_INTERACTION: ClaudeToolDefinition = {
  name: 'edit_interaction',
  description: 'Edit an existing interaction element.',
  input_schema: {
    type: 'object',
    properties: {
      sceneId: { type: 'string', description: 'Scene ID' },
      elementId: { type: 'string', description: 'Interaction element ID' },
      updates: {
        type: 'object',
        description: 'Fields to update on the interaction element',
        properties: {},
      },
    },
    required: ['sceneId', 'elementId', 'updates'],
  },
}

export const CONNECT_SCENES: ClaudeToolDefinition = {
  name: 'connect_scenes',
  description: 'Create an edge in the scene graph connecting two scenes (for Interactive mode).',
  input_schema: {
    type: 'object',
    properties: {
      fromSceneId: { type: 'string', description: 'Source scene ID' },
      toSceneId: { type: 'string', description: 'Destination scene ID' },
      conditionType: {
        type: 'string',
        enum: ['auto', 'hotspot', 'choice', 'quiz', 'gate'],
        description: '"auto" = plays automatically after duration',
      },
      interactionId: { type: 'string', description: 'ID of the interaction that triggers this edge (for non-auto conditions)' },
    },
    required: ['fromSceneId', 'toSceneId', 'conditionType'],
  },
}

// ── Export / Publish Tools ────────────────────────────────────────────────────

export const EXPORT_MP4: ClaudeToolDefinition = {
  name: 'export_mp4',
  description: 'Initiate an MP4 export of the current project.',
  input_schema: {
    type: 'object',
    properties: {
      resolution: {
        type: 'string',
        enum: ['720p', '1080p', '4k'],
        description: 'Export resolution. Default: 1080p',
      },
      fps: {
        type: 'number',
        description: 'Frames per second: 24, 30, or 60. Default: 30',
      },
    },
    required: [],
  },
}

export const PUBLISH_INTERACTIVE: ClaudeToolDefinition = {
  name: 'publish_interactive',
  description: 'Publish the project as an interactive experience and return the public URL.',
  input_schema: {
    type: 'object',
    properties: {},
    required: [],
  },
}

// ── Tool Collections ──────────────────────────────────────────────────────────

/** All scene-level tools */
export const SCENE_TOOLS: ClaudeToolDefinition[] = [
  CREATE_SCENE,
  DELETE_SCENE,
  DUPLICATE_SCENE,
  REORDER_SCENES,
  SET_SCENE_DURATION,
  SET_SCENE_BACKGROUND,
  SET_TRANSITION,
]

/** All layer tools */
export const LAYER_TOOLS: ClaudeToolDefinition[] = [
  ADD_LAYER,
  REMOVE_LAYER,
  REORDER_LAYER,
  SET_LAYER_OPACITY,
  SET_LAYER_VISIBILITY,
  SET_LAYER_TIMING,
  REGENERATE_LAYER,
  PATCH_LAYER_CODE,
]

/** All element (text overlay) tools */
export const ELEMENT_TOOLS: ClaudeToolDefinition[] = [
  ADD_ELEMENT,
  EDIT_ELEMENT,
  DELETE_ELEMENT,
  MOVE_ELEMENT,
  RESIZE_ELEMENT,
  REORDER_ELEMENT,
  ADJUST_ELEMENT_TIMING,
]

/** Asset / media tools */
export const ASSET_TOOLS: ClaudeToolDefinition[] = [
  SEARCH_IMAGES,
  PLACE_IMAGE,
  SET_AUDIO_LAYER,
  SET_VIDEO_LAYER,
]

/** Global style tools */
export const GLOBAL_TOOLS: ClaudeToolDefinition[] = [
  SET_GLOBAL_STYLE,
  SET_ALL_TRANSITIONS,
  SET_ROUGHNESS_ALL,
  PLAN_SCENES,
]

/** Interaction tools */
export const INTERACTION_TOOLS: ClaudeToolDefinition[] = [
  ADD_INTERACTION,
  EDIT_INTERACTION,
  CONNECT_SCENES,
]

/** Export tools */
export const EXPORT_TOOLS: ClaudeToolDefinition[] = [
  EXPORT_MP4,
  PUBLISH_INTERACTIVE,
]

/** All tools combined */
export const ALL_TOOLS: ClaudeToolDefinition[] = [
  ...SCENE_TOOLS,
  ...LAYER_TOOLS,
  ...ELEMENT_TOOLS,
  ...ASSET_TOOLS,
  ...GLOBAL_TOOLS,
  ...INTERACTION_TOOLS,
  ...EXPORT_TOOLS,
]

/** Deduplicate tools by name */
function dedup(tools: ClaudeToolDefinition[]): ClaudeToolDefinition[] {
  const seen = new Set<string>()
  return tools.filter(t => {
    if (seen.has(t.name)) return false
    seen.add(t.name)
    return true
  })
}

/** Tools available to each agent type */
export const AGENT_TOOLS: Record<string, ClaudeToolDefinition[]> = {
  director: dedup([...SCENE_TOOLS, ...LAYER_TOOLS, ...ELEMENT_TOOLS, ...GLOBAL_TOOLS]),
  'scene-maker': dedup([...LAYER_TOOLS, ...ELEMENT_TOOLS, SET_SCENE_DURATION, SET_SCENE_BACKGROUND, SET_TRANSITION]),
  editor: dedup([...LAYER_TOOLS, ...ELEMENT_TOOLS, SET_SCENE_BACKGROUND, SET_TRANSITION]),
  dop: dedup([...GLOBAL_TOOLS, SET_TRANSITION]),
}

/** Tool filter map: active tool category ID → which tool names it enables */
export const TOOL_CATEGORY_MAP: Record<string, string[]> = {
  svg: ['add_layer'],
  canvas2d: ['add_layer'],
  d3: ['add_layer'],
  three: ['add_layer'],
  lottie: ['add_layer'],
  assets: ['search_images', 'place_image'],
  audio: ['set_audio_layer'],
  video: ['set_video_layer'],
  interactions: ['add_interaction', 'edit_interaction', 'connect_scenes'],
}
