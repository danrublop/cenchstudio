/**
 * Complete tool definitions for the Cench Studio agent system.
 * These are formatted for the Claude API tool_use feature.
 */

import type { ClaudeToolDefinition } from './types'
import { ALL_TRANSITION_IDS } from '../transitions'
import { FONT_FAMILIES } from '../fonts/catalog'
import { CANVAS_MOTION_TEMPLATE_IDS } from '../templates/canvas-animation-templates'
import { CENCH_STUDIO_ENV_IDS } from '../three-environments/registry'

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
        enum: ALL_TRANSITION_IDS,
        description:
          'Transition type. "none" = instant cut. Prefer crossfade/dissolve for calm explainers; wipes/slides for energy.',
      },
    },
    required: ['sceneId', 'transition'],
  },
}

// ── Layer Tools ───────────────────────────────────────────────────────────────

export const ADD_LAYER: ClaudeToolDefinition = {
  name: 'add_layer',
  description: `Add a new animated layer to a scene. This generates the layer's visual content using AI.
For SVG: generates rough hand-drawn SVG illustration.
For canvas2d: generates rough hand-drawn Canvas2D animation code.
For d3: generates D3.js chart/visualization.
For three: generates Three.js 3D scene.
For motion: generates CSS/JS choreographed animation and text-heavy explainer layouts.
For lottie: generates Lottie JSON animation (all keyframes must include bezier easing i/o handles).
For zdog: generates Zdog pseudo-3D illustration with flat-shaded shapes and animation.`,
  input_schema: {
    type: 'object',
    properties: {
      sceneId: { type: 'string', description: 'Scene ID to add the layer to' },
      layerType: {
        type: 'string',
        enum: ['svg', 'canvas2d', 'd3', 'three', 'motion', 'lottie', 'zdog'],
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

export const APPLY_CANVAS_MOTION_TEMPLATE: ClaudeToolDefinition = {
  name: 'apply_canvas_motion_template',
  description: `Apply a built-in scrub-friendly Canvas2D motion template (particles, starfield, waves, rain, etc.) with no LLM cost. Default: switches the scene to canvas2d and replaces other renderer content. If asBackground is true on a motion, d3, or svg scene, keeps that content and draws the template as a full-frame animated layer behind it.`,
  input_schema: {
    type: 'object',
    properties: {
      sceneId: { type: 'string', description: 'Scene to update' },
      templateId: {
        type: 'string',
        enum: [...CANVAS_MOTION_TEMPLATE_IDS],
        description: 'Built-in template id (e.g. starfield, particle-burst, fluid-wave)',
      },
      bgColor: {
        type: 'string',
        description: 'Optional hex background; defaults to the template’s suggested color',
      },
      asBackground: {
        type: 'boolean',
        description:
          'If true and scene type is motion, d3, or svg: animate template as full background only; do not replace foreground. Ignored for other types (full canvas2d scene is used).',
      },
    },
    required: ['sceneId', 'templateId'],
  },
}

export const THREE_DATA_SCATTER_SCENE: ClaudeToolDefinition = {
  name: 'three_data_scatter_scene',
  description: `Build a **3D scatter plot** Three.js scene (vanilla WebGL) in the style of the CorticoAI 3d-react-demo — Cench stage + instanced spheres + RGB axes + soft orbit. Reference: https://github.com/CorticoAI/3d-react-demo (MIT). Does not use React/R3F; uses injected helpers createCenchDataScatterplot / updateCenchDataScatterplot. studioEnvironmentId must be track_rolling_topdown (rolling track lanes backdrop).`,
  input_schema: {
    type: 'object',
    properties: {
      sceneId: { type: 'string', description: 'Scene to replace with this Three.js scatter scene' },
      studioEnvironmentId: {
        type: 'string',
        enum: [...CENCH_STUDIO_ENV_IDS],
        description: 'Stage environment id (only track_rolling_topdown)',
      },
      points: {
        type: 'array',
        description: '3D positions — auto-centered and scaled to fit the stage',
        items: {
          type: 'object',
          properties: {
            x: { type: 'number' },
            y: { type: 'number' },
            z: { type: 'number' },
          },
          required: ['x', 'y', 'z'],
        },
      },
      orbitSpeed: { type: 'number', description: 'Rotation speed (default ~0.12)' },
      pointRadius: { type: 'number', description: 'Sphere radius per point (default ~0.14)' },
    },
    required: ['sceneId', 'studioEnvironmentId', 'points'],
  },
}

export const CREATE_ZDOG_COMPOSED_SCENE: ClaudeToolDefinition = {
  name: 'create_zdog_composed_scene',
  description: `Create a deterministic Zdog scene from reusable assets (people, modules, beats) with zero LLM generation.
Use this when you need reliable, repeatable pseudo-3D storytelling and should avoid model API costs.
Each person is generated from a seed-driven formula and animated via preset clips.`,
  input_schema: {
    type: 'object',
    properties: {
      sceneId: { type: 'string', description: 'Scene ID to update' },
      seed: { type: 'number', description: 'Global seed for deterministic person/style variation' },
      people: {
        type: 'array',
        description: 'People to place. Each entry: { id, formula?, placement:{x,y,z,scale?,rotationY?} }',
        items: { type: 'object' },
      },
      modules: {
        type: 'array',
        description: 'Reusable scene modules: barChart, lineChart, donutChart, presentationBoard, desk, tablet',
        items: { type: 'object' },
      },
      beats: {
        type: 'array',
        description: 'Animation beats. Each: { at, action, targetPersonId, duration? }',
        items: { type: 'object' },
      },
      title: { type: 'string', description: 'Optional scene title metadata' },
    },
    required: ['sceneId', 'seed', 'people', 'modules', 'beats'],
  },
}

export const SAVE_ZDOG_PERSON_ASSET: ClaudeToolDefinition = {
  name: 'save_zdog_person_asset',
  description: 'Save a reusable Zdog person formula asset to the project library for later use in composed scenes.',
  input_schema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Asset name, e.g. "Presenter Base A"' },
      formula: { type: 'object', description: 'Full ZdogPersonFormula object' },
      tags: { type: 'array', items: { type: 'string' }, description: 'Optional tags' },
    },
    required: ['name', 'formula'],
  },
}

export const LIST_ZDOG_PERSON_ASSETS: ClaudeToolDefinition = {
  name: 'list_zdog_person_assets',
  description: 'List saved reusable Zdog person assets in the project library.',
  input_schema: {
    type: 'object',
    properties: {},
    required: [],
  },
}

export const BUILD_ZDOG_ASSET: ClaudeToolDefinition = {
  name: 'build_zdog_asset',
  description: `Build a reusable Zdog shape assembly (character, item, prop, icon) and save it to the project library.
Shapes use a parent-child hierarchy via parentId. Each shape has a type (Ellipse, Rect, RoundedRect, Polygon, Shape, Anchor, Group, Box, Cylinder, Cone, Hemisphere), properties (stroke, color, fill, diameter, width, height, depth, etc.), and transforms (translate, rotate, scale).

Common patterns:
- Person rig: hips (Shape) → spine (Anchor) → chest (Shape) → head (Shape) + arms + legs
- Props: Box/Cylinder combinations for furniture, devices, etc.
- Icons: Ellipse/Shape combos for simple symbols

Zdog coordinate system: x=right, y=DOWN, z=toward camera. Use stroke for rounded depth. Anchor/Group for invisible grouping nodes.`,
  input_schema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Asset name, e.g. "Office Chair", "Presenter A", "Laptop"' },
      shapes: {
        type: 'array',
        description: 'Array of ZdogStudioShape objects defining the shape hierarchy',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Unique shape identifier' },
            type: {
              type: 'string',
              enum: [
                'Ellipse',
                'Rect',
                'RoundedRect',
                'Polygon',
                'Shape',
                'Anchor',
                'Group',
                'Box',
                'Cylinder',
                'Cone',
                'Hemisphere',
              ],
            },
            parentId: { type: 'string', description: 'Parent shape ID (omit for root shapes)' },
            name: { type: 'string', description: 'Human-readable shape name' },
            properties: {
              type: 'object',
              description:
                'Shape properties: stroke, color, fill, diameter, width, height, depth, length, cornerRadius, sides, radius, quarters, closed, visible, backface, frontFace/rearFace/leftFace/rightFace/topFace/bottomFace (Box), path (Shape)',
            },
            transforms: {
              type: 'object',
              description: '{ translate: {x,y,z}, rotate: {x,y,z}, scale: number|{x,y,z} }',
              properties: {
                translate: { type: 'object' },
                rotate: { type: 'object' },
                scale: { type: 'number', description: 'Uniform number or {x,y,z} vector' },
              },
            },
          },
          required: ['id', 'type', 'name', 'properties', 'transforms'],
        },
      },
      tags: { type: 'array', items: { type: 'string' }, description: 'Optional tags for categorization' },
    },
    required: ['name', 'shapes'],
  },
}

