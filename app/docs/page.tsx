'use client'

import './docs.css'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useVideoStore } from '@/lib/store'
import {
  ChevronRight,
  Search,
  X,
  BookOpen,
  Layers,
  Type,
  Image,
  Volume2,
  MousePointer2,
  GitBranch,
  Bot,
  Download,
  Shuffle,
  Palette,
  Shield,
  LayoutDashboard,
  Globe,
  Server,
  Sun,
  Moon,
} from 'lucide-react'

/* ───────────────────────── types & config ───────────────────────── */

type Status = 'live' | 'dev' | 'future'

interface Feature {
  name: string
  status: Status
  description: string
  details?: string[]
}

interface Section {
  title: string
  description: string
  features: Feature[]
}

const STATUS_CONFIG: Record<Status, { label: string; color: string; bg: string; dot: string }> = {
  live:   { label: 'Live',           color: '#4ade80', bg: 'rgba(34, 197, 94, 0.15)', dot: '#4ade80' },
  dev:    { label: 'In Development', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', dot: '#ef4444' },
  future: { label: 'Planned',        color: '#fbbf24', bg: 'rgba(245, 158, 11, 0.15)', dot: '#fbbf24' },
}

const SECTION_ICONS: Record<string, typeof BookOpen> = {
  'Scene Management': Layers,
  'Layer System': Layers,
  'Text Overlays': Type,
  'AI Media Layers': Image,
  'Audio': Volume2,
  'Interactive Elements': MousePointer2,
  'Scene Graph & Branching': GitBranch,
  'AI Agent System': Bot,
  'Export & Publishing': Download,
  'Transitions': Shuffle,

  'API Permission System': Shield,
  'Editor UI': LayoutDashboard,
  'Hosted Player': Globe,
  'Infrastructure & Architecture': Server,
  'API Endpoints': Server,
}

/* ───────────────────────── overview component ───────────────────────── */

function OverviewSection() {
  return (
    <div className="docs-overview">
      {/* What is Cench Studio */}
      <div className="docs-overview-intro">
        <h2 className="docs-overview-title">What is Cench Studio?</h2>
        <p className="docs-overview-lead">
          Cench Studio is an AI-native video and interactive content editor. Describe what you want in natural language and a multi-agent orchestration system writes animation code, generates images, renders 3D scenes, synthesizes voiceover, and assembles everything into a polished project — exported as an MP4 video or published as a live interactive web experience with branching narratives, quizzes, and viewer-driven navigation.
        </p>
      </div>

      {/* Two output modes */}
      <div className="docs-overview-grid docs-overview-grid-2">
        <div className="docs-overview-card">
          <div className="docs-overview-card-icon" style={{ background: 'rgba(99, 102, 241, 0.12)', color: '#818cf8' }}>
            <Download size={20} />
          </div>
          <h3>Video Export (MP4)</h3>
          <p>Render your project as a traditional video file at 1080p / 30fps. Scenes play sequentially with configurable transitions (crossfade, wipe, cut). A headless Node.js render server captures each scene via a browser engine and FFmpeg stitches them into a final MP4. Ideal for social media, presentations, and marketing content.</p>
        </div>
        <div className="docs-overview-card">
          <div className="docs-overview-card-icon" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#34d399' }}>
            <Globe size={20} />
          </div>
          <h3>Interactive Publishing</h3>
          <p>Publish as a hosted web experience where viewers click hotspots, answer quizzes, fill out forms, and navigate branching scene graphs. Supports password protection, custom branding, analytics tracking, and embeddable iframes. The scene graph editor lets you wire any scene to any other with conditional logic.</p>
        </div>
      </div>

      {/* How the editor works */}
      <div className="docs-overview-section">
        <h2 className="docs-overview-title">How It Works</h2>
        <p className="docs-overview-body">
          The editor is built on <strong>React 18</strong> and <strong>Next.js</strong> with <strong>Zustand</strong> state management and a <strong>PostgreSQL</strong> database (via Drizzle ORM) for persistence. The UI is a three-panel layout: a scene list sidebar on the left, a real-time preview canvas in the center with timeline scrubbing, zoom, and pan controls, and a settings / AI chat panel on the right.
        </p>
        <p className="docs-overview-body">
          Each project is a collection of <strong>scenes</strong>, and each scene contains stackable <strong>layers</strong> — the core rendering primitive. Layers are rendered inside isolated iframe sandboxes for security and deterministic playback, with each iframe loading the appropriate open-source libraries from CDN for its layer type.
        </p>
        <p className="docs-overview-body">
          Content auto-saves to the database every 30 seconds. When you're ready to ship, the render server (a Node.js subprocess using <strong>WebVideoCreator</strong>) captures each scene at 1920x1080 and <strong>FFmpeg</strong> stitches the clips with transitions into a final MP4. For interactive output, the project is published as a JSON manifest with an embedded player that handles scene-graph navigation, variable interpolation, and analytics.
        </p>
      </div>

      {/* Open-source rendering stack */}
      <div className="docs-overview-section">
        <h2 className="docs-overview-title">Rendering Stack &amp; Open-Source Libraries</h2>
        <p className="docs-overview-body" style={{ marginBottom: 16 }}>
          Each layer type loads battle-tested open-source libraries into its sandboxed iframe. The AI agents write code that targets these libraries directly, giving you full programmatic control over every animation, chart, and 3D object:
        </p>

        <div className="docs-overview-grid docs-overview-grid-2">
          <div className="docs-overview-card">
            <h3>SVG + SMIL</h3>
            <p>Native browser SVG rendering at a fixed <code>viewBox</code> of 1920x1080. Animations use CSS keyframes and SMIL elements (<code>&lt;animate&gt;</code>, <code>&lt;animateTransform&gt;</code>) for transforms, opacity fades, path morphing, and stroke drawing. No external library needed — the browser is the renderer.</p>
          </div>
          <div className="docs-overview-card">
            <h3>Canvas 2D</h3>
            <p>The HTML Canvas 2D API for procedural pixel-level rendering. AI-generated code uses <code>requestAnimationFrame</code> loops at 60fps for particle systems, physics simulations, generative art, waveform visualizers, and custom data visualizations. Deterministic output is guaranteed via a seeded PRNG (mulberry32) instead of <code>Math.random()</code>.</p>
          </div>
          <div className="docs-overview-card">
            <h3>D3.js (v7)</h3>
            <p>The full <strong>D3.js v7</strong> data visualization library loaded from CDN. Used for bar charts, line graphs, scatter plots, pie charts, treemaps, network graphs, geographic maps, and animated data transitions. Supports custom datasets passed via the scene's <code>d3Data</code> field, SVG-based rendering with <code>d3.transition()</code> for smooth interpolation.</p>
          </div>
          <div className="docs-overview-card">
            <h3>Three.js (r128)</h3>
            <p><strong>Three.js r128</strong> loaded as a global from CDN for WebGL-based 3D rendering. Supports geometries, PBR materials, textures, point lights, spotlights, ambient/hemisphere lighting, post-processing shaders, and <code>requestAnimationFrame</code> animation loops. Used for product showcases, abstract 3D environments, architectural walkthroughs, and data sculptures.</p>
          </div>
          <div className="docs-overview-card">
            <h3>Motion + Anime.js</h3>
            <p><strong>Motion v11</strong> (loaded as an ES module) and <strong>Anime.js v3.2.2</strong> power choreographed multi-element animations. CSS keyframes, the Web Animations API, stagger functions, and timeline sequencing enable kinetic typography, UI motion design, infographic reveals, and complex coordinated entrances/exits across dozens of DOM elements.</p>
          </div>
          <div className="docs-overview-card">
            <h3>Lottie (bodymovin 5.12)</h3>
            <p>The <strong>lottie-web</strong> player (bodymovin v5.12.2) renders Lottie JSON animations — infinitely scalable vector animations exported from After Effects or generated by AI. Lightweight, resolution-independent, and ideal for icons, loaders, logo reveals, and illustrated motion graphics. Sourced from URL or inline JSON.</p>
          </div>
        </div>

        <p className="docs-overview-body" style={{ marginTop: 16 }}>
          Additional libraries available in the rendering pipeline include <strong>@dnd-kit</strong> for drag-and-drop scene reordering, <strong>@xyflow/react</strong> (React Flow) for the visual scene graph editor, and <strong>html2canvas</strong> for generating scene thumbnails. The render server uses <strong>WebVideoCreator</strong> for headless browser capture and <strong>FFmpeg</strong> for video encoding and transition compositing.
        </p>
      </div>

      {/* Content generation capabilities */}
      <div className="docs-overview-section">
        <h2 className="docs-overview-title">Content Generation</h2>
        <p className="docs-overview-body" style={{ marginBottom: 16 }}>
          Every layer, image, video, avatar, and voiceover can be generated from a text prompt. The editor integrates with multiple AI providers and generation APIs:
        </p>

        <div className="docs-overview-grid docs-overview-grid-3">
          <div className="docs-overview-card docs-overview-card-sm">
            <h4>Animation Code Generation</h4>
            <p>Claude writes production code for all 6 layer types — SVG markup, Canvas 2D draw loops, D3 chart bindings, Three.js scene graphs, Motion/Anime.js choreography, and Lottie JSON. Each generation API endpoint has a specialized system prompt with library-specific constraints and best practices.</p>
          </div>
          <div className="docs-overview-card docs-overview-card-sm">
            <h4>Image Generation</h4>
            <p>6 models via FAL.ai and OpenAI: <strong>Flux 1.1 Pro</strong>, <strong>Flux Schnell</strong>, <strong>Ideogram V3</strong>, <strong>Recraft V3</strong>, <strong>Stable Diffusion 3</strong>, and <strong>DALL-E 3</strong>. Style presets: photorealistic, illustration, flat, sketch, 3D, watercolor, pixel art. Smart prompt-hash caching prevents duplicate generations.</p>
          </div>
          <div className="docs-overview-card docs-overview-card-sm">
            <h4>Video Generation</h4>
            <p><strong>Google Veo 3</strong> text-to-video for atmospheric backgrounds, b-roll, abstract motion, and cinematic clips. Supports 5 or 8 second clips in 16:9, 9:16, or 1:1 aspect ratios with optional prompt enhancement and looping. Position and resize within the scene canvas.</p>
          </div>
          <div className="docs-overview-card docs-overview-card-sm">
            <h4>Talking Avatars</h4>
            <p><strong>HeyGen</strong> API generates talking-head avatar videos from a script. Select from a library of photorealistic avatars, choose a voice, and optionally remove the background for clean compositing over your scene layers. Duration auto-calculated from script length.</p>
          </div>
          <div className="docs-overview-card docs-overview-card-sm">
            <h4>Voice &amp; Audio</h4>
            <p><strong>ElevenLabs</strong> for high-fidelity AI voiceover narration with multiple voice options and configurable stability/similarity settings. Per-scene audio layers with volume (0-1), fade-in/fade-out, and start offset controls. Audio syncs to scene duration during export.</p>
          </div>
          <div className="docs-overview-card docs-overview-card-sm">
            <h4>Stock Photos &amp; Stickers</h4>
            <p><strong>Unsplash</strong> integration for royalty-free stock images with full-text search. Background removal API creates transparent stickers from any generated or uploaded image, perfect for floating elements and compositing over animated layers.</p>
          </div>
        </div>
      </div>

      {/* Agent architecture */}
      <div className="docs-overview-section">
        <h2 className="docs-overview-title">Agent Architecture</h2>
        <p className="docs-overview-body" style={{ marginBottom: 8 }}>
          Cench Studio uses a multi-agent orchestration system powered by Anthropic Claude. Each agent has its own system prompt, tool permissions, and model assignment tuned for a specific class of task. When you send a message, it flows through a pipeline:
        </p>
        <p className="docs-overview-body" style={{ marginBottom: 16 }}>
          <strong>User message &rarr; Router classification &rarr; Context builder (injects world state) &rarr; Specialized agent with streaming tool calls &rarr; Tool executor applies mutations &rarr; SSE events update the UI in real time.</strong>
        </p>

        <div className="docs-overview-agents">
          <div className="docs-overview-agent">
            <div className="docs-overview-agent-dot" style={{ background: '#a3a3a3' }} />
            <div>
              <strong>Router</strong> <span className="docs-overview-model-tag">Haiku 4.5</span>
              <p>The cheapest, fastest model classifies user intent using keyword heuristics and prompt-based reasoning. It outputs exactly one agent name: <code>director</code>, <code>scene-maker</code>, <code>editor</code>, or <code>dop</code>. If the API call fails, a rules-based keyword fallback takes over — "create" and "plan" route to Director, "tweak" and "adjust" route to Editor, "all scenes" and "palette" route to DoP.</p>
            </div>
          </div>
          <div className="docs-overview-agent">
            <div className="docs-overview-agent-dot" style={{ background: '#a855f7' }} />
            <div>
              <strong>Director</strong> <span className="docs-overview-model-tag">Sonnet 4.5 / Opus 4.5</span>
              <p>The narrative architect. Its system prompt instructs it to think cinematically — creating story arcs with hook, build, climax, and resolution. It uses the <code>plan_scenes</code> tool to outline the full project structure, then <code>create_scene</code> to build each scene. It selects the right layer type for each scene (SVG for illustrations, Canvas for particles, D3 for charts, Three.js for 3D) and sets durations based on content density: 4-6s for intros, 6-12s for content, 8-12s for data scenes, 5-8s for outros.</p>
            </div>
          </div>
          <div className="docs-overview-agent">
            <div className="docs-overview-agent-dot" style={{ background: '#3b82f6' }} />
            <div>
              <strong>Scene Maker</strong> <span className="docs-overview-model-tag">Sonnet 4.5 / Opus 4.5</span>
              <p>The content generator. Its prompt contains detailed technical rules for every layer type: SVG viewBox sizing, Canvas animation loop patterns, D3 v7 API constraints, Three.js r128 geometry restrictions (no CapsuleGeometry, no ES modules), and Lottie JSON structure. It enforces deterministic rendering via seeded PRNG (mulberry32) and prohibits character-by-character text animation. Tools: <code>add_layer</code>, <code>set_scene_duration</code>, <code>set_scene_background</code>, <code>set_transition</code>.</p>
            </div>
          </div>
          <div className="docs-overview-agent">
            <div className="docs-overview-agent-dot" style={{ background: '#22c55e' }} />
            <div>
              <strong>Editor</strong> <span className="docs-overview-model-tag">Haiku 4.5 / Sonnet 4.5</span>
              <p>The surgical modifier. Its prompt emphasizes minimal, targeted changes — never regenerating what already works. It uses <code>patch_layer_code</code> for find-and-replace within generated code (color swaps, timing adjustments, copy changes), <code>edit_element</code> / <code>move_element</code> / <code>resize_element</code> for property-level edits, and <code>adjust_element_timing</code> for animation timing. Only falls back to <code>regenerate_layer</code> when explicitly asked.</p>
            </div>
          </div>
          <div className="docs-overview-agent">
            <div className="docs-overview-agent-dot" style={{ background: '#f97316' }} />
            <div>
              <strong>Director of Photography (DoP)</strong> <span className="docs-overview-model-tag">Sonnet 4.5 / Opus 4.5</span>
              <p>The global style authority. Its prompt defines the 5-color palette system (primary bg, secondary bg, accent, dark, light), font selection (Caveat, Inter, Playfair Display, Space Mono, Oswald), roughness scale (1 = precise to 5 = art-house hand-drawn), and transition styles (none, crossfade, wipe). Uses <code>set_global_style</code>, <code>set_all_transitions</code>, and <code>set_roughness_all</code> to enforce visual consistency across every scene.</p>
            </div>
          </div>
        </div>

        <p className="docs-overview-body" style={{ marginTop: 16 }}>
          Each agent call runs as a streaming SSE connection with up to <strong>10 tool iterations</strong> per request. The context builder injects the current world state (all scenes, layers, global style, project settings) so agents always have full awareness of the project. Tool executions are tracked with duration and result metadata, and token usage / cost is calculated per request.
        </p>

        <div className="docs-overview-models">
          <h4>Claude Models</h4>
          <div className="docs-overview-model-list">
            <div className="docs-overview-model-item">
              <span className="docs-overview-model-name">Haiku 4.5</span>
              <span className="docs-overview-model-desc">Fast routing, intent classification, lightweight edits — $0.80 / $4.00 per 1M tokens (input/output)</span>
            </div>
            <div className="docs-overview-model-item">
              <span className="docs-overview-model-name">Sonnet 4.5</span>
              <span className="docs-overview-model-desc">Balanced intelligence for scene generation, code writing, and style decisions — $3.00 / $15.00 per 1M tokens</span>
            </div>
            <div className="docs-overview-model-item">
              <span className="docs-overview-model-name">Opus 4.5</span>
              <span className="docs-overview-model-desc">Maximum reasoning for complex multi-layer scenes and narrative planning — $15.00 / $75.00 per 1M tokens</span>
            </div>
          </div>
        </div>

        <div className="docs-overview-tools-summary">
          <h4>35+ Agent Tools</h4>
          <p>Agents have access to a comprehensive tool suite organized by category:</p>
          <div className="docs-overview-tool-cats">
            <div><strong>Scene:</strong> create, delete, duplicate, reorder, set duration, set background, set transition</div>
            <div><strong>Layer:</strong> add, remove, reorder, set opacity/visibility/timing, regenerate, patch code</div>
            <div><strong>Elements:</strong> add, edit, delete, move, resize, reorder, adjust timing</div>
            <div><strong>Media:</strong> generate image, generate sticker, generate avatar (HeyGen), generate video (Veo 3), set audio/video layer</div>
            <div><strong>Style:</strong> set global style, set all transitions, set roughness</div>
            <div><strong>Interaction:</strong> add interaction, edit interaction, connect scenes</div>
            <div><strong>Export:</strong> export MP4, publish interactive</div>
            <div><strong>System:</strong> request permission (for paid API calls with cost estimates)</div>
          </div>
        </div>
      </div>

      {/* Getting started */}
      <div className="docs-overview-section">
        <h2 className="docs-overview-title">Getting Started</h2>
        <div className="docs-overview-steps">
          <div className="docs-overview-step">
            <div className="docs-overview-step-num">1</div>
            <div>
              <h4>Open the editor</h4>
              <p>A blank project loads with one empty scene. The left sidebar shows your scene list (drag to reorder, right-click for options), the center is the 1920x1080 preview canvas with timeline controls, and the right panel has layer, prompt, settings, and interaction tabs.</p>
            </div>
          </div>
          <div className="docs-overview-step">
            <div className="docs-overview-step-num">2</div>
            <div>
              <h4>Open the AI chat panel</h4>
              <p>Click the chat icon in the toolbar to open the agent assistant. The Router auto-selects the right agent, or you can manually pick Director, Scene Maker, Editor, or DoP from the agent selector. Choose your preferred Claude model (Haiku for speed, Opus for quality). Describe what you want — "make a 60-second product demo for a fitness app" — and the Director will plan the full scene structure.</p>
            </div>
          </div>
          <div className="docs-overview-step">
            <div className="docs-overview-step-num">3</div>
            <div>
              <h4>Refine and iterate</h4>
              <p>Click any scene to preview it in real time. Ask the agent to adjust colors, swap animation styles, add AI-generated images or avatars, generate voiceover, insert interactive elements, or rearrange the narrative flow. Use the Editor agent for precise tweaks ("make the title bigger", "change the accent color to blue") or the DoP for sweeping style changes ("make everything feel more cinematic with a dark moody palette").</p>
            </div>
          </div>
          <div className="docs-overview-step">
            <div className="docs-overview-step-num">4</div>
            <div>
              <h4>Add interactivity (optional)</h4>
              <p>For interactive projects, add hotspots, choice buttons, quizzes, gate buttons, and tooltips to any scene. Wire scenes together in the scene graph editor to create branching narratives, decision trees, or training modules with correct/incorrect paths.</p>
            </div>
          </div>
          <div className="docs-overview-step">
            <div className="docs-overview-step-num">5</div>
            <div>
              <h4>Export or publish</h4>
              <p>For video: set resolution and framerate, then export to MP4 — the render server captures each scene and FFmpeg stitches them with your chosen transitions. For interactive: configure player theme (dark/light), navigation controls, optional password protection, and brand color, then publish to get a shareable link or embed code.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ───────────────────────── data ───────────────────────── */

const SECTIONS: Section[] = [
  {
    title: 'Scene Management',
    description: 'Create, organize, and control individual scenes within your project timeline.',
    features: [
      {
        name: 'Create & Delete Scenes',
        status: 'live',
        description: 'Add new scenes to your project or remove existing ones.',
        details: [
          'Click "New scene" in the left sidebar to add a scene',
          'Right-click a scene card for duplicate, delete, and reorder options',
          'Scenes are auto-named sequentially (Scene 1, Scene 2, etc.)',
        ],
      },
      {
        name: 'Drag-and-Drop Reordering',
        status: 'live',
        description: 'Rearrange scenes by dragging them in the sidebar.',
        details: [
          'Click and hold a scene card, then drag to reposition',
          'Visual indicator shows where the scene will be dropped',
          'Timeline order updates immediately on drop',
        ],
      },
      {
        name: 'Scene Duplication',
        status: 'live',
        description: 'Clone a scene with all its layers, overlays, and settings.',
        details: [
          'Right-click a scene card and select "Duplicate"',
          'The copy is inserted directly after the original',
          'All layers, text overlays, and interactions are copied',
        ],
      },
      {
        name: 'Scene Duration Control',
        status: 'live',
        description: 'Set how long each scene plays during playback and export.',
        details: [
          'Adjust duration in the Settings tab (right panel) for the selected scene',
          'Duration range: 3-30 seconds per scene',
          'Global default duration can be set in global style settings',
        ],
      },
      {
        name: 'Scene Background Color',
        status: 'live',
        description: 'Set a background color for each scene independently.',
        details: [
          'Use the color picker in the Settings tab',
          'Supports any hex color value',
          'Background renders behind all layers',
        ],
      },
      {
        name: 'Scene Thumbnails',
        status: 'live',
        description: 'Auto-generated preview thumbnails for each scene in the sidebar.',
        details: [
          'Thumbnails are generated from the scene canvas content',
          'Updates when scene content changes',
          'Shown on scene cards in both expanded and collapsed sidebar views',
        ],
      },
      {
        name: 'Collapsible Sidebar',
        status: 'live',
        description: 'Toggle the left sidebar between full and compact views.',
        details: [
          'Click the panel icon button to collapse/expand',
          'Collapsed view shows mini thumbnails and icon-only buttons',
          'Resizable via drag handle when expanded (160px-520px)',
        ],
      },
    ],
  },
  {
    title: 'Layer System',
    description: 'Multi-layer composition engine supporting six different rendering technologies.',
    features: [
      {
        name: 'SVG Layers',
        status: 'live',
        description: 'AI-generated animated SVG illustrations with SMIL animations.',
        details: [
          'Describe what you want and the AI generates animated SVG code',
          'Supports complex SMIL animations (transforms, opacity, path morphing)',
          'Full SVG markup editing via the code editor',
          'Branch system lets you keep multiple variations of the same layer',
        ],
      },
      {
        name: 'Canvas2D Layers',
        status: 'live',
        description: 'Procedural animations using the HTML Canvas 2D API.',
        details: [
          'AI generates JavaScript Canvas2D animation code',
          'Great for particle effects, procedural graphics, and data viz',
          'Code runs in an isolated iframe sandbox',
          'Access to requestAnimationFrame for smooth 60fps animation',
        ],
      },
      {
        name: 'D3.js Layers',
        status: 'live',
        description: 'Data-driven visualizations and charts using D3.js.',
        details: [
          'Generate bar charts, line graphs, scatter plots, and more',
          'Animated transitions between data states',
          'D3 v7 with full API access',
          'Custom data can be passed via the d3Data scene field',
        ],
      },
      {
        name: 'Three.js Layers',
        status: 'live',
        description: '3D scenes and animations using Three.js WebGL.',
        details: [
          'Generate 3D objects, cameras, lighting, and animations',
          'Supports geometries, materials, textures, and shaders',
          'Renders via WebGL in an iframe sandbox',
          'Great for product visualizations and abstract 3D graphics',
        ],
      },
      {
        name: 'Motion Layers',
        status: 'live',
        description: 'CSS and JavaScript choreographed motion graphics.',
        details: [
          'Combines HTML elements with CSS animations and JS orchestration',
          'Perfect for kinetic typography, UI animations, and infographics',
          'Full access to CSS keyframes, transitions, and Web Animations API',
        ],
      },
      {
        name: 'Lottie Layers',
        status: 'live',
        description: 'Lottie JSON animations for lightweight, scalable motion.',
        details: [
          'AI generates Lottie-compatible JSON animation data',
          'Renders via the Lottie web player',
          'Infinitely scalable vector animations',
        ],
      },
      {
        name: 'Layer Controls',
        status: 'live',
        description: 'Per-layer opacity, z-index ordering, visibility toggle, and timing.',
        details: [
          'Adjust opacity (0-1) for each layer independently',
          'Change z-index to control stacking order',
          'Toggle layer visibility without deleting',
          'Set startAt time for staggered layer entrances',
        ],
      },
      {
        name: 'Code Patching',
        status: 'live',
        description: 'Make surgical edits to layer code without full regeneration.',
        details: [
          'Find-and-replace within the generated code',
          'Useful for color tweaks, timing adjustments, copy changes',
          'Preserves the rest of the generated code intact',
        ],
      },
    ],
  },
  {
    title: 'Text Overlays',
    description: 'Configurable text elements with entrance animations, positioned on the canvas.',
    features: [
      {
        name: 'Text Element Creation',
        status: 'live',
        description: 'Add text overlays to any scene with full styling control.',
        details: [
          'Set content, font family, font size (16-120px), and color',
          'Position via x/y coordinates (percentage-based, 0-100%)',
          'Supports any Google Font family',
        ],
      },
      {
        name: 'Text Animations',
        status: 'live',
        description: 'Entrance animations for text elements.',
        details: [
          'Options: fade-in, slide-up, typewriter',
          'Configurable animation duration and delay',
          'Delay controls when the animation starts within the scene',
        ],
      },
      {
        name: 'Text Positioning & Sizing',
        status: 'live',
        description: 'Move and resize text elements on the canvas.',
        details: [
          'Percentage-based positioning for responsive layout',
          'Font size adjustment for scaling',
          'Z-index control for layering with other elements',
        ],
      },
    ],
  },
  {
    title: 'AI Media Layers',
    description: 'AI-generated media assets that composite into scenes as additional layers.',
    features: [
      {
        name: 'AI Image Generation',
        status: 'live',
        description: 'Generate images from text prompts using multiple AI models.',
        details: [
          'Models: Flux 1.1 Pro, Flux Schnell, Ideogram V3, Recraft V3, Stable Diffusion 3, DALL-E 3',
          'Style presets: photorealistic, illustration, flat, sketch, 3D, pixel, watercolor',
          'Position, resize, rotate, and adjust opacity of generated images',
          'Background removal available for transparent compositing',
        ],
      },
      {
        name: 'Sticker Generation',
        status: 'live',
        description: 'Generate sticker-style images with automatic background removal.',
        details: [
          'Same model and style options as image generation',
          'Automatic background removal creates transparent stickers',
          'Animate-in option for entrance animations',
          'Configurable start time within the scene',
        ],
      },
      {
        name: 'AI Avatar Videos (HeyGen)',
        status: 'live',
        description: 'Generate talking-head avatar videos from a script.',
        details: [
          'Select from HeyGen avatar library',
          'Provide a script and voice selection',
          'Optional background removal for clean compositing',
          'Position and resize the avatar within the scene',
          'Estimated duration calculated from script length',
        ],
      },
      {
        name: 'AI Video Generation (Veo3)',
        status: 'live',
        description: 'Generate video clips from text prompts using Google Veo3.',
        details: [
          'Text-to-video generation with prompt and optional negative prompt',
          'Aspect ratios: 16:9, 9:16, 1:1',
          'Duration options: 5 or 8 seconds',
          'Playback rate control and loop option',
          'Position and resize within the scene',
        ],
      },
      {
        name: 'Background Removal',
        status: 'live',
        description: 'Remove backgrounds from images for transparent compositing.',
        details: [
          'Works on AI-generated images and uploaded images',
          'Powers the sticker generation pipeline',
          'API-based processing with permission control',
        ],
      },
      {
        name: 'Stock Image Search (Unsplash)',
        status: 'live',
        description: 'Search and place royalty-free stock photos from Unsplash.',
        details: [
          'Full-text search across the Unsplash library',
          'Returns up to 10 results per query',
          'Images can be placed and positioned directly into scenes',
        ],
      },
    ],
  },
  {
    title: 'Audio',
    description: 'Audio layers for background music, sound effects, and narration.',
    features: [
      {
        name: 'Audio Layer per Scene',
        status: 'live',
        description: 'Attach an audio track to each scene.',
        details: [
          'Set audio source URL',
          'Volume control (0-1)',
          'Fade-in and fade-out options',
          'Start offset to begin playback at a specific point',
        ],
      },
      {
        name: 'Text-to-Speech (ElevenLabs)',
        status: 'live',
        description: 'Generate voiceover narration from text using ElevenLabs TTS.',
        details: [
          'High-quality AI voice synthesis',
          'Multiple voice options',
          'Generated audio attaches to the scene audio layer',
        ],
      },
      {
        name: 'Video Background Layer',
        status: 'live',
        description: 'Set a background video for a scene.',
        details: [
          'Video source URL with opacity control',
          'Trim start and end points',
          'Plays behind all other layers',
        ],
      },
    ],
  },
  {
    title: 'Interactive Elements',
    description: 'Clickable, hoverable, and form-based interactive elements for non-linear experiences.',
    features: [
      {
        name: 'Hotspots',
        status: 'live',
        description: 'Clickable areas that navigate to other scenes.',
        details: [
          'Shapes: circle, rectangle, pill',
          'Styles: pulse, glow, border, filled',
          'Custom color and label',
          'Links to scene graph edges for branching navigation',
          'Configurable appearance/hide timing',
          'Entrance animations: fade, slide-up, pop, none',
        ],
      },
      {
        name: 'Choice Buttons',
        status: 'live',
        description: 'Present multiple options that branch to different scenes.',
        details: [
          'Optional question prompt above choices',
          'Layout options: horizontal, vertical, grid',
          'Each option has a label, optional icon, custom color, and destination scene',
          'Ideal for branching narratives and decision trees',
        ],
      },
      {
        name: 'Quizzes',
        status: 'live',
        description: 'Multiple-choice quiz questions with correct/incorrect branching.',
        details: [
          'Set a question and multiple answer options',
          'Designate the correct answer',
          'On correct: continue or jump to specific scene',
          'On wrong: retry, continue, or jump to specific scene',
          'Optional explanation text shown after answering',
        ],
      },
      {
        name: 'Gate Buttons',
        status: 'live',
        description: 'Pause playback and require user action to continue.',
        details: [
          'Custom button label',
          'Button styles: primary, outline, minimal',
          'Minimum watch time before button appears',
          'Forces engagement before scene progression',
        ],
      },
      {
        name: 'Tooltips',
        status: 'live',
        description: 'Hover-triggered information popups.',
        details: [
          'Trigger shapes: circle, rectangle',
          'Custom trigger color and optional label',
          'Tooltip with title and body text',
          'Position: top, bottom, left, or right',
          'Configurable max width',
        ],
      },
      {
        name: 'Form Inputs',
        status: 'live',
        description: 'Data collection forms with variable binding.',
        details: [
          'Field types: text input, select dropdown, radio buttons',
          'Per-field labels, placeholders, options, and required flag',
          'Collected values bind to scene variables',
          'Custom submit button label',
          'Optional navigation to another scene on submit',
        ],
      },
    ],
  },
  {
    title: 'Scene Graph & Branching',
    description: 'Visual flow editor for non-linear scene connections and conditional navigation.',
    features: [
      {
        name: 'Visual Scene Graph Editor',
        status: 'live',
        description: 'Node-based visual editor for scene flow and connections.',
        details: [
          'Powered by @xyflow/react (React Flow)',
          'Each scene is a draggable node',
          'Edges represent transitions between scenes',
          'Visual representation of branching logic',
        ],
      },
      {
        name: 'Edge Conditions',
        status: 'live',
        description: 'Conditional navigation between scenes based on user interactions.',
        details: [
          'Auto: plays next scene automatically after duration',
          'Hotspot: navigates when a hotspot is clicked',
          'Choice: navigates based on which option is selected',
          'Quiz: navigates based on correct/incorrect answer',
          'Gate: navigates after gate button is pressed',
          'Variable: navigates based on variable value (form data)',
        ],
      },
      {
        name: 'Scene Variables',
        status: 'live',
        description: 'Data variables that persist across scenes for conditional logic.',
        details: [
          'Variables are set by form inputs',
          'Can be used in edge conditions for variable-based routing',
          'Enables personalized viewer experiences',
        ],
      },
    ],
  },
  {
    title: 'AI Agent System',
    description: 'Multi-agent AI system powered by Claude that understands and controls the editor programmatically.',
    features: [
      {
        name: 'Chat Interface',
        status: 'live',
        description: 'Conversational AI panel for natural-language video editing.',
        details: [
          'Expandable chat panel on the right side of the editor',
          'Streaming responses via Server-Sent Events',
          'Message history with user/assistant roles',
          'Undo capability to revert AI changes',
        ],
      },
      {
        name: 'Router Agent',
        status: 'live',
        description: 'Classifies user intent and routes to the best specialist agent.',
        details: [
          'Analyzes the user message and current project state',
          'Routes to: Director, Scene-Maker, Editor, or DOP',
          'Ensures the right agent handles each request type',
        ],
      },
      {
        name: 'Director Agent',
        status: 'live',
        description: 'Plans and structures overall video projects from high-level descriptions.',
        details: [
          'Creates multi-scene video plans from a single prompt',
          'Determines scene types, durations, and transitions',
          'Orchestrates layer generation across scenes',
          'Handles project-level style and structure decisions',
        ],
      },
      {
        name: 'Scene-Maker Agent',
        status: 'live',
        description: 'Generates content for individual scenes.',
        details: [
          'Creates layers with appropriate rendering technology',
          'Adds text overlays and interactive elements',
          'Handles scene-specific styling and timing',
        ],
      },
      {
        name: 'Editor Agent',
        status: 'live',
        description: 'Refines and modifies existing scenes based on feedback.',
        details: [
          'Patches existing code for targeted fixes',
          'Adjusts colors, timing, and animations',
          'Works with the existing layer code rather than regenerating',
        ],
      },
      {
        name: 'DOP (Director of Photography) Agent',
        status: 'live',
        description: 'Controls global visual style across the entire project.',
        details: [
          'Sets color palettes, fonts, and stroke widths',
          'Applies consistent transitions across all scenes',
          'Manages theme (light/dark) and visual coherence',
        ],
      },
      {
        name: 'Model Selection',
        status: 'live',
        description: 'Choose which Claude model powers the AI agents.',
        details: [
          'Haiku 4.5 — fastest, most economical',
          'Sonnet 4.5 — balanced speed and quality',
          'Opus 4.5 — highest quality output',
        ],
      },
      {
        name: '30+ Agent Tools',
        status: 'live',
        description: 'Comprehensive tool suite the AI uses to manipulate the editor.',
        details: [
          'Scene tools: create, delete, duplicate, reorder, set duration, background, transition',
          'Layer tools: add, remove, reorder, opacity, visibility, timing, regenerate, patch code',
          'Element tools: add, edit, delete, move, resize, reorder, adjust timing',
          'Asset tools: search images, place image, set audio/video layers',
          'Global tools: set style, transitions, roughness, plan scenes',
          'Interaction tools: add interaction, edit interaction, connect scenes',
          'Export tools: export MP4, publish interactive',
        ],
      },
    ],
  },
  {
    title: 'Export & Publishing',
    description: 'Output your project as downloadable video or hosted interactive experience.',
    features: [
      {
        name: 'MP4 Video Export',
        status: 'live',
        description: 'Render your project as a downloadable MP4 video file.',
        details: [
          'Resolution options: 720p, 1080p, 4K',
          'Frame rate options: 24fps, 30fps, 60fps',
          'H.264 codec via server-side FFmpeg rendering',
          'Per-scene progress tracking during export',
          'Phases: rendering individual scenes, stitching together, download',
        ],
      },
      {
        name: 'Interactive Publish',
        status: 'live',
        description: 'Publish as a hosted interactive experience with a shareable link.',
        details: [
          'Generates a unique hosted URL',
          'Supports all interactive elements (hotspots, choices, quizzes, gates, tooltips, forms)',
          'Player options: theme (dark/light/transparent), progress bar, scene nav, fullscreen',
          'Custom brand color',
          'One-click update to push changes to the live version',
        ],
      },
      {
        name: 'Output Mode Switching',
        status: 'live',
        description: 'Switch between MP4 and Interactive output modes.',
        details: [
          'Confirmation modal when switching modes',
          'Settings for both modes are preserved when switching',
          'Interactive elements are preserved even in MP4 mode',
        ],
      },
      {
        name: 'Custom Domain',
        status: 'future',
        description: 'Use your own domain for published interactive experiences.',
        details: [
          'CNAME configuration for custom domains',
          'SSL certificate provisioning',
        ],
      },
      {
        name: 'Password Protection',
        status: 'future',
        description: 'Require a password to view published content.',
        details: [
          'Set a password in interactive settings',
          'Viewers must enter password before accessing the experience',
        ],
      },
      {
        name: 'WebM Export',
        status: 'future',
        description: 'Export as WebM format in addition to MP4.',
      },
    ],
  },
  {
    title: 'Transitions',
    description: 'Visual transition effects between scenes.',
    features: [
      { name: 'Crossfade', status: 'live', description: 'Smooth opacity crossfade between scenes.' },
      { name: 'Wipe Left / Wipe Right', status: 'live', description: 'Directional wipe transitions.' },
      { name: 'No Transition (Cut)', status: 'live', description: 'Instant cut between scenes with no transition effect.' },
      {
        name: 'Batch Transition Setting',
        status: 'live',
        description: 'Apply the same transition to every scene at once.',
        details: [
          'Available via the DOP agent or global style tools',
          'Overrides all individual scene transitions',
        ],
      },
      {
        name: 'Additional Transitions',
        status: 'future',
        description: 'More transition types: zoom, slide, morph, dissolve, iris.',
      },
    ],
  },

  {
    title: 'API Permission System',
    description: 'Granular control over which external AI services the app can use and their spending limits.',
    features: [
      {
        name: 'Per-API Permission Modes',
        status: 'live',
        description: 'Control access for each external API independently.',
        details: [
          'APIs: HeyGen, Veo3, Image Generation, Background Removal, ElevenLabs, Unsplash',
          'Modes: Always Ask, Always Allow, Always Deny, Ask Once',
          'Permission dialog shows estimated cost and reason before each API call',
        ],
      },
      {
        name: 'Spending Limits',
        status: 'live',
        description: 'Set session and monthly spending caps per API.',
        details: [
          'Session limit resets each time the editor is opened',
          'Monthly limit tracks cumulative spend',
          'Spend tracking per session and per month',
        ],
      },
      {
        name: 'Permission Dialog',
        status: 'live',
        description: 'Interactive approval dialog for API requests.',
        details: [
          'Shows API name, estimated cost, reason, and details',
          'Allow or deny individual requests',
          'Remember decision: once, for session, or always',
        ],
      },
    ],
  },
  {
    title: 'Editor UI',
    description: 'Three-panel editor layout with resizable panels and contextual controls.',
    features: [
      {
        name: 'Three-Panel Layout',
        status: 'live',
        description: 'Left sidebar, center preview, right editor panel.',
        details: [
          'Left: scene list with thumbnails and add/export controls',
          'Center: live canvas preview with playback controls',
          'Right: tabbed editor (Layers, Interact, Settings, Agent)',
          'All panels are resizable via drag handles',
        ],
      },
      {
        name: 'Canvas Preview Player',
        status: 'live',
        description: 'Live preview of the currently selected scene.',
        details: [
          'Play/pause/restart controls',
          'Layer isolation toggle',
          'Fullscreen mode',
          'Selection mode for interactive elements',
          'Real-time rendering of all layer types',
        ],
      },
      {
        name: 'Layers Tab',
        status: 'live',
        description: 'Manage all layers in the selected scene.',
        details: [
          'List of all SVG objects, AI layers, text overlays, audio, and video',
          'Add new layers of any type',
          'Delete layers with confirmation',
          'Visual icons indicating layer type',
        ],
      },
      {
        name: 'Interact Tab',
        status: 'live',
        description: 'Manage interactive elements for the selected scene.',
        details: [
          'Add hotspots, choices, quizzes, gates, tooltips, forms',
          'Configure each element type with full options',
          'Scene graph editor for flow visualization',
        ],
      },
      {
        name: 'Settings Tab',
        status: 'live',
        description: 'Scene-specific and global project settings.',
        details: [
          'Scene: name, duration, background color, transition type',
          'Global: palette, font, stroke width, theme, default duration',
          'Output mode switcher (MP4 vs Interactive)',
          'MP4 settings: resolution, FPS',
          'Interactive settings: player theme, progress bar, nav, fullscreen, brand color',
        ],
      },
      {
        name: 'Chat Panel',
        status: 'live',
        description: 'Expandable AI chat panel for agent interaction.',
        details: [
          'Resizable panel width (280-560px)',
          'Streaming message display',
          'Tool call visualization with collapsible details',
          'Undo button to revert AI changes',
        ],
      },
      {
        name: 'SVG Branch System',
        status: 'live',
        description: 'Version branching for SVG layer iterations.',
        details: [
          'Each edit to an SVG creates a new branch',
          'Switch between branches to compare variations',
          'Branch labels show truncated edit instructions',
          'Root branch labeled "Original"',
        ],
      },
    ],
  },
  {
    title: 'Hosted Player',
    description: 'Embeddable interactive player for published experiences.',
    features: [
      {
        name: 'Interactive Playback',
        status: 'live',
        description: 'Full interactive player that renders published projects.',
        details: [
          'Scene-by-scene playback with transition support',
          'All interactive elements functional (hotspots, choices, quizzes, etc.)',
          'Scene graph navigation for non-linear paths',
          'Progress bar and scene navigation options',
        ],
      },
      {
        name: 'Player Theming',
        status: 'live',
        description: 'Customizable player appearance.',
        details: [
          'Themes: dark, light, transparent',
          'Custom brand color',
          'Toggle progress bar, scene nav, and fullscreen',
        ],
      },
      {
        name: 'Embed Support',
        status: 'future',
        description: 'Embeddable iframe and script tag for websites.',
        details: [
          'Responsive iframe embed code',
          'JavaScript SDK for programmatic control',
        ],
      },
      {
        name: 'Analytics',
        status: 'dev',
        description: 'Track viewer engagement across scenes and interactions.',
        details: [
          'Event tracking API endpoint exists',
          'Per-scene view counts and drop-off rates',
          'Interaction completion tracking (quiz scores, form submissions)',
        ],
      },
    ],
  },
  {
    title: 'Infrastructure & Architecture',
    description: 'Technical stack and underlying systems.',
    features: [
      {
        name: 'Next.js App Router',
        status: 'live',
        description: 'Server and client rendering via Next.js 16.',
        details: [
          'App Router with file-based routing',
          'Server-side API routes for AI generation and export',
          'Client-side state management with Zustand',
        ],
      },
      {
        name: 'Zustand State Management',
        status: 'live',
        description: 'Centralized reactive state store for the entire editor.',
        details: [
          'Single store managing scenes, project, export state, UI state',
          'Actions for all CRUD operations',
          'Reactive updates across all components',
        ],
      },
      {
        name: 'Database (Drizzle ORM + PostgreSQL)',
        status: 'live',
        description: 'Persistent storage for projects, scenes, and published content.',
        details: [
          'Drizzle ORM for type-safe database access',
          'PostgreSQL via Docker',
          'Migration system via drizzle-kit',
          'Studio UI for database inspection',
        ],
      },
      {
        name: 'FFmpeg Render Server',
        status: 'live',
        description: 'Server-side video rendering pipeline.',
        details: [
          'Captures each scene via headless browser',
          'FFmpeg stitches frames into final MP4',
          'Supports multiple resolutions and frame rates',
        ],
      },
      {
        name: 'Claude API Integration',
        status: 'live',
        description: 'Anthropic Claude for all AI generation tasks.',
        details: [
          'Streaming responses via Server-Sent Events',
          'Tool use for structured editor control',
          'Multi-model support (Haiku, Sonnet, Opus)',
          'Usage tracking (input/output tokens, cost)',
        ],
      },
      {
        name: 'Monaco Code Editor',
        status: 'live',
        description: 'VS Code-grade code editor for direct code manipulation.',
      },
      {
        name: 'Drag-and-Drop (@dnd-kit)',
        status: 'live',
        description: 'Scene reordering and element positioning via drag-and-drop.',
      },
      {
        name: 'Real-time Collaboration',
        status: 'future',
        description: 'Multiple users editing the same project simultaneously.',
        details: [
          'WebSocket-based state sync',
          'Cursor presence indicators',
          'Conflict resolution',
        ],
      },
      {
        name: 'Project Templates',
        status: 'future',
        description: 'Pre-built project templates for common use cases.',
        details: [
          'Onboarding walkthrough template',
          'Product demo template',
          'Explainer video template',
          'Quiz/assessment template',
        ],
      },
      {
        name: 'Asset Library',
        status: 'future',
        description: 'Persistent library of uploaded and generated assets.',
        details: [
          'Reuse images, audio, and video across projects',
          'Tag and search uploaded assets',
        ],
      },
    ],
  },
  {
    title: 'API Endpoints',
    description: 'Backend API surface powering AI generation, export, and publishing.',
    features: [
      {
        name: 'Generation APIs',
        status: 'live',
        description: 'Endpoints for each layer type and media generation.',
        details: [
          '/api/generate — SVG generation',
          '/api/generate-canvas — Canvas2D code',
          '/api/generate-d3 — D3.js visualization',
          '/api/generate-three — Three.js 3D scene',
          '/api/generate-motion — Motion/CSS animation',
          '/api/generate-lottie — Lottie JSON',
          '/api/generate-image — AI image generation',
          '/api/generate-avatar — HeyGen avatar video',
          '/api/generate-video — Veo3 video generation',
        ],
      },
      {
        name: 'Media APIs',
        status: 'live',
        description: 'File handling and media processing.',
        details: [
          '/api/tts — ElevenLabs text-to-speech',
          '/api/upload — File upload',
          '/api/remove-background — Background removal',
        ],
      },
      {
        name: 'Project APIs',
        status: 'live',
        description: 'Project management and publishing.',
        details: [
          '/api/export — MP4 video export',
          '/api/publish — Publish interactive version',
          '/api/scene — Scene CRUD operations',
          '/api/permissions — Permission management',
          '/api/analytics — Event tracking',
        ],
      },
      {
        name: 'Agent API',
        status: 'live',
        description: 'AI agent execution endpoint.',
        details: [
          '/api/agent — Claude agent with SSE streaming',
          'Supports tool use for editor control',
          'Multi-agent routing and execution',
        ],
      },
    ],
  },
]

/* ───────────────────────── components ───────────────────────── */

function StatusPill({ status }: { status: Status }) {
  const c = STATUS_CONFIG[status]
  return (
    <span
      className="docs-status-pill"
      style={{ color: c.color, background: c.bg }}
    >
      <span className="docs-status-dot" style={{ background: c.dot }} />
      {c.label}
    </span>
  )
}

function FeatureRow({ feature, id }: { feature: Feature; id?: string }) {
  const [open, setOpen] = useState(false)
  const hasDetails = feature.details && feature.details.length > 0

  return (
    <div id={id} className={`docs-feature-row ${open ? 'is-open' : ''}`}>
      <div
        className="docs-feature-btn"
        role="button"
        tabIndex={0}
        onClick={() => hasDetails && setOpen(!open)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            if (hasDetails) setOpen(!open)
          }
        }}
        aria-expanded={open}
      >
        <div className="docs-feature-content">
          <div className="docs-feature-header">
            <span className="docs-feature-name">{feature.name}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: 'auto' }}>
              <StatusPill status={feature.status} />
              {hasDetails && (
                <span className={`docs-feature-chevron ${open ? 'is-open' : ''}`} style={{ display: 'flex' }}>
                  <ChevronRight size={14} />
                </span>
              )}
            </div>
          </div>
          <p className="docs-feature-desc">{feature.description}</p>
        </div>
      </div>
      {open && hasDetails && (
        <div className="docs-feature-details">
          <ul>
            {feature.details!.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function SectionBlock({ section, sectionIdx }: { section: Section; sectionIdx: number }) {
  const Icon = SECTION_ICONS[section.title] || BookOpen
  const sectionId = `section-${section.title.replace(/\s+/g, '-').toLowerCase()}`

  return (
    <section className="docs-section" id={sectionId}>
      <div className="docs-section-header">
        <div className="docs-section-icon">
          <Icon size={18} strokeWidth={1.5} />
        </div>
        <div>
          <h2 className="docs-section-title">{section.title}</h2>
          <p className="docs-section-desc">{section.description}</p>
        </div>
      </div>
      <div className="docs-feature-list">
        {section.features.map((f, i) => (
          <FeatureRow
            key={i}
            feature={f}
            id={`feature-${section.title.replace(/\s+/g, '-').toLowerCase()}-${f.name.replace(/\s+/g, '-').toLowerCase()}`}
          />
        ))}
      </div>
    </section>
  )
}

/* ───────────────────────── main page ───────────────────────── */

export default function DocsPage() {
  const { globalStyle, updateGlobalStyle } = useVideoStore()
  const [filter, setFilter] = useState<Status | 'all'>('all')
  const [search, setSearch] = useState('')
  const [activeSection, setActiveSection] = useState('')
  const mainRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (typeof document === 'undefined') return
    const root = document.documentElement
    root.style.removeProperty('--color-bg')
    root.style.removeProperty('--color-panel')
    root.style.removeProperty('--color-accent')
    root.style.removeProperty('--color-border')
    root.style.removeProperty('--color-text-primary')
    root.style.removeProperty('--color-text-muted')
    if (globalStyle.theme === 'light') {
      root.classList.add('light-theme')
    } else {
      root.classList.remove('light-theme')
    }
    root.style.setProperty('--font-global', globalStyle.font)
    globalStyle.palette.forEach((color, i) => {
      root.style.setProperty(`--color-p${i + 1}`, color)
    })
  }, [globalStyle.theme, globalStyle.font, globalStyle.palette])

  // Intersection observer for active sidebar section
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id)
          }
        }
      },
      { rootMargin: '-80px 0px -70% 0px', threshold: 0 }
    )
    const sections = document.querySelectorAll('.docs-section')
    sections.forEach(s => observer.observe(s))
    return () => observer.disconnect()
  }, [])

  // Keyboard shortcut for search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const totalFeatures = SECTIONS.reduce((sum, s) => sum + s.features.length, 0)
  const liveCt = SECTIONS.reduce((sum, s) => sum + s.features.filter(f => f.status === 'live').length, 0)
  const devCt = SECTIONS.reduce((sum, s) => sum + s.features.filter(f => f.status === 'dev').length, 0)
  const futureCt = SECTIONS.reduce((sum, s) => sum + s.features.filter(f => f.status === 'future').length, 0)

  const filtered = useMemo(() => {
    let sections = SECTIONS
    if (filter !== 'all') {
      sections = sections.map(s => ({
        ...s,
        features: s.features.filter(f => f.status === filter),
      })).filter(s => s.features.length > 0)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      sections = sections.map(s => ({
        ...s,
        features: s.features.filter(f =>
          f.name.toLowerCase().includes(q) ||
          f.description.toLowerCase().includes(q) ||
          f.details?.some(d => d.toLowerCase().includes(q))
        ),
      })).filter(s => s.features.length > 0)
    }
    return sections
  }, [filter, search])

  return (
    <div className={`docs-root ${globalStyle.theme === 'dark' ? 'docs-dark' : 'docs-light'}`} style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>

        {/* ── LEFT SIDEBAR ── */}
        <aside className="docs-sidebar">
          <div className="docs-sidebar-search">
            <div className="docs-sidebar-search-box">
              <span className="docs-sidebar-search-icon"><Search size={14} /></span>
              <input
                ref={searchRef}
                type="text"
                placeholder="Search..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search ? (
                <div
                  className="docs-search-clear"
                  onClick={() => setSearch('')}
                  style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--docs-text-muted)', padding: 0, lineHeight: 1 }}
                >
                  <X size={12} />
                </div>
              ) : (
                <span className="docs-sidebar-search-kbd">{'\u2318'}K</span>
              )}
            </div>
          </div>

          <nav className="docs-sidebar-nav">
            <div className="docs-nav-group">
              <div
                className="docs-nav-heading"
                onClick={() => {
                  document.querySelector('.docs-overview')?.scrollIntoView({ behavior: 'smooth' })
                }}
              >
                Overview
              </div>
              <div style={{ paddingBottom: 4 }}>
                {['What is Cench Studio?', 'How It Works', 'Rendering Stack & Open-Source Libraries', 'Content Generation', 'Agent Architecture', 'Getting Started'].map(label => (
                  <div
                    key={label}
                    className="docs-nav-sub-item"
                    onClick={() => {
                      const headings = document.querySelectorAll('.docs-overview-title')
                      for (const h of headings) {
                        if (h.textContent === label) {
                          h.scrollIntoView({ behavior: 'smooth' })
                          break
                        }
                      }
                    }}
                  >
                    {label}
                  </div>
                ))}
              </div>
            </div>
            {SECTIONS.map((s) => {
              const sectionId = `section-${s.title.replace(/\s+/g, '-').toLowerCase()}`
              const isActive = activeSection === sectionId
              return (
                <div key={s.title} className="docs-nav-group">
                  <div
                    className={`docs-nav-heading ${isActive ? 'is-active' : ''}`}
                    onClick={() => {
                      document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' })
                    }}
                  >
                    {s.title}
                  </div>
                  <div style={{ paddingBottom: 4 }}>
                    {s.features.map((f) => {
                      const featureId = `feature-${s.title.replace(/\s+/g, '-').toLowerCase()}-${f.name.replace(/\s+/g, '-').toLowerCase()}`
                      return (
                        <div
                          key={f.name}
                          className="docs-nav-sub-item"
                          onClick={() => {
                            document.getElementById(featureId)?.scrollIntoView({ behavior: 'smooth' })
                          }}
                        >
                          {f.name}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </nav>
        </aside>

        {/* ── MAIN ── */}
        <div className="docs-main">
          {/* Topbar */}
          <div className="docs-topbar">
            <div className="docs-topbar-title">Documentation</div>
            <div style={{ flex: 1 }} />
            <div className="docs-filter-group">
              {(['all', 'live', 'dev', 'future'] as const).map(f => (
                <div
                  key={f}
                  className={`docs-filter-btn ${filter === f ? 'is-active' : ''}`}
                  onClick={() => setFilter(f)}
                >
                  {f === 'all' ? `All (${totalFeatures})` : f === 'dev' ? `Dev (${devCt})` : f === 'live' ? `Live (${liveCt})` : `Planned (${futureCt})`}
                </div>
              ))}
            </div>
            <div
              className="docs-theme-toggle"
              onClick={() => {
                const next = globalStyle.theme === 'dark' ? 'light' : 'dark'
                updateGlobalStyle({
                  theme: next,
                  palette: next === 'light'
                    ? ['#ffffff', '#ffffff', '#e84545', 'transparent', '#666675']
                    : ['#181818', '#121212', '#e84545', '#151515', '#f0ece0'],
                })
              }}
            >
              {globalStyle.theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </div>
          </div>

          {/* Scrollable content area with right TOC */}
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            <div className="docs-scroll" ref={mainRef}>
              {/* Hero */}
              <div className="docs-hero">
                <div className="docs-hero-eyebrow">Cench Studio</div>
                <h1>Documentation</h1>
                <p>
                  Comprehensive documentation of every feature in Cench Studio.
                  Each feature is tagged with its current status so you always know
                  what's shipping, what's in progress, and what's coming next.
                </p>

                <div className="docs-stats">
                  <div className="docs-stat">
                    <span className="docs-stat-value" style={{ color: 'var(--docs-text)' }}>{totalFeatures}</span>
                    <span className="docs-stat-label">Total</span>
                  </div>
                  <div className="docs-stat">
                    <span className="docs-stat-value" style={{ color: '#16a34a' }}>{liveCt}</span>
                    <span className="docs-stat-label">Live</span>
                  </div>
                  <div className="docs-stat">
                    <span className="docs-stat-value" style={{ color: '#dc2626' }}>{devCt}</span>
                    <span className="docs-stat-label">In Dev</span>
                  </div>
                  <div className="docs-stat">
                    <span className="docs-stat-value" style={{ color: '#d97706' }}>{futureCt}</span>
                    <span className="docs-stat-label">Planned</span>
                  </div>
                </div>
              </div>

              {/* Overview */}
              <OverviewSection />

              {/* Feature sections */}
              <div className="docs-content">
                {filtered.length > 0 ? (
                  filtered.map((section, i) => (
                    <SectionBlock key={section.title} section={section} sectionIdx={i} />
                  ))
                ) : (
                  <div className="docs-empty">
                    <div className="docs-empty-icon">
                      <Search size={20} />
                    </div>
                    <h3>No features found</h3>
                    <p>Try adjusting your search or filter criteria.</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="docs-footer">
                <div className="docs-footer-item">
                  <span className="docs-footer-dot" style={{ background: '#22c55e' }} />
                  <strong>Live</strong> &mdash; shipped and functional
                </div>
                <div className="docs-footer-item">
                  <span className="docs-footer-dot" style={{ background: '#ef4444' }} />
                  <strong>In Development</strong> &mdash; actively being built
                </div>
                <div className="docs-footer-item">
                  <span className="docs-footer-dot" style={{ background: '#fbbf24' }} />
                  <strong>Planned</strong> &mdash; on the roadmap
                </div>
              </div>
            </div>

            {/* ── RIGHT TOC ── */}
            <div className="docs-toc">
              {SECTIONS.map((s) => {
                const sectionId = `section-${s.title.replace(/\s+/g, '-').toLowerCase()}`
                return (
                  <div
                    key={s.title}
                    className={`docs-toc-item ${activeSection === sectionId ? 'is-active' : ''}`}
                    onClick={() => {
                      document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' })
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    {s.title}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
  )
}