export const GENERATE_CHART: ClaudeToolDefinition = {
  name: 'generate_chart',
  description: `Create an animated chart using a preset chart type. Much faster and more consistent than generating raw D3 code via add_layer. Use this for standard chart types (bar, line, pie, scatter, etc.). Falls back to add_layer with layerType 'd3' only for exotic/custom visualizations that don't fit a preset.
Each call appends a chart to scene.chartLayers (supports multi-chart scenes) and recompiles D3 scene code from structured layers.

Static mode (default): chart renders at full final state immediately.
Animated mode (animated: true): chart starts invisible and adds a cinematic reveal sequence to the GSAP timeline — title fades in, axes appear, data elements animate (bars grow, lines draw, pies sweep), then labels count up. Requires the scene to have a duration set.`,
  input_schema: {
    type: 'object',
    properties: {
      sceneId: { type: 'string', description: 'Scene ID to add the chart to' },
      chartType: {
        type: 'string',
        enum: [
          'bar',
          'horizontalBar',
          'stackedBar',
          'groupedBar',
          'line',
          'area',
          'pie',
          'donut',
          'scatter',
          'number',
          'gauge',
          'funnel',
          'plotly',
          'recharts',
        ],
        description: 'Chart type preset to use',
      },
      data: {
        anyOf: [{ type: 'array', items: { type: 'object' } }, { type: 'object' }],
        description:
          'Chart data: array for most CenchCharts; object for number/gauge; funnel uses [{label,value}]; plotly uses { traces: [...] }; recharts uses [{label,value}] (or custom keys via config.categoryKey / valueKey) for bar|line|area (config.rechartsVariant).',
      } as import('./types').ClaudePropertySchema,
      config: {
        type: 'object',
        description:
          'Chart configuration: title, subtitle, xLabel, yLabel, valueFormat, colors (array), theme ("dark"|"light"), textColor, axisColor, gridColor, titleColor, tickLabelColor, axisLabelColor, legendTextColor, valueLabelColor, useSceneAxisColors (bool), barStroke, barStrokeWidth. For plotly: plotlyLayout and plotlyConfig. For recharts: rechartsVariant ("bar"|"line"|"area"), categoryKey, valueKey, showGrid, colors.',
      },
      animated: {
        type: 'boolean',
        description:
          'If true, chart animates onto the GSAP timeline with a cinematic reveal. If false (default), renders at final state immediately. Animated mode requires the scene to have a duration.',
      },
      name: {
        type: 'string',
        description: 'Display name for this chart in the layer stack (optional).',
      },
      layout: {
        type: 'object',
        description:
          'Position in percent of #chart area: x, y, width, height (0–100). Optional; defaults to full-area or auto-grid when multiple charts.',
        properties: {
          x: { type: 'number' },
          y: { type: 'number' },
          width: { type: 'number' },
          height: { type: 'number' },
        },
      },
    },
    required: ['sceneId', 'chartType', 'data'],
  },
}

export const UPDATE_CHART: ClaudeToolDefinition = {
  name: 'update_chart',
  description: `Edit an existing CenchCharts layer by id (from context chartLayers). Merges config and can replace data, layout, timing, chartType, or name. Prefer this over raw code patches for standard charts.`,
  input_schema: {
    type: 'object',
    properties: {
      sceneId: { type: 'string' },
      chartId: { type: 'string', description: 'Layer id from chartLayers' },
      name: { type: 'string' },
      chartType: {
        type: 'string',
        enum: [
          'bar',
          'horizontalBar',
          'stackedBar',
          'groupedBar',
          'line',
          'area',
          'pie',
          'donut',
          'scatter',
          'number',
          'gauge',
          'funnel',
          'plotly',
          'recharts',
        ],
      },
      data: {
        anyOf: [{ type: 'array', items: { type: 'object' } }, { type: 'object' }],
        description: 'Replace chart data: array for bar/line/… or object for number/gauge',
      } as import('./types').ClaudePropertySchema,
      config: {
        type: 'object',
        description: 'Partial config merged into existing (title, showGrid, colors, etc.)',
      },
      layout: {
        type: 'object',
        properties: {
          x: { type: 'number' },
          y: { type: 'number' },
          width: { type: 'number' },
          height: { type: 'number' },
        },
      },
      timing: {
        type: 'object',
        properties: {
          startAt: { type: 'number' },
          duration: { type: 'number' },
        },
      },
      animated: { type: 'boolean' },
    },
    required: ['sceneId', 'chartId'],
  },
}

export const REMOVE_CHART: ClaudeToolDefinition = {
  name: 'remove_chart',
  description: 'Remove one chart from a D3 scene by chart layer id. Recompiles sceneCode from remaining chartLayers.',
  input_schema: {
    type: 'object',
    properties: {
      sceneId: { type: 'string' },
      chartId: { type: 'string' },
    },
    required: ['sceneId', 'chartId'],
  },
}

export const REORDER_CHARTS: ClaudeToolDefinition = {
  name: 'reorder_charts',
  description:
    'Set draw order of charts in a D3 scene (first id = back, last = front when charts overlap). Must list every chart id exactly once, same length as chartLayers.',
  input_schema: {
    type: 'object',
    properties: {
      sceneId: { type: 'string' },
      orderedChartIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'Full ordered list of chart layer ids',
      },
    },
    required: ['sceneId', 'orderedChartIds'],
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
  description:
    'Completely regenerate a layer with a new or updated prompt. Use when the user wants to redo a layer from scratch.',
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

// ── AI Layer Editing Tools ───────────────────────────────────────────────────

export const UPDATE_AI_LAYER: ClaudeToolDefinition = {
  name: 'update_ai_layer',
  description: `Update properties of an existing AI layer (image, sticker, avatar, or veo3).
Use this to move, resize, rotate, or change opacity of any AI layer after it's been placed.
Only the properties you include will be updated — omitted ones keep their current values.`,
  input_schema: {
    type: 'object',
    properties: {
      sceneId: { type: 'string', description: 'Scene ID' },
      layerId: { type: 'string', description: 'The AI layer ID to update' },
      x: { type: 'number', description: 'New center X position (0–1920)' },
      y: { type: 'number', description: 'New center Y position (0–1080)' },
      width: { type: 'number', description: 'New width in pixels' },
      height: { type: 'number', description: 'New height in pixels' },
      rotation: { type: 'number', description: 'Rotation in degrees (0–360)' },
      opacity: { type: 'number', description: 'Opacity 0–1' },
      zIndex: { type: 'number', description: 'Stack order' },
      label: { type: 'string', description: 'Display label' },
    },
    required: ['sceneId', 'layerId'],
  },
}

export const ANIMATE_AI_LAYER: ClaudeToolDefinition = {
  name: 'animate_ai_layer',
  description: `Add an entrance or exit animation to an AI layer (image, sticker, avatar, or veo3).
The animation plays relative to the scene timeline using GSAP.
Set delay to control when the animation starts (in seconds from scene start).`,
  input_schema: {
    type: 'object',
    properties: {
      sceneId: { type: 'string', description: 'Scene ID' },
      layerId: { type: 'string', description: 'The AI layer ID to animate' },
      animation: {
        type: 'string',
        enum: [
          'fade-in',
          'fade-out',
          'slide-left',
          'slide-right',
          'slide-up',
          'slide-down',
          'scale-in',
          'scale-out',
          'spin-in',
          'none',
        ],
        description: 'Animation type',
      },
      duration: { type: 'number', description: 'Animation duration in seconds (default: 0.5)' },
      delay: { type: 'number', description: 'Delay from scene start in seconds (default: 0)' },
      easing: {
        type: 'string',
        description: 'CSS easing function (default: "ease-out"). Options: ease, ease-in, ease-out, ease-in-out, linear',
      },
    },
    required: ['sceneId', 'layerId', 'animation'],
  },
}

export const SET_LAYER_FILTER: ClaudeToolDefinition = {
  name: 'set_layer_filter',
  description: `Apply CSS filters to an AI layer (image, sticker, avatar, veo3).
Combine multiple filters in one string, e.g. "blur(2px) brightness(1.2) grayscale(0.5)".
Pass "none" to remove all filters.

Available filters: blur(Npx), brightness(N), contrast(N), grayscale(N), saturate(N), sepia(N), hue-rotate(Ndeg), invert(N), opacity(N), drop-shadow(x y blur color)`,
  input_schema: {
    type: 'object',
    properties: {
      sceneId: { type: 'string', description: 'Scene ID' },
      layerId: { type: 'string', description: 'The AI layer ID' },
      filter: { type: 'string', description: 'CSS filter string, e.g. "blur(3px) brightness(1.1)" or "none" to clear' },
    },
    required: ['sceneId', 'layerId', 'filter'],
  },
}

export const CROP_IMAGE_LAYER: ClaudeToolDefinition = {
  name: 'crop_image_layer',
  description: `Crop an image or sticker layer by adjusting its visible region.
This works by changing the layer's position and size to show only a portion of the image.
Use objectPosition to control which part of the image is visible (like CSS object-position).`,
  input_schema: {
    type: 'object',
    properties: {
      sceneId: { type: 'string', description: 'Scene ID' },
      layerId: { type: 'string', description: 'The image/sticker layer ID' },
      cropX: {
        type: 'number',
        description: 'Horizontal crop offset in percent (0–100). 0 = left edge, 50 = center, 100 = right edge',
      },
      cropY: {
        type: 'number',
        description: 'Vertical crop offset in percent (0–100). 0 = top edge, 50 = center, 100 = bottom edge',
      },
      cropWidth: { type: 'number', description: 'Visible width of the image container in pixels' },
      cropHeight: { type: 'number', description: 'Visible height of the image container in pixels' },
    },
    required: ['sceneId', 'layerId', 'cropWidth', 'cropHeight'],
  },
}

export const AI_LAYER_TOOLS: ClaudeToolDefinition[] = [
  UPDATE_AI_LAYER,
  ANIMATE_AI_LAYER,
  SET_LAYER_FILTER,
  CROP_IMAGE_LAYER,
]

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

export const REQUEST_SCREEN_RECORDING: ClaudeToolDefinition = {
  name: 'request_screen_recording',
  description:
    'Trigger Electron screen recording for a scene and auto-attach the captured footage to that scene video layer.',
  input_schema: {
    type: 'object',
    properties: {
      sceneId: { type: 'string', description: 'Scene ID to attach recording to' },
      fps: { type: 'number', description: 'Preferred capture frame rate (e.g. 30, 60)' },
      resolution: {
        type: 'string',
        enum: ['720p', '1080p', '1440p', '2160p', 'source'],
        description: 'Preferred capture resolution hint',
      },
    },
    required: ['sceneId'],
  },
}

// ── Global Style Tools ────────────────────────────────────────────────────────

export const SET_GLOBAL_STYLE: ClaudeToolDefinition = {
  name: 'set_global_style',
  description:
    'Set the global visual style applied across all scenes. Presets are optional starting points — set presetId to null for full style autonomy.',
  input_schema: {
    type: 'object',
    properties: {
      presetId: {
        type: 'string',
        description:
          'Style preset ID (e.g. "whiteboard", "cinematic"), or the literal string "none" to clear the preset and give the agent full style autonomy.',
      },
      scope: {
        type: 'string',
        enum: ['project_default', 'all_scenes', 'new_scenes_only'],
        description:
          'project_default/new_scenes_only: sets default for new scenes (existing scenes keep their overrides). all_scenes: clears all per-scene overrides and re-applies globally.',
      },
      palette: {
        type: 'array',
        description: 'Array of exactly 5 hex colors: [bg, bg2, accent, dark, light]',
        items: { type: 'string', description: 'Hex color string' },
      },
      font: {
        type: 'string',
        enum: FONT_FAMILIES,
        description: 'Font family from the curated catalog. Pick one that matches the content tone.',
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

export const SET_SCENE_STYLE: ClaudeToolDefinition = {
  name: 'set_scene_style',
  description: `Apply a style preset or custom style override to a specific scene.
Use for: before/after comparisons, highlighting key scenes, chalkboard sections, technical blueprint diagrams.
Named presets: before, after, warning, highlight, chalkboard, blueprint, newspaper, neon.
Or specify custom palette/bgColor/font/roughness directly. Pass null values to inherit from global style.`,
  input_schema: {
    type: 'object',
    properties: {
      sceneId: { type: 'string', description: 'Scene ID' },
      preset: {
        type: 'string',
        enum: ['before', 'after', 'warning', 'highlight', 'chalkboard', 'blueprint', 'newspaper', 'neon'],
        description: 'Named preset to apply. Overrides individual properties below.',
      },
      palette: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of exactly 4 hex colors',
      },
      bgColor: { type: 'string', description: 'Background hex color' },
      font: { type: 'string', enum: FONT_FAMILIES, description: 'Font family from the curated catalog' },
      roughnessLevel: { type: 'number', description: 'Roughness 0–3' },
      defaultTool: { type: 'string', description: 'Drawing tool: marker, pen, chalk, brush' },
    },
    required: ['sceneId'],
  },
}

export const STYLE_SCENE: ClaudeToolDefinition = {
  name: 'style_scene',
  description: `Declare style intent for a scene. Sets visual overrides and a human-readable styleNote explaining the choice.
Use this to give a scene its own visual identity — different palette, font, roughness, texture, etc.
All fields are optional; omitted fields inherit from the global style.
Use when: a scene needs a different mood, you're blending preset elements, or the content demands a specific visual treatment.`,
  input_schema: {
    type: 'object',
    properties: {
      sceneId: { type: 'string', description: 'Scene ID' },
      palette: { type: 'array', items: { type: 'string' }, description: '4 hex colors' },
      bgColor: { type: 'string', description: 'Background color' },
      bgStyle: { type: 'string', enum: ['plain', 'paper', 'grid', 'dots', 'chalkboard', 'kraft'] },
      font: { type: 'string', enum: FONT_FAMILIES },
      roughnessLevel: { type: 'number', description: '0-3' },
      defaultTool: { type: 'string', enum: ['marker', 'pen', 'chalk', 'brush', 'highlighter'] },
      strokeColorOverride: { type: 'string', description: 'Primary stroke color override' },
      textureStyle: { type: 'string', enum: ['none', 'grain', 'paper', 'chalk', 'lines'] },
      textureIntensity: { type: 'number', description: '0-1' },
      textureBlendMode: { type: 'string', enum: ['multiply', 'screen', 'overlay'] },
      axisColor: { type: 'string' },
      gridColor: { type: 'string' },
      styleNote: {
        type: 'string',
        description:
          'Brief note explaining this style choice, shown in UI. E.g. "Going darker here for the reveal moment."',
      },
      inspiration: {
        type: 'string',
        description: "Optional: which preset(s) or references inspired this scene's style",
      },
    },
    required: ['sceneId'],
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
        enum: ALL_TRANSITION_IDS,
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

const PLAN_SCENES_INPUT_SCHEMA: ClaudeToolDefinition['input_schema'] = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Project/video title' },
    scenes: {
      type: 'array',
      description: 'Planned scenes in order',
      items: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Stable storyboard scene id for diffing/reverts (optional; tool may auto-generate)',
          },
          name: { type: 'string', description: 'Scene name' },
          purpose: { type: 'string', description: 'What this scene accomplishes narratively' },
          sceneType: {
            type: 'string',
            enum: ['svg', 'canvas2d', 'd3', 'three', 'motion', 'lottie', 'zdog', 'physics', 'avatar_scene', '3d_world'],
            description:
              'Renderer type. motion=default for layouts/text/cards/explainers, canvas2d=hand-drawn/particles/procedural, d3=data/charts, three=3D depth/products, 3d_world=immersive environments, zdog=pseudo-3D illustration, avatar_scene=presenter focus, physics=live simulations, svg=rare vector draw-on, lottie=icon loops',
          },
          duration: {
            type: 'number',
            description: 'Duration in seconds (6-30). If narrationDraft provided, auto-calculated from word count.',
          },
          transition: { type: 'string', enum: ALL_TRANSITION_IDS, description: 'Transition to next scene' },
          narrationDraft: {
            type: 'string',
            description:
              'Draft narration text for this scene. Used to calculate duration (wordCount/2.5 + 3, min 6s). Write at ~150 WPM.',
          },
          visualElements: {
            type: 'string',
            description:
              'Key visual elements: "3 labeled boxes connected by arrows, title at top, color-coded by category"',
          },
          audioNotes: {
            type: 'string',
            description: 'SFX/music cues: "whoosh on transition, click on each step reveal"',
          },
          chartSpec: {
            type: 'object',
            description: 'If this scene uses D3/CenchCharts, specify chart details',
            properties: {
              type: {
                type: 'string',
                description:
                  'Chart type: bar, line, pie, donut, scatter, area, gauge, number, stackedBar, groupedBar, horizontalBar',
              },
              dataDescription: {
                type: 'string',
                description: 'What data to show: "Revenue by quarter Q1-Q4 2024, values 2.1M to 3.8M"',
              },
            },
          },
          mediaLayers: {
            type: 'string',
            description:
              'Planned media overlays: "avatar PIP bottom-right, background music corporate upbeat, stock photo of heart anatomy as bg"',
          },
          cameraMovement: {
            type: 'string',
            description:
              'Camera motion plan: "kenBurns slow zoom 1.04x", "cinematicPush toward center", "orbit around 3D object"',
          },
          physicsSimulation: {
            type: 'string',
            enum: [
              'pendulum',
              'double_pendulum',
              'projectile',
              'orbital',
              'wave_interference',
              'double_slit',
              'electric_field',
              'harmonic_oscillator',
            ],
            description: 'For physics scene type: which simulation to run',
          },
          worldEnvironment: {
            type: 'string',
            enum: ['meadow', 'studio_room', 'void_space'],
            description: 'For 3d_world scene type: which environment to use',
          },
        },
        required: ['name', 'purpose', 'sceneType', 'duration'],
      },
    },
    totalDuration: { type: 'number', description: 'Total planned duration in seconds' },
    styleNotes: { type: 'string', description: 'Visual style direction for the whole piece' },
    featureFlags: {
      type: 'object',
      description:
        'Which features to use. Educational content → narration:true, music:true. Abstract art → narration:false.',
      properties: {
        narration: {
          type: 'boolean',
          description: 'Add narration to each scene (true for educational/narrative content)',
        },
        music: { type: 'boolean', description: 'Add background music to first scene' },
        sfx: { type: 'boolean', description: 'Add sound effects at key moments' },
        interactions: { type: 'boolean', description: 'Add interactive elements (for interactive output mode)' },
      },
    },
  },
  required: ['title', 'scenes', 'totalDuration'],
}

export const PLAN_SCENES: ClaudeToolDefinition = {
  name: 'plan_scenes',
  description: `Plan the complete scene structure for a video project before creating scenes.
This is a CRITICAL first step — it stores a storyboard that provides narrative context
to all subsequent scene generation. Include narration drafts to auto-calculate durations.

After calling this, execute: set_global_style → then for EACH scene: create_scene → add_layer/generate_chart → add_narration.`,
  input_schema: PLAN_SCENES_INPUT_SCHEMA,
}

/** Same tool as PLAN_SCENES — description for plan-only agent (no execution instructions). */
export const PLAN_SCENES_PLANNER: ClaudeToolDefinition = {
  name: 'plan_scenes',
  description: `Save a deeply informed storyboard demonstrating WHY each scene type was chosen — what it can uniquely render that others cannot.

For each scene: write a concrete visualElements description (not vague), a narrationDraft for duration estimation, and mediaLayers/cameraMovement when relevant. For D3 scenes, always include chartSpec with data specifics. For physics scenes, specify physicsSimulation. For 3d_world scenes, specify worldEnvironment.

You ONLY plan — you cannot create scenes or layers. The user reviews and approves; a Director run builds the project.`,
  input_schema: PLAN_SCENES_INPUT_SCHEMA,
}

// ── Interaction Tools ─────────────────────────────────────────────────────────

export const ADD_INTERACTION: ClaudeToolDefinition = {
  name: 'add_interaction',
  description: `Add an interactive element to a scene. Uses the CenchInteract component library
for production-ready visuals. The style auto-detects from the scene preset if set to "auto".

Types: hotspot (clickable/hover info on diagram parts), choice (branching options),
quiz (assessment with correct/incorrect feedback), gate (blocks progression until condition met),
tooltip (persistent or triggered info overlay), form (data collection mid-scene).

Interaction components are professional and production-ready — provide content/config only,
the visual design is handled by the CenchInteract component library with 6 preset styles.`,
  input_schema: {
    type: 'object',
    properties: {
      sceneId: { type: 'string', description: 'Scene ID' },
      type: {
        type: 'string',
        enum: ['hotspot', 'choice', 'quiz', 'gate', 'tooltip', 'form'],
        description: 'Interaction element type',
      },
      style: {
        type: 'string',
        enum: ['professional', 'glassmorphic', 'minimal', 'terminal', 'chalk', 'edu', 'auto'],
        description:
          'Visual style. "auto" detects from scene preset. professional=corporate, glassmorphic=frosted glass (dark scenes), minimal=near-invisible, terminal=amber phosphor, chalk=hand-drawn, edu=friendly rounded.',
      },
      x: { type: 'number', description: 'X position as % of canvas (0–100)' },
      y: { type: 'number', description: 'Y position as % of canvas (0–100)' },
      width: { type: 'number', description: 'Width as % of canvas (0–100)' },
      height: { type: 'number', description: 'Height as % of canvas (0–100)' },
      appearsAt: { type: 'number', description: 'Seconds into scene when element appears' },
      config: {
        type: 'object',
        description: 'Type-specific configuration (label, options, question, explanation, etc.)',
        properties: {},
      },
      placementNote: {
        type: 'string',
        description: 'Optional note about why this interaction is placed here and what it achieves',
      },
    },
    required: ['sceneId', 'type', 'x', 'y', 'width', 'height', 'appearsAt', 'config'],
  },
}

export const ADD_MULTIPLE_INTERACTIONS: ClaudeToolDefinition = {
  name: 'add_multiple_interactions',
  description: `Add several interactions to a scene at once. Use for diagram scenes with
multiple labeled hotspots, or assessment scenes with quiz + gate combination.`,
  input_schema: {
    type: 'object',
    properties: {
      sceneId: { type: 'string', description: 'Scene ID' },
      interactions: {
        type: 'array',
        description: 'Array of interaction configs, each with type, style, x, y, width, height, appearsAt, config',
        items: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['hotspot', 'choice', 'quiz', 'gate', 'tooltip', 'form'] },
            style: {
              type: 'string',
              enum: ['professional', 'glassmorphic', 'minimal', 'terminal', 'chalk', 'edu', 'auto'],
            },
            x: { type: 'number' },
            y: { type: 'number' },
            width: { type: 'number' },
            height: { type: 'number' },
            appearsAt: { type: 'number' },
            config: { type: 'object' },
          },
          required: ['type', 'x', 'y', 'width', 'height', 'appearsAt', 'config'],
        },
      },
    },
    required: ['sceneId', 'interactions'],
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
      interactionId: {
        type: 'string',
        description: 'ID of the interaction that triggers this edge (for non-auto conditions)',
      },
    },
    required: ['fromSceneId', 'toSceneId', 'conditionType'],
  },
}

// ── Avatar Narration Tool ────────────────────────────────────────────────────

export const GENERATE_AVATAR_NARRATION: ClaudeToolDefinition = {
  name: 'generate_avatar_narration',
  description: `Generate a talking avatar video for a scene. The avatar speaks the provided text with synchronized lip movements.

The project's configured avatar provider determines quality and cost:
- talkinghead: Free 3D animated character, renders inside the scene
- musetalk/fabric/aurora: Photorealistic talking head via fal.ai (~$0.04-0.15/scene)
- heygen: Premium quality via HeyGen API

The result is automatically composited into the scene as a picture-in-picture overlay or full-screen presenter.

Use when the user asks for a presenter, host, narrator avatar, talking head, or person explaining something on screen.
Do NOT add an avatar unless the user asks for one. Many explainer videos work better without a presenter.`,
  input_schema: {
    type: 'object',
    properties: {
      sceneId: {
        type: 'string',
        description: 'Scene to add the avatar to',
      },
      text: {
        type: 'string',
        description: 'What the avatar should say. Keep it natural and conversational.',
      },
      placement: {
        type: 'string',
        enum: ['pip_bottom_right', 'pip_bottom_left', 'fullscreen', 'pip_top_right'],
        description:
          'How to position the avatar in the scene. pip = picture-in-picture overlay. Default: pip_bottom_right',
      },
      avatarConfigId: {
        type: 'string',
        description: 'Specific avatar config to use. Omit to use project default.',
      },
      sourceImageUrl: {
        type: 'string',
        description: 'URL of a face image (for fal.ai providers). Omit to use the configured default.',
      },
    },
    required: ['sceneId', 'text'],
  },
}

export const GENERATE_AVATAR_SCENE: ClaudeToolDefinition = {
  name: 'generate_avatar_scene',
  description: `Create a full avatar presenter scene where the 3D character is the main focus.
Use instead of a regular scene when the scene should feature a talking avatar as the primary visual — presenter mode, tutorial, walkthrough.

The avatar can stand and talk, point at content panels, show emotions, and react with gestures.
Content panels animate in beside the avatar, synchronized with speech.

Best for: step-by-step explanations, data walkthroughs, educational content, corporate spokesperson.
Do NOT use for: data-heavy scenes (use PIP avatar), abstract concept scenes, or scenes < 5 seconds.`,
  input_schema: {
    type: 'object',
    properties: {
      sceneId: {
        type: 'string',
        description: 'Target scene ID',
      },
      narration_script: {
        type: 'object',
        description: 'Full narration script with mood, view, gestures, and lines',
        properties: {
          mood: { type: 'string', enum: ['neutral', 'happy', 'sad', 'angry', 'fear', 'surprise'] },
          view: { type: 'string', enum: ['full', 'mid', 'upper', 'head'] },
          lipsyncHeadMovement: { type: 'boolean' },
          eyeContact: { type: 'number', description: '0-1, default 0.7' },
          position: { type: 'string', enum: ['fullscreen', 'fullscreen_left', 'fullscreen_right'] },
          lines: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                text: { type: 'string' },
                mood: { type: 'string', enum: ['neutral', 'happy', 'sad', 'angry', 'fear', 'surprise'] },
                gesture: {
                  type: 'string',
                  enum: ['wave', 'handup', 'index', 'ok', 'thumbup', 'thumbdown', 'side', 'shrug'],
                },
                gestureHand: { type: 'string', enum: ['left', 'right'] },
                lookAt: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' } } },
                lookCamera: { type: 'boolean' },
                pauseBefore: { type: 'number', description: 'ms pause before this line' },
                animation: { type: 'string' },
              },
              required: ['text'],
            },
          },
        },
        required: ['mood', 'view', 'lines'],
      },
      content_panels: {
        type: 'array',
        description: 'Content panels shown beside the avatar',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            html: { type: 'string', description: 'HTML content for the panel' },
            position: { type: 'string', enum: ['left', 'right'] },
            revealAt: { type: 'string', description: 'When to reveal: seconds as string' },
            exitAt: { type: 'string' },
          },
          required: ['html', 'revealAt'],
        },
      },
      backdrop: { type: 'string', description: 'CSS background for the scene' },
      avatar_position: { type: 'string', enum: ['left', 'right', 'center'], description: 'Where to place the avatar' },
      avatar_size: { type: 'number', description: 'Percentage of viewport width (default 40)' },
      avatar_config_id: { type: 'string', description: 'Specific avatar config. Omit for project default.' },
    },
    required: ['sceneId', 'narration_script'],
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

// ── Template Tools ────────────────────────────────────────────────────────────

export const PICK_TEMPLATE: ClaudeToolDefinition = {
  name: 'pick_template',
  description: `Show the template picker to the user. Use when creating a new scene and a template would help.
Especially useful for: title cards, diagrams, charts, step lists.
The user picks or skips. Returns the selected template id or null.`,
  input_schema: {
    type: 'object',
    properties: {
      suggestedCategory: {
        type: 'string',
        enum: [
          'title-card',
          'diagram',
          'comparison',
          'data',
          'process',
          'quote',
          'transition',
          'technical',
          'chalkboard',
        ],
        description: 'Pre-filter the template picker to this category',
      },
      reason: { type: 'string', description: 'Why you are suggesting templates' },
    },
    required: [],
  },
}

export const USE_TEMPLATE: ClaudeToolDefinition = {
  name: 'use_template',
  description: `Instantiate a template as a new scene. Fills placeholders based on the user's intent.
Call after pick_template returns a template id.`,
  input_schema: {
    type: 'object',
    properties: {
      templateId: { type: 'string', description: 'Template ID to instantiate' },
      scenePrompt: { type: 'string', description: 'What this scene is about (fills template placeholders)' },
      position: { type: 'number', description: 'Index to insert scene at. Omit to append.' },
    },
    required: ['templateId', 'scenePrompt'],
  },
}

export const SAVE_AS_TEMPLATE: ClaudeToolDefinition = {
  name: 'save_as_template',
  description: 'Save an existing scene as a reusable template.',
  input_schema: {
    type: 'object',
    properties: {
      sceneId: { type: 'string', description: 'Scene ID to save as template' },
      name: { type: 'string', description: 'Template name' },
      description: { type: 'string', description: 'What this template is for' },
      category: {
        type: 'string',
        enum: [
          'title-card',
          'diagram',
          'comparison',
          'data',
          'process',
          'quote',
          'transition',
          'technical',
          'chalkboard',
          'custom',
        ],
        description: 'Template category',
      },
      tags: { type: 'array', items: { type: 'string' }, description: 'Search tags' },
      isPublic: { type: 'boolean', description: 'Share publicly' },
      placeholders: { type: 'array', items: { type: 'string' }, description: 'Variable names to extract from content' },
    },
    required: ['sceneId', 'name', 'category'],
  },
}

// ── Layer Parenting Tools ─────────────────────────────────────────────────────

export const SET_LAYER_PARENT: ClaudeToolDefinition = {
  name: 'set_layer_parent',
  description: `Set a layer's parent for timing inheritance.
Child layer startAt becomes relative to parent's startAt.
Use to group layers that should animate together as a unit.`,
  input_schema: {
    type: 'object',
    properties: {
      sceneId: { type: 'string', description: 'Scene ID' },
      layerId: { type: 'string', description: 'The child layer ID' },
      parentLayerId: { type: 'string', description: 'Parent layer ID, or "null" to make root layer' },
    },
    required: ['sceneId', 'layerId', 'parentLayerId'],
  },
}

export const CREATE_GROUP_LAYER: ClaudeToolDefinition = {
  name: 'create_group_layer',
  description: `Create an invisible group layer as a timing parent.
Then use set_layer_parent to assign children to it.
Useful for: grouping elements that animate together, delaying a set of layers as a unit.`,
  input_schema: {
    type: 'object',
    properties: {
      sceneId: { type: 'string', description: 'Scene ID' },
      label: { type: 'string', description: 'Group name, e.g. "Intro Phase"' },
      startAt: { type: 'number', description: 'When the group begins (seconds)' },
    },
    required: ['sceneId', 'label', 'startAt'],
  },
}

// ── Tool Collections ──────────────────────────────────────────────────────────

/** All scene-level tools */
export const SET_CAMERA_MOTION: ClaudeToolDefinition = {
  name: 'set_camera_motion',
  description: `Add camera motion to a scene. Camera motion makes scenes feel cinematic and professional.

Available moves:
- kenBurns: Slow pan+zoom on static content. Use on image backgrounds or scenes with little movement.
- dollyIn: Push toward an element when it appears. Use on key stats, headlines, reveals.
- dollyOut: Pull back to show context. Use at start of scenes that build up to something.
- pan: Lateral camera movement. Use to follow action or create a sense of space.
- rackFocus: Blur transition between subjects. Use at major topic shifts within a scene.
- cut: Instant recomposition. Use for hard cuts to a new angle within a scene.
- shake: Impact shake. Use on dramatic reveals or surprising statistics.
- orbit: 3D scenes only. Rotate camera around a subject.
- dolly3D: 3D scenes only. Push camera along its view axis.
- rackFocus3D: 3D scenes only. Animate focal length (FOV) for cinematic compression.

Presets (recommended for most cases):
- presetReveal: Default for any scene — gentle Ken Burns throughout
- presetEmphasis: Dolly in on a specific element, then reset
- presetCinematicPush: Slow broadcast-style push, good for avatar scenes
- presetRackTransition: Rack focus blur at a scene transition point

Use camera motion sparingly. Not every scene needs it. Avoid combining more than 2-3 moves per scene.`,
  input_schema: {
    type: 'object',
    properties: {
      sceneId: { type: 'string', description: 'Scene ID' },
      moves: {
        type: 'array',
        description: 'List of camera moves to apply in order',
        items: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: [
                'kenBurns',
                'dollyIn',
                'dollyOut',
                'pan',
                'rackFocus',
                'cut',
                'shake',
                'reset',
                'orbit',
                'dolly3D',
                'rackFocus3D',
                'presetReveal',
                'presetEmphasis',
                'presetCinematicPush',
                'presetRackTransition',
              ],
            },
            params: {
              type: 'object',
              description:
                'Parameters for this move (duration, at, targetSelector, toScale, fromScale, endX, endY, ease, etc.)',
            },
          },
          required: ['type'],
        },
      },
    },
    required: ['sceneId', 'moves'],
  },
}

export const SCENE_TOOLS: ClaudeToolDefinition[] = [
  CREATE_SCENE,
  DELETE_SCENE,
  DUPLICATE_SCENE,
  REORDER_SCENES,
  SET_SCENE_DURATION,
  SET_SCENE_BACKGROUND,
  SET_TRANSITION,
  SET_CAMERA_MOTION,
]

/** All layer tools */
export const LAYER_TOOLS: ClaudeToolDefinition[] = [
  ADD_LAYER,
  APPLY_CANVAS_MOTION_TEMPLATE,
  THREE_DATA_SCATTER_SCENE,
  CREATE_ZDOG_COMPOSED_SCENE,
  SAVE_ZDOG_PERSON_ASSET,
  LIST_ZDOG_PERSON_ASSETS,
  BUILD_ZDOG_ASSET,
  GENERATE_CHART,
  UPDATE_CHART,
  REMOVE_CHART,
  REORDER_CHARTS,
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

/** Audio tools */
export const ADD_NARRATION: ClaudeToolDefinition = {
  name: 'add_narration',
  description:
    'Generate text-to-speech narration for a scene. The TTS provider is automatically selected based on configured API keys. Audio replaces any existing narration.',
  input_schema: {
    type: 'object',
    properties: {
      sceneId: { type: 'string', description: 'Scene ID to add narration to' },
      text: { type: 'string', description: 'Narration text to speak. Keep to ~150 words/minute pace.' },
      voiceId: { type: 'string', description: 'Voice ID (optional, uses project default)' },
      provider: {
        type: 'string',
        enum: ['auto', 'elevenlabs', 'openai-tts', 'gemini-tts', 'google-tts', 'openai-edge-tts'],
        description: 'TTS provider (optional, default: auto)',
      },
      instructions: {
        type: 'string',
        description: 'Style instructions for OpenAI gpt-4o-mini-tts or Gemini (e.g. "Speak cheerfully and slowly")',
      },
    },
    required: ['sceneId', 'text'],
  },
}

export const ADD_SOUND_EFFECT: ClaudeToolDefinition = {
  name: 'add_sound_effect',
  description:
    'Add a sound effect to a scene at a specific timestamp. Can search free libraries (Freesound, Pixabay) or generate with ElevenLabs AI.',
  input_schema: {
    type: 'object',
    properties: {
      sceneId: { type: 'string', description: 'Scene ID' },
      query: { type: 'string', description: 'Search query or generation prompt for the sound effect' },
      triggerAt: { type: 'number', description: 'Seconds into scene when SFX plays (default: 0)' },
      volume: { type: 'number', description: 'Volume 0-1 (default: 0.8)' },
      provider: {
        type: 'string',
        enum: ['auto', 'freesound', 'pixabay', 'elevenlabs-sfx'],
        description: 'SFX provider (optional)',
      },
    },
    required: ['sceneId', 'query'],
  },
}

export const ADD_BACKGROUND_MUSIC: ClaudeToolDefinition = {
  name: 'add_background_music',
  description:
    'Search and add background music to a scene. Music loops automatically and volume ducks during narration.',
  input_schema: {
    type: 'object',
    properties: {
      sceneId: { type: 'string', description: 'Scene ID' },
      query: { type: 'string', description: 'Music search query, e.g. "upbeat corporate", "calm piano"' },
      volume: { type: 'number', description: 'Volume 0-1 (default: 0.12)' },
      loop: { type: 'boolean', description: 'Loop music (default: true)' },
      duckDuringTTS: { type: 'boolean', description: 'Reduce volume during narration (default: true)' },
      provider: {
        type: 'string',
        enum: ['auto', 'pixabay-music', 'freesound-music'],
        description: 'Music provider (optional)',
      },
    },
    required: ['sceneId', 'query'],
  },
}

export const AUDIO_TOOLS: ClaudeToolDefinition[] = [
  ADD_NARRATION,
  ADD_SOUND_EFFECT,
  ADD_BACKGROUND_MUSIC,
  GENERATE_AVATAR_NARRATION,
  GENERATE_AVATAR_SCENE,
]

/** Project media library tools */
export const USE_ASSET_IN_SCENE: ClaudeToolDefinition = {
  name: 'use_asset_in_scene',
  description:
    'Reference an uploaded project asset in a scene. Use when the user mentions their logo, uploaded image, video clip, or any named asset. Returns the asset URL and metadata needed to embed it in scene HTML.',
  input_schema: {
    type: 'object',
    properties: {
      assetId: { type: 'string', description: 'ID of the asset from the project media library' },
      usage: {
        type: 'string',
        enum: ['fullscreen', 'overlay', 'watermark', 'background', 'inline'],
        description: 'How the asset will be used in the scene',
      },
      position: {
        type: 'object',
        description: 'For overlay/watermark usage. x/y as percentage of scene dimensions.',
        properties: {
          x: { type: 'number' },
          y: { type: 'number' },
          width: { type: 'number', description: 'Percentage of scene width' },
          anchor: { type: 'string', enum: ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center'] },
        },
      },
    },
    required: ['assetId', 'usage'],
  },
}

export const ADD_WATERMARK: ClaudeToolDefinition = {
  name: 'add_watermark',
  description:
    'Add a persistent logo or watermark overlay to all scenes in the project, or to specified scenes only. The watermark is injected automatically into scene HTML during render.',
  input_schema: {
    type: 'object',
    properties: {
      assetId: { type: 'string', description: 'ID of an image/SVG asset from the media library' },
      position: {
        type: 'string',
        enum: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
        description: 'Corner position (default: bottom-right)',
      },
      opacity: { type: 'number', description: 'Opacity 0-1 (default: 0.8)' },
      sizePercent: { type: 'number', description: 'Width as % of scene width (default: 12)' },
    },
    required: ['assetId'],
  },
}

export const MEDIA_LIBRARY_TOOLS: ClaudeToolDefinition[] = [USE_ASSET_IN_SCENE, ADD_WATERMARK]

/** Asset / media tools */
export const ASSET_TOOLS: ClaudeToolDefinition[] = [
  SEARCH_IMAGES,
  PLACE_IMAGE,
  SET_AUDIO_LAYER,
  SET_VIDEO_LAYER,
  REQUEST_SCREEN_RECORDING,
  ...MEDIA_LIBRARY_TOOLS,
]

/** Global style tools */
export const GLOBAL_TOOLS: ClaudeToolDefinition[] = [
  SET_GLOBAL_STYLE,
  SET_SCENE_STYLE,
  SET_ALL_TRANSITIONS,
  SET_ROUGHNESS_ALL,
  PLAN_SCENES,
]

/** Template tools */
export const TEMPLATE_TOOLS: ClaudeToolDefinition[] = [PICK_TEMPLATE, USE_TEMPLATE, SAVE_AS_TEMPLATE]

/** Layer parenting tools */
export const PARENTING_TOOLS: ClaudeToolDefinition[] = [SET_LAYER_PARENT, CREATE_GROUP_LAYER]

/** Interaction tools */
export const INTERACTION_TOOLS: ClaudeToolDefinition[] = [
  ADD_INTERACTION,
  ADD_MULTIPLE_INTERACTIONS,
  EDIT_INTERACTION,
  CONNECT_SCENES,
]

/** 3D model library tools */
export const SEARCH_3D_MODELS: ClaudeToolDefinition = {
  name: 'search_3d_models',
  description: `Search the curated 3D model library for CC0 GLB models suitable for Three.js scenes.
Returns matching models with their file paths, descriptions, and tags.
Use this when building Three.js scenes that need real objects (laptop, rocket, person, building, etc.)
instead of basic procedural geometry.`,
  input_schema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description:
          'Search query — matches against model name, tags, and description. Examples: "laptop", "security", "growth", "office"',
      },
      category: {
        type: 'string',
        enum: ['tech', 'business', 'abstract', 'people', 'transport', 'environment', 'data'],
        description: 'Optional: filter by category',
      },
    },
    required: ['query'],
  },
}

export const GET_3D_MODEL_URL: ClaudeToolDefinition = {
  name: 'get_3d_model_url',
  description: `Get the full URL for a 3D model from the library, ready to use with GLTFLoader in a Three.js scene.
Returns the URL and a code snippet showing how to load and place the model.`,
  input_schema: {
    type: 'object',
    properties: {
      modelId: {
        type: 'string',
        description: 'Model ID from search_3d_models results (e.g. "laptop", "rocket", "person-standing")',
      },
    },
    required: ['modelId'],
  },
}

export const MODEL_LIBRARY_TOOLS: ClaudeToolDefinition[] = [SEARCH_3D_MODELS, GET_3D_MODEL_URL]

/** Lottie animation search */
export const SEARCH_LOTTIE: ClaudeToolDefinition = {
  name: 'search_lottie',
  description: `Search for a pre-made Lottie animation from LottieFiles to embed in a scene.

Use when a scene needs a polished illustration or icon animation — a checkmark, rocket, loading
spinner, chart, person, lock, data flow, celebration, etc. These are professional animations
that would take hours to create manually.

Returns animation URLs ready for CenchMotion.lottieSync(). Pick the most visually relevant
result based on name and tags.

Do NOT use for text animations, element reveals, counting numbers, or bar charts —
use CenchMotion components for those instead.`,
  input_schema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description:
          'Specific search terms. Examples: "checkmark success green", "rocket launch purple", "bar chart growth blue", "lock security shield", "confetti celebration"',
      },
      limit: { type: 'number', description: 'Max results to return (default: 5)' },
    },
    required: ['query'],
  },
}

/** Export tools */
export const CAPTURE_FRAME: ClaudeToolDefinition = {
  name: 'capture_frame',
  description: `Capture a screenshot of a scene at a specific time. Returns a base64 JPEG image so you can see what the scene looks like at that moment.
Use this to verify your work — check layout, colors, timing, text placement, and animation state after generating or editing a scene.
The capture is taken from the live preview iframe, so the scene must exist and have content.`,
  input_schema: {
    type: 'object',
    properties: {
      sceneId: { type: 'string', description: 'Scene ID to capture' },
      time: { type: 'number', description: 'Time in seconds to capture at (0 = start). Defaults to 1 second in.' },
    },
    required: ['sceneId'],
  },
}

export const VERIFY_SCENE: ClaudeToolDefinition = {
  name: 'verify_scene',
  description: `Verify a scene after generating or editing it. Captures the scene state and returns a structured assessment.
MANDATORY: Call this after every add_layer, regenerate_layer, or generate_chart to check your work.
Returns a checklist of: layout quality, text readability, palette adherence, animation presence, and layer completeness.
If issues are found, fix them with patch_layer_code or regenerate_layer before moving to the next scene.`,
  input_schema: {
    type: 'object',
    properties: {
      sceneId: { type: 'string', description: 'Scene ID to verify' },
      time: { type: 'number', description: 'Time in seconds to check at (default: 1s — shows initial animated state)' },
      expectedElements: {
        type: 'array',
        items: { type: 'string' },
        description:
          'List of elements you expect to see (e.g. ["title text", "bar chart", "legend"]). Used to check completeness.',
      },
    },
    required: ['sceneId'],
  },
}

// ── Timeline / Clip Tools ─────────────────────────────────────────────────────

export const INIT_TIMELINE: ClaudeToolDefinition = {
  name: 'init_timeline',
  description:
    'Initialize the NLE timeline from the current scenes. Creates a single video track with one clip per scene. Call this before using clip/track tools. Idempotent — does nothing if timeline already exists.',
  input_schema: { type: 'object', properties: {} },
}

export const ADD_TRACK: ClaudeToolDefinition = {
  name: 'add_track',
  description: 'Add a new track to the timeline. Returns the track ID.',
  input_schema: {
    type: 'object',
    properties: {
      type: { type: 'string', enum: ['video', 'audio', 'overlay'], description: 'Track type' },
      name: { type: 'string', description: 'Track name (e.g. "B-Roll", "Narration")' },
    },
    required: ['type'],
  },
}

export const PLACE_CLIP: ClaudeToolDefinition = {
  name: 'place_clip',
  description: `Place a clip on a track at a specific time. Sources can be:
- "scene" + sceneId: a generated scene
- "video" + file path: real footage
- "image" + URL: a still image
- "audio" + URL: an audio file
- "title" + text: a text card
Returns the clip ID.`,
  input_schema: {
    type: 'object',
    properties: {
      trackId: { type: 'string', description: 'Track to place the clip on' },
      sourceType: {
        type: 'string',
        enum: ['scene', 'video', 'image', 'audio', 'title'],
        description: 'What kind of source',
      },
      sourceId: { type: 'string', description: 'Scene ID, file path, URL, or text content' },
      label: { type: 'string', description: 'Display name for the clip' },
      startTime: { type: 'number', description: 'Position on timeline in seconds' },
      duration: { type: 'number', description: 'Clip duration in seconds' },
      trimStart: { type: 'number', description: 'Source in-point (seconds). Default 0.' },
      trimEnd: { type: 'number', description: 'Source out-point (seconds). Omit for full duration.' },
      opacity: { type: 'number', description: 'Clip opacity 0–1. Default 1.' },
    },
    required: ['trackId', 'sourceType', 'sourceId', 'startTime', 'duration'],
  },
}

export const MOVE_CLIP: ClaudeToolDefinition = {
  name: 'move_clip',
  description: 'Move a clip to a different track and/or time position.',
  input_schema: {
    type: 'object',
    properties: {
      clipId: { type: 'string', description: 'Clip to move' },
      toTrackId: { type: 'string', description: 'Destination track ID' },
      startTime: { type: 'number', description: 'New start time on timeline (seconds)' },
    },
    required: ['clipId', 'toTrackId', 'startTime'],
  },
}

export const TRIM_CLIP: ClaudeToolDefinition = {
  name: 'trim_clip',
  description: 'Set the in/out points and duration of a clip.',
  input_schema: {
    type: 'object',
    properties: {
      clipId: { type: 'string', description: 'Clip to trim' },
      trimStart: { type: 'number', description: 'Source in-point (seconds)' },
      trimEnd: { type: 'number', description: 'Source out-point (seconds). Null for end.' },
      duration: { type: 'number', description: 'New playback duration (seconds)' },
    },
    required: ['clipId'],
  },
}

export const SPLIT_CLIP: ClaudeToolDefinition = {
  name: 'split_clip',
  description: 'Split a clip into two at a given time. Returns IDs of the left and right halves.',
  input_schema: {
    type: 'object',
    properties: {
      clipId: { type: 'string', description: 'Clip to split' },
      atTime: { type: 'number', description: 'Time relative to clip start (seconds) where to split' },
    },
    required: ['clipId', 'atTime'],
  },
}

export const REMOVE_CLIP: ClaudeToolDefinition = {
  name: 'remove_clip',
  description: 'Remove a clip from the timeline.',
  input_schema: {
    type: 'object',
    properties: {
      clipId: { type: 'string', description: 'Clip to remove' },
    },
    required: ['clipId'],
  },
}

export const SET_CLIP_SPEED: ClaudeToolDefinition = {
  name: 'set_clip_speed',
  description: 'Set the playback speed of a clip (e.g. 0.5 for slow-mo, 2 for fast). Duration adjusts automatically.',
  input_schema: {
    type: 'object',
    properties: {
      clipId: { type: 'string', description: 'Clip to modify' },
      speed: { type: 'number', description: 'Playback rate (0.25–4)' },
    },
    required: ['clipId', 'speed'],
  },
}

export const SET_KEYFRAME: ClaudeToolDefinition = {
  name: 'set_keyframe',
  description: `Set a keyframe on a clip property at a specific time. The compositor interpolates between keyframes for smooth animation.
Properties: x, y, scaleX, scaleY, opacity, rotation, speed.
Speed keyframes create speed ramps (slow-mo transitions).`,
  input_schema: {
    type: 'object',
    properties: {
      clipId: { type: 'string', description: 'Clip to keyframe' },
      property: {
        type: 'string',
        enum: ['x', 'y', 'scaleX', 'scaleY', 'opacity', 'rotation', 'speed'],
        description: 'Property to animate',
      },
      time: { type: 'number', description: 'Time relative to clip start (seconds)' },
      value: { type: 'number', description: 'Value at this keyframe' },
      easing: {
        type: 'string',
        enum: ['linear', 'ease-in', 'ease-out', 'ease-in-out'],
        description: 'Easing curve to this keyframe. Default: linear.',
      },
    },
    required: ['clipId', 'property', 'time', 'value'],
  },
}

export const REMOVE_KEYFRAME: ClaudeToolDefinition = {
  name: 'remove_keyframe',
  description: 'Remove a keyframe from a clip. Matches by property + time.',
  input_schema: {
    type: 'object',
    properties: {
      clipId: { type: 'string', description: 'Clip ID' },
      property: { type: 'string', description: 'Property name' },
      time: { type: 'number', description: 'Keyframe time to remove (seconds relative to clip start)' },
    },
    required: ['clipId', 'property', 'time'],
  },
}

export const SLIP_EDIT: ClaudeToolDefinition = {
  name: 'slip_edit',
  description:
    'Shift the source media window without moving the clip on the timeline. Adjusts trimStart and trimEnd by the given offset while keeping duration and position unchanged.',
  input_schema: {
    type: 'object',
    properties: {
      clipId: { type: 'string', description: 'Clip to slip' },
      offsetSeconds: {
        type: 'number',
        description: 'Seconds to shift the source window (positive = later in source, negative = earlier)',
      },
    },
    required: ['clipId', 'offsetSeconds'],
  },
}

export const SET_CLIP_FILTER: ClaudeToolDefinition = {
  name: 'set_clip_filter',
  description: `Add or update a visual filter on a clip. Multiple filters can be stacked.
Use value ranges: blur (0-20 px), brightness (0-3, 1=normal), contrast (0-3, 1=normal),
saturate (0-3, 1=normal), grayscale (0-1), sepia (0-1), hue-rotate (0-360 degrees).`,
  input_schema: {
    type: 'object',
    properties: {
      clipId: { type: 'string', description: 'Clip to filter' },
      filterType: {
        type: 'string',
        enum: ['blur', 'brightness', 'contrast', 'saturate', 'grayscale', 'sepia', 'hue-rotate'],
        description: 'Filter type',
      },
      value: { type: 'number', description: 'Filter value (see ranges in description)' },
    },
    required: ['clipId', 'filterType', 'value'],
  },
}

export const REMOVE_CLIP_FILTER: ClaudeToolDefinition = {
  name: 'remove_clip_filter',
  description: 'Remove a filter from a clip by type. Removes all filters of that type.',
  input_schema: {
    type: 'object',
    properties: {
      clipId: { type: 'string', description: 'Clip ID' },
      filterType: {
        type: 'string',
        enum: ['blur', 'brightness', 'contrast', 'saturate', 'grayscale', 'sepia', 'hue-rotate'],
        description: 'Filter type to remove',
      },
    },
    required: ['clipId', 'filterType'],
  },
}

export const SET_CLIP_BLEND_MODE: ClaudeToolDefinition = {
  name: 'set_clip_blend_mode',
  description: `Set the blend mode for a clip. Controls how the clip composites with layers below it.
Common modes: normal (default), multiply (darken), screen (lighten), overlay (contrast),
add (glow/light effects), difference (invert), soft-light (gentle contrast).`,
  input_schema: {
    type: 'object',
    properties: {
      clipId: { type: 'string', description: 'Clip ID' },
      blendMode: {
        type: 'string',
        enum: [
          'normal',
          'multiply',
          'screen',
          'overlay',
          'darken',
          'lighten',
          'color-dodge',
          'color-burn',
          'hard-light',
          'soft-light',
          'difference',
          'exclusion',
          'add',
          'subtract',
          'luminosity',
          'saturation',
        ],
        description: 'Blend mode',
      },
    },
    required: ['clipId', 'blendMode'],
  },
}

export const TIMELINE_TOOLS: ClaudeToolDefinition[] = [
  INIT_TIMELINE,
  ADD_TRACK,
  PLACE_CLIP,
  MOVE_CLIP,
  TRIM_CLIP,
  SPLIT_CLIP,
  REMOVE_CLIP,
  SET_CLIP_SPEED,
  SET_KEYFRAME,
  REMOVE_KEYFRAME,
  SLIP_EDIT,
  SET_CLIP_FILTER,
  REMOVE_CLIP_FILTER,
  SET_CLIP_BLEND_MODE,
]

export const EXPORT_TOOLS: ClaudeToolDefinition[] = [EXPORT_MP4, PUBLISH_INTERACTIVE]

// ── Physics Tools ──────────────────────────────────────────────────────────

export const GENERATE_PHYSICS_SCENE: ClaudeToolDefinition = {
  name: 'generate_physics_scene',
  description: `Generate a scene with a live physics simulation. Use for any scene that explains a physics concept — mechanics, waves, electromagnetism, thermodynamics, quantum.

The simulation runs in real-time in the scene HTML and is seekable by WVC for video capture.
Equations are rendered with MathJax. Available simulations: pendulum, double_pendulum, projectile, orbital, wave_interference, double_slit, electric_field, harmonic_oscillator.`,
  input_schema: {
    type: 'object',
    properties: {
      sceneId: { type: 'string', description: 'Scene ID to add the physics simulation to' },
      simulation: {
        type: 'string',
        enum: [
          'pendulum',
          'double_pendulum',
          'projectile',
          'orbital',
          'wave_interference',
          'double_slit',
          'electric_field',
          'harmonic_oscillator',
        ],
        description: 'Which simulation to use',
      },
      params: {
        type: 'object',
        description:
          'Simulation parameters. ANGLES may be radians OR degrees (the runtime normalizes). Pendulum: {g, length, angle, damping}. DoublePendulum: {g, L1, L2, m1, m2, theta1, theta2}. Projectile: {v0, angle, g, drag} (angle 20-70 degrees usually best). Orbital: {G, m1, m2, eccentricity, semiMajorAxis}. WaveInterference: {frequency, wavelength, source_separation, phase_diff}. DoubleSlit: {wavelength, slit_separation, slit_width, screen_distance}. ElectricField: {charges: [{x, y, q}]}. HarmonicOscillator: {mass, k, damping, driving_frequency, driving_amplitude, x0, v0} where x0/v0 can be sim-units (~0-5) or pixel-like (~60-300).',
      },
      layout: {
        type: 'string',
        enum: ['split', 'fullscreen', 'equation_focus'],
        description:
          'split = sim left + text right. fullscreen = sim fills canvas. equation_focus = big equation + sim background.',
      },
      equations: {
        type: 'array',
        items: { type: 'string' },
        description:
          "Equation keys from PhysicsEquations database (e.g. 'pendulum_ode', 'projectile_range'). Looked up automatically — no raw LaTeX needed.",
      },
      narration_text: {
        type: 'string',
        description: 'Text to display in the scene alongside the simulation',
      },
      highlight_moment: {
        type: 'object',
        description:
          "Optional: highlight a specific physics moment. E.g. { time: 2.3, label: 'maximum kinetic energy', annotation: 'At lowest point, all PE converts to KE' }",
      },
      title: { type: 'string', description: 'Scene title text' },
    },
    required: ['sceneId', 'simulation', 'layout'],
  },
}

export const EXPLAIN_PHYSICS_CONCEPT: ClaudeToolDefinition = {
  name: 'explain_physics_concept',
  description: `Plan a multi-scene physics explainer video. Given a concept, generates a structured scene plan with the right simulations, equations, and narrative arc.

Use this FIRST when the user asks to explain a physics topic. It returns a scene plan, then call generate_physics_scene for each scene.`,
  input_schema: {
    type: 'object',
    properties: {
      concept: { type: 'string', description: 'The physics concept to explain' },
      audience: {
        type: 'string',
        enum: ['middle_school', 'high_school', 'undergraduate', 'graduate', 'general_public'],
        description: 'Target audience — determines equation complexity and vocabulary',
      },
      duration_minutes: { type: 'number', description: 'Target video length in minutes (default: 3)' },
      emphasis: {
        type: 'string',
        enum: ['intuition', 'mathematical', 'historical', 'applications'],
        description: 'What angle to take (default: intuition)',
      },
    },
    required: ['concept', 'audience'],
  },
}

export const ANNOTATE_SIMULATION: ClaudeToolDefinition = {
  name: 'annotate_simulation',
  description: `Add annotations to a physics simulation scene — arrows, labels, callout boxes that appear at specific simulation times.

Use to highlight key physics moments: maximum velocity, energy transfer points, interference maxima, Lagrange points, etc. Max 3 annotations per scene.`,
  input_schema: {
    type: 'object',
    properties: {
      sceneId: { type: 'string', description: 'Scene ID' },
      annotations: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            sim_time: { type: 'number', description: 'Simulation time when annotation appears (seconds)' },
            type: {
              type: 'string',
              enum: ['arrow', 'label', 'callout', 'highlight_region', 'equation_popup'],
              description: 'Annotation visual type',
            },
            text: { type: 'string', description: 'Annotation text' },
            x: { type: 'number', description: 'X position (0-1920)' },
            y: { type: 'number', description: 'Y position (0-1080)' },
            equation: { type: 'string', description: 'Equation key from PhysicsEquations (for equation_popup type)' },
            duration: { type: 'number', description: 'How long annotation stays visible (seconds, default: 3)' },
          },
        },
        description: 'Array of annotations to add',
      },
    },
    required: ['sceneId', 'annotations'],
  },
}

export const SET_SIMULATION_PARAMS: ClaudeToolDefinition = {
  name: 'set_simulation_params',
  description: `Change simulation parameters mid-scene to demonstrate how physics changes.
E.g. increase gravity to show faster pendulum, change eccentricity to show different orbits.
The parameter change animates smoothly over the transition duration.`,
  input_schema: {
    type: 'object',
    properties: {
      sceneId: { type: 'string', description: 'Scene ID' },
      changes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            at_time: { type: 'number', description: 'When to change the parameter (seconds into scene)' },
            param: { type: 'string', description: 'Parameter name (e.g. "g", "eccentricity", "damping")' },
            from: { type: 'number', description: 'Start value' },
            to: { type: 'number', description: 'End value' },
            transition_duration: { type: 'number', description: 'Seconds to smoothly interpolate (default: 1)' },
          },
        },
        description: 'Array of parameter changes to schedule',
      },
    },
    required: ['sceneId', 'changes'],
  },
}

export const PHYSICS_TOOLS: ClaudeToolDefinition[] = [
  GENERATE_PHYSICS_SCENE,
  EXPLAIN_PHYSICS_CONCEPT,
  ANNOTATE_SIMULATION,
  SET_SIMULATION_PARAMS,
]

// ── 3D World Tools ────────────────────────────────────────────────────────

export const CREATE_WORLD_SCENE: ClaudeToolDefinition = {
  name: 'create_world_scene',
  description: `Create a 3D world scene. The avatar and all objects exist in a spatial Three.js
3D environment. Use this for visually rich scenes where depth and spatial feel matter —
a presenter standing in a room, objects floating in space, characters in a landscape.

Available environments:
- meadow: Outdoor grass field with sky, trees, and natural lighting. Wind animates the grass.
- studio_room: Indoor room with whiteboard or screen wall. Professional office/classroom feel.
- void_space: Dark floating space with panels hovering in 3D. Abstract, cinematic, futuristic.

Objects from the CC0 asset library can be placed anywhere in the world.
HTML/SVG content renders on floating panels or on the room's whiteboard.
Call list_3d_assets before placing objects to confirm valid asset IDs.`,
  input_schema: {
    type: 'object',
    properties: {
      sceneId: { type: 'string', description: 'Scene ID to turn into a 3D world' },
      environment: {
        type: 'string',
        enum: ['meadow', 'studio_room', 'void_space'],
        description: 'Which 3D environment template to use',
      },
      environment_config: {
        type: 'object',
        description: 'Environment-specific config',
        properties: {
          timeOfDay: { type: 'string', enum: ['morning', 'afternoon', 'sunset', 'night'] },
          windStrength: { type: 'number', description: '0-1, grass sway intensity' },
          grassDensity: { type: 'number', description: 'Number of grass blades (default 50000)' },
          roomStyle: { type: 'string', enum: ['classroom', 'office', 'studio'] },
          spaceLayout: { type: 'string', enum: ['grid', 'arc', 'spiral', 'random'] },
        },
      },
      objects: {
        type: 'array',
        description: '3D objects to place from the asset library',
        items: {
          type: 'object',
          properties: {
            assetId: { type: 'string', description: 'Asset ID from library. Call list_3d_assets first.' },
            position: { type: 'array', items: { type: 'number' }, description: '[x,y,z] in meters. y=0 is ground.' },
            rotation: { type: 'array', items: { type: 'number' }, description: '[rx,ry,rz] in radians' },
            scale: { type: 'number', description: 'Uniform scale. 1 = natural size.' },
            animations: { type: 'array', items: { type: 'string' }, description: 'Animation clip names to play' },
            gsap_animation: {
              type: 'object',
              description: 'GSAP animation for this object',
              properties: {
                property: { type: 'string', description: "e.g. 'position.y', 'rotation.y'" },
                from: { type: 'number' },
                to: { type: 'number' },
                duration: { type: 'number' },
                at: { type: 'string' },
              },
            },
          },
          required: ['assetId', 'position'],
        },
      },
      panels: {
        type: 'array',
        description: 'HTML content panels floating in the world',
        items: {
          type: 'object',
          properties: {
            html: { type: 'string', description: 'HTML content for this panel' },
            position: { type: 'array', items: { type: 'number' }, description: '[x,y,z]' },
            rotation: { type: 'array', items: { type: 'number' }, description: '[rx,ry,rz]' },
            width: { type: 'number', description: 'Panel width in meters (default 2)' },
            height: { type: 'number', description: 'Panel height in meters (default 1)' },
            animate_in: { type: 'string', description: 'GSAP ease for entrance' },
            animate_at: { type: 'number', description: 'Timeline time to animate in' },
          },
          required: ['html'],
        },
      },
      camera_path: {
        type: 'array',
        description: 'Camera movement keyframes',
        items: {
          type: 'object',
          properties: {
            t: { type: 'number', description: 'Time in seconds' },
            pos: { type: 'array', items: { type: 'number' }, description: '[x,y,z]' },
            lookAt: { type: 'array', items: { type: 'number' }, description: '[x,y,z]' },
          },
          required: ['t', 'pos', 'lookAt'],
        },
      },
      duration: { type: 'number', description: 'Scene duration in seconds' },
    },
    required: ['sceneId', 'environment'],
  },
}

export const LIST_3D_ASSETS: ClaudeToolDefinition = {
  name: 'list_3d_assets',
  description: `Search the local CC0 3D asset library for models to place in world scenes.
All assets are CC0 licensed — free for commercial use, no attribution required.
Returns asset IDs, categories, tags, and descriptions.
Use the returned assetId in create_world_scene's objects array.`,
  input_schema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: "Search term. Examples: 'laptop', 'tree', 'character', 'chair office'",
      },
      category: {
        type: 'string',
        enum: ['tech', 'business', 'abstract', 'people', 'transport', 'environment'],
        description: 'Filter by category',
      },
    },
  },
}

export const WORLD_TOOLS: ClaudeToolDefinition[] = [CREATE_WORLD_SCENE, LIST_3D_ASSETS]

/** All tools combined */
export const ALL_TOOLS: ClaudeToolDefinition[] = [
  ...SCENE_TOOLS,
  ...LAYER_TOOLS,
  ...PARENTING_TOOLS,
  ...AI_LAYER_TOOLS,
  ...ELEMENT_TOOLS,
  ...ASSET_TOOLS,
  ...MODEL_LIBRARY_TOOLS,
  SEARCH_LOTTIE,
  ...AUDIO_TOOLS,
  ...GLOBAL_TOOLS,
  ...TEMPLATE_TOOLS,
  ...INTERACTION_TOOLS,
  ...PHYSICS_TOOLS,
  ...WORLD_TOOLS,
  ...EXPORT_TOOLS,
  ...TIMELINE_TOOLS,
  CAPTURE_FRAME,
  VERIFY_SCENE,
]

/** Deduplicate tools by name */
function dedup(tools: ClaudeToolDefinition[]): ClaudeToolDefinition[] {
  const seen = new Set<string>()
  return tools.filter((t) => {
    if (seen.has(t.name)) return false
    seen.add(t.name)
    return true
  })
}

/** Tools available to each agent type */
export const AGENT_TOOLS: Record<string, ClaudeToolDefinition[]> = {
  planner: [PLAN_SCENES_PLANNER],
  director: dedup([
    ...SCENE_TOOLS,
    ...LAYER_TOOLS,
    ...PARENTING_TOOLS,
    ...AI_LAYER_TOOLS,
    ...ELEMENT_TOOLS,
    ...GLOBAL_TOOLS,
    ...TEMPLATE_TOOLS,
    ...MODEL_LIBRARY_TOOLS,
    SEARCH_LOTTIE,
    ...AUDIO_TOOLS,
    ...PHYSICS_TOOLS,
    ...WORLD_TOOLS,
    STYLE_SCENE,
    CAPTURE_FRAME,
    VERIFY_SCENE,
    ...TIMELINE_TOOLS,
  ]),
  'scene-maker': dedup([
    CREATE_SCENE,
    ...LAYER_TOOLS,
    ...PARENTING_TOOLS,
    ...AI_LAYER_TOOLS,
    ...ELEMENT_TOOLS,
    SET_SCENE_DURATION,
    SET_SCENE_BACKGROUND,
    SET_TRANSITION,
    SET_CAMERA_MOTION,
    SET_SCENE_STYLE,
    STYLE_SCENE,
    ...MODEL_LIBRARY_TOOLS,
    SEARCH_LOTTIE,
    ...AUDIO_TOOLS,
    ...PHYSICS_TOOLS,
    ...WORLD_TOOLS,
    CAPTURE_FRAME,
    VERIFY_SCENE,
    ...TIMELINE_TOOLS,
  ]),
  editor: dedup([
    ...LAYER_TOOLS,
    ...PARENTING_TOOLS,
    ...AI_LAYER_TOOLS,
    ...ELEMENT_TOOLS,
    SET_SCENE_BACKGROUND,
    SET_TRANSITION,
    SET_SCENE_STYLE,
    ...MODEL_LIBRARY_TOOLS,
    CAPTURE_FRAME,
    VERIFY_SCENE,
  ]),
  dop: dedup([...GLOBAL_TOOLS, SET_TRANSITION, STYLE_SCENE, SET_CAMERA_MOTION, CAPTURE_FRAME]),
}

/** Tool filter map: active tool category ID → which tool names it enables */
export const TOOL_CATEGORY_MAP: Record<string, string[]> = {
  svg: ['add_layer'],
  canvas2d: ['add_layer'],
  d3: ['add_layer', 'generate_chart', 'update_chart', 'remove_chart', 'reorder_charts', 'set_camera_motion'],
  three: [
    'add_layer',
    'search_3d_models',
    'get_3d_model_url',
    'create_world_scene',
    'list_3d_assets',
    'three_data_scatter_scene',
  ],
  lottie: ['add_layer', 'search_lottie'],
  zdog: [
    'add_layer',
    'create_zdog_composed_scene',
    'save_zdog_person_asset',
    'list_zdog_person_assets',
    'build_zdog_asset',
  ],
  assets: [
    'search_images',
    'place_image',
    'use_asset_in_scene',
    'add_watermark',
    'update_ai_layer',
    'animate_ai_layer',
    'set_layer_filter',
    'crop_image_layer',
  ],
  audio: ['set_audio_layer', 'add_narration', 'add_sound_effect', 'add_background_music'],
  video: ['set_video_layer'],
  avatars: ['generate_avatar', 'list_avatars', 'generate_avatar_narration', 'generate_avatar_scene'],
  interactions: ['add_interaction', 'add_multiple_interactions', 'edit_interaction', 'connect_scenes'],
  physics: ['generate_physics_scene', 'explain_physics_concept', 'annotate_simulation', 'set_simulation_params'],
}
