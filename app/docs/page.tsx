'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Image from 'next/image'
import './docs.css'

/* ── Inline SVG icons ── */

function IconSearch() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

function IconSun() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  )
}

function IconMoon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

function IconExternal() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  )
}

function IconList() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  )
}

function IconArrowUp() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="5 12 12 5 19 12" />
    </svg>
  )
}

function IconCopy() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

function IconGitHub() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  )
}

function IconX() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

/* ── CodeBlock helper ── */

function CodeBlock({ lang, children }: { lang: string; children: string }) {
  return (
    <div className="docs-code-block">
      <div className="docs-code-header">
        <span>{lang}</span>
        <span
          className="docs-code-copy"
          role="button"
          tabIndex={0}
          onClick={() => navigator.clipboard.writeText(children)}
        >
          <IconCopy />
        </span>
      </div>
      <pre>{children}</pre>
    </div>
  )
}

/* ── Section types ── */

type Section =
  | 'getting-started'
  | 'quickstart'
  | 'usage-billing'
  | 'use-app-ui'
  | 'use-agent'
  | 'use-api'
  | 'agent-behavior'
  | 'export-standard'
  | 'export-interactive'
  | 'scene-gen'
  | 'media-av'
  | 'media-avatar'
  | 'resources'

/* ── Navigation Data ── */

interface NavItem {
  label: string
  section?: Section
  badge?: { text: string; variant: 'get' | 'post' | 'patch' }
}

interface NavSection {
  title: string
  items: NavItem[]
}

const navSections: NavSection[] = [
  {
    title: 'Getting Started',
    items: [
      { label: 'Overview', section: 'getting-started' },
      { label: 'Quickstart', section: 'quickstart' },
      { label: 'Usage & Billing', section: 'usage-billing' },
    ],
  },
  {
    title: 'Use Cench',
    items: [
      { label: 'App UI', section: 'use-app-ui' },
      { label: 'Agent', section: 'use-agent' },
      { label: 'API', section: 'use-api' },
    ],
  },
  {
    title: 'Agent Behavior',
    items: [{ label: 'Agents & Tools', section: 'agent-behavior' }],
  },
  {
    title: 'Export',
    items: [
      { label: 'Standard (MP4)', section: 'export-standard' },
      { label: 'Interactive', section: 'export-interactive' },
    ],
  },
  {
    title: 'Scene Generation',
    items: [
      { label: 'Renderers & Types', section: 'scene-gen' },
      { label: 'Audio & Video', section: 'media-av' },
      { label: 'Avatars', section: 'media-avatar' },
    ],
  },
  {
    title: 'Resources',
    items: [{ label: 'SDKs & Components', section: 'resources' }],
  },
]

const tocBySection: Record<Section, { label: string; id: string }[]> = {
  'getting-started': [
    { label: 'Four ways to use Cench', id: 'four-ways' },
    { label: 'Scene types', id: 'scene-types' },
    { label: 'How scenes work', id: 'how-scenes-work' },
    { label: 'Style presets', id: 'style-presets' },
    { label: 'Environment setup', id: 'env-setup' },
    { label: 'Conventions', id: 'conventions' },
  ],
  quickstart: [
    { label: 'Prerequisites', id: 'qs-prereqs' },
    { label: 'Using the App UI', id: 'qs-app-ui' },
    { label: 'Using the Agent Skill', id: 'qs-agent-skill' },
    { label: 'Using the REST API', id: 'qs-rest-api' },
    { label: 'Using the Agent API', id: 'qs-agent-api' },
    { label: 'Next steps', id: 'next-steps' },
  ],
  'usage-billing': [
    { label: 'LLM models', id: 'llm-models' },
    { label: 'Image generation', id: 'image-gen-pricing' },
    { label: 'Video & media', id: 'video-media-pricing' },
    { label: 'Local models', id: 'local-models' },
    { label: 'Permissions', id: 'permissions' },
    { label: 'Rate limits', id: 'rate-limits' },
  ],
  'use-app-ui': [
    { label: 'Editor layout', id: 'editor-layout' },
    { label: 'Chat panel', id: 'chat-panel' },
    { label: 'Layers & settings', id: 'layers-settings' },
    { label: 'Timeline', id: 'timeline' },
  ],
  'use-agent': [
    { label: 'The /cench skill', id: 'cench-skill' },
    { label: 'How it works', id: 'skill-how' },
    { label: 'Supported tools', id: 'skill-tools' },
    { label: 'Scene type selection', id: 'skill-types' },
  ],
  'use-api': [
    { label: 'Generation endpoints', id: 'gen-endpoints' },
    { label: 'Scene CRUD', id: 'scene-crud' },
    { label: 'Projects', id: 'projects-api' },
    { label: 'Agent API (SSE)', id: 'agent-api-sse' },
  ],
  'agent-behavior': [
    { label: 'Agent types', id: 'agent-types' },
    { label: 'Building agents', id: 'building-agents' },
    { label: 'Customizing prompts', id: 'custom-prompts' },
    { label: 'Models', id: 'agent-models' },
    { label: 'Tools', id: 'agent-tools' },
    { label: 'Personalization', id: 'personalization' },
  ],
  'export-standard': [
    { label: 'How MP4 export works', id: 'mp4-flow' },
    { label: 'Settings', id: 'mp4-settings' },
    { label: 'Transitions', id: 'mp4-transitions' },
    { label: 'Render server', id: 'render-server' },
  ],
  'export-interactive': [
    { label: 'Scene graph', id: 'scene-graph' },
    { label: 'Interactions', id: 'interaction-types' },
    { label: 'Variables', id: 'variables' },
    { label: 'Player settings', id: 'player-settings' },
    { label: 'Publishing', id: 'publishing' },
  ],
  'scene-gen': [
    { label: 'SVG', id: 'sg-svg' },
    { label: 'Canvas 2D', id: 'sg-canvas' },
    { label: 'D3', id: 'sg-d3' },
    { label: 'Three.js', id: 'sg-three' },
    { label: 'Motion / Anime.js', id: 'sg-motion' },
    { label: 'Lottie', id: 'sg-lottie' },
    { label: 'Zdog', id: 'sg-zdog' },
  ],
  'media-av': [
    { label: 'Text-to-speech', id: 'tts' },
    { label: 'Custom audio', id: 'custom-audio' },
    { label: 'Video generation', id: 'video-gen' },
  ],
  'media-avatar': [
    { label: 'HeyGen avatars', id: 'heygen' },
    { label: 'Avatar options', id: 'avatar-options' },
    { label: 'Voices', id: 'avatar-voices' },
  ],
  resources: [
    { label: 'Agent skill', id: 'res-skill' },
    { label: 'REST API', id: 'res-api' },
    { label: 'UI components', id: 'res-ui' },
  ],
}

/* ── Getting Started Content ── */

function GettingStartedContent() {
  return (
    <>
      <div className="docs-breadcrumb">Getting Started</div>
      <h1>Cench Studio Documentation</h1>

      <div className="docs-blockquote">
        &ldquo;AI-powered animated explainer video creation&mdash;from your editor, your terminal, or the app.&rdquo;
      </div>

      <p>
        Cench Studio generates animated video scenes from natural language prompts. Describe what you want in plain
        English and get self-contained, animated HTML scenes rendered at <strong>1920&times;1080</strong> with seekable
        GSAP timelines, exportable to MP4 or publishable as interactive embeds with branching, hotspots, quizzes, and
        variable-driven navigation.
      </p>

      <h2 id="four-ways">Four ways to use Cench Studio</h2>

      <div className="docs-table-wrapper">
        <table className="docs-table">
          <thead>
            <tr>
              <th>Method</th>
              <th>Best for</th>
              <th>How it works</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>App UI</strong>
              </td>
              <td>Visual editing, previewing, exporting</td>
              <td>
                Open <code>localhost:3000</code>, use the built-in editor with chat panel, timeline, and layers
              </td>
            </tr>
            <tr>
              <td>
                <strong>Agent Skill</strong>
              </td>
              <td>Claude Code, Cursor, Antigravity</td>
              <td>
                Run <code>/cench</code> in your AI coding assistant&mdash;it reads the project rules and generates
                scenes directly
              </td>
            </tr>
            <tr>
              <td>
                <strong>REST API</strong>
              </td>
              <td>Scripts, CI/CD, custom integrations</td>
              <td>
                Call generation endpoints with <code>curl</code> or any HTTP client, persist via scene CRUD
              </td>
            </tr>
            <tr>
              <td>
                <strong>Agent API</strong>
              </td>
              <td>Building custom AI workflows</td>
              <td>
                Stream SSE from <code>/api/agent</code>&mdash;a multi-agent system with tool use, routing, and thinking
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3>App UI</h3>
      <p>
        The editor at <code>localhost:3000</code> is a 3-panel workspace: scene list on the left, preview canvas with
        timeline in the center, and a tabbed editor on the right. The editor tabs include a <strong>Chat panel</strong>{' '}
        for AI-assisted generation, a <strong>Layers tab</strong> for managing scene layers, media, and style settings,
        and an <strong>Interact tab</strong> for adding branching and hotspot logic.
      </p>
      <p>
        Type a prompt in the chat panel and the agent generates scene code, writes the HTML file, and updates the
        preview in real time. You can select model tiers (Fast / Balanced / Performance), choose thinking modes, and
        enable or disable specific tools like image generation, TTS, or avatars.
      </p>

      <h3>Agent Skill (Claude Code, Cursor, Antigravity)</h3>
      <p>
        The <code>/cench</code> skill turns any AI coding assistant into a scene generator. It works with{' '}
        <strong>Claude Code</strong>, <strong>Cursor</strong>, <strong>Antigravity</strong>, and any tool that supports
        the <code>.claude/skills/</code> convention.
      </p>
      <p>
        When you run <code>/cench</code>, the assistant loads the skill definition and rule files from{' '}
        <code>.claude/skills/cench/</code>, plans the scene structure, generates the code following strict rendering
        rules, and POSTs to <code>/api/scene</code> to persist. The dev server must be running at{' '}
        <code>localhost:3000</code>.
      </p>
      <p>
        The skill includes type-specific rules for SVG, Canvas 2D, D3, Three.js, Motion, and Zdog&mdash;covering
        animation timing, text rendering, safe areas, seeded randomness, and GSAP timeline integration. These rules are
        enforced, not suggested.
      </p>
      <p>
        After scenes are generated, open <code>http://localhost:3000</code> to preview them in the editor with full
        playback controls, timeline scrubbing, and layer management.
      </p>

      <h3>REST API</h3>
      <p>
        Seven generation endpoints accept a <code>prompt</code> and return generated code. A separate scene CRUD
        endpoint persists scenes to the database and writes HTML files. See the <strong>Quickstart</strong> for a
        step-by-step walkthrough with <code>curl</code>.
      </p>
      <p>
        Once you save a scene via <code>POST /api/scene</code>, it&rsquo;s immediately available to preview at{' '}
        <code>http://localhost:3000/scenes/{'{id}'}.html</code> in your browser, or open the full editor at{' '}
        <code>http://localhost:3000</code> to see it in context with timeline, layers, and playback.
      </p>

      <h3>Agent API</h3>
      <p>
        <code>POST /api/agent</code> is a Server-Sent Events endpoint that streams a full multi-agent execution. A
        Haiku-powered router decides which specialized agent handles the request: <strong>Director</strong> (multi-scene
        planning), <strong>Scene-Maker</strong> (single scene generation), <strong>Editor</strong> (surgical edits), or{' '}
        <strong>DoP</strong> (global style changes). Agents call tools that mutate world state, and changes stream back
        as SSE events.
      </p>

      <h2 id="scene-types">Scene types</h2>

      <div className="docs-table-wrapper">
        <table className="docs-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Endpoint</th>
              <th>Output</th>
              <th>Best for</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>svg</code>
              </td>
              <td>
                <code>/api/generate</code>
              </td>
              <td>SVG XML string</td>
              <td>Diagrams, icons, illustrated explanations</td>
            </tr>
            <tr>
              <td>
                <code>canvas2d</code>
              </td>
              <td>
                <code>/api/generate-canvas</code>
              </td>
              <td>JavaScript code</td>
              <td>Particle systems, generative art, hand-drawn style</td>
            </tr>
            <tr>
              <td>
                <code>d3</code>
              </td>
              <td>
                <code>/api/generate-d3</code>
              </td>
              <td>
                <code>{'{ styles, sceneCode, suggestedData }'}</code>
              </td>
              <td>Charts, graphs, data-driven visualizations</td>
            </tr>
            <tr>
              <td>
                <code>three</code>
              </td>
              <td>
                <code>/api/generate-three</code>
              </td>
              <td>
                <code>{'{ sceneCode }'}</code>
              </td>
              <td>3D objects, PBR materials, camera animation</td>
            </tr>
            <tr>
              <td>
                <code>motion</code>
              </td>
              <td>
                <code>/api/generate-motion</code>
              </td>
              <td>
                <code>{'{ styles, htmlContent, sceneCode }'}</code>
              </td>
              <td>DOM animations, text reveals, UI mockups</td>
            </tr>
            <tr>
              <td>
                <code>lottie</code>
              </td>
              <td>
                <code>/api/generate-lottie</code>
              </td>
              <td>SVG XML string</td>
              <td>Overlay annotations on Lottie animations</td>
            </tr>
            <tr>
              <td>
                <code>zdog</code>
              </td>
              <td>&mdash;</td>
              <td>JavaScript code</td>
              <td>Pseudo-3D illustrations, isometric graphics</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p>
        All generation endpoints share a common request shape: <code>prompt</code> (required), <code>palette</code>{' '}
        (optional 4-color hex array), <code>duration</code> (seconds, default 8), and <code>previousSummary</code> (for
        visual continuity across scenes).
      </p>

      <h2 id="how-scenes-work">How scenes work</h2>

      <p>
        Each scene becomes a self-contained HTML file at <code>/public/scenes/{'{id}'}.html</code>. The file bundles all
        dependencies (GSAP, fonts, renderer libraries) and can be opened in a browser or embedded in an iframe.
      </p>

      <p>
        Animations are driven by a GSAP master timeline (<code>window.__tl</code>) making them pausable, seekable, and
        frame-accurate for MP4 export via Puppeteer + FFmpeg.
      </p>

      <p>
        Scenes belong to <strong>projects</strong>. A project is a container for an ordered sequence of scenes. Projects
        support two output modes: <code>mp4</code> for traditional video export, or <code>interactive</code> for hosted
        embeds with branching logic, clickable hotspots, quiz elements, and variable-driven navigation. Interactive
        projects use a scene graph instead of a linear timeline.
      </p>

      <p>Every scene HTML has access to these globals:</p>

      <CodeBlock lang="javascript">{`WIDTH = 1920          // viewport width
HEIGHT = 1080         // viewport height
PALETTE = [...]       // 4-color array from style preset
DURATION = 8          // scene duration in seconds
ROUGHNESS = 0-3       // roughness level from preset
FONT = 'Caveat'       // font family from preset
TOOL = 'marker'       // drawing tool from preset
STROKE_COLOR = '#...' // primary stroke color`}</CodeBlock>

      <h2 id="style-presets">Style presets</h2>

      <p>
        Style presets configure renderer preference, roughness, drawing tool, stroke color, and background texture. Set
        via <code>globalStyle</code> when creating a project or through the Layers tab in the app UI.
      </p>

      <div className="docs-table-wrapper">
        <table className="docs-table">
          <thead>
            <tr>
              <th>Preset</th>
              <th>Look</th>
              <th>Renderer</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>whiteboard</code>
              </td>
              <td>Hand-drawn marker on white</td>
              <td>canvas2d</td>
            </tr>
            <tr>
              <td>
                <code>chalkboard</code>
              </td>
              <td>Chalk on dark green</td>
              <td>canvas2d</td>
            </tr>
            <tr>
              <td>
                <code>blueprint</code>
              </td>
              <td>Technical drawing on blue</td>
              <td>canvas2d</td>
            </tr>
            <tr>
              <td>
                <code>clean</code>
              </td>
              <td>Minimal vector graphics</td>
              <td>svg</td>
            </tr>
            <tr>
              <td>
                <code>data-story</code>
              </td>
              <td>Data viz with clean axes</td>
              <td>d3</td>
            </tr>
            <tr>
              <td>
                <code>newspaper</code>
              </td>
              <td>Editorial, serif typography</td>
              <td>svg</td>
            </tr>
            <tr>
              <td>
                <code>neon</code>
              </td>
              <td>Glowing lines on dark</td>
              <td>svg</td>
            </tr>
            <tr>
              <td>
                <code>kraft</code>
              </td>
              <td>Brown paper texture</td>
              <td>canvas2d</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 id="env-setup">Environment setup</h2>

      <p>
        Cench Studio currently runs locally in development mode with no authentication. This is temporary&mdash;hosted
        deployment with auth is coming soon. Configure API keys as environment variables in <code>.env</code>:
      </p>

      <h3>AI &amp; Generation</h3>

      <div className="docs-table-wrapper">
        <table className="docs-table">
          <thead>
            <tr>
              <th>Variable</th>
              <th>Required</th>
              <th>Used by</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>ANTHROPIC_API_KEY</code>
              </td>
              <td>Yes</td>
              <td>All scene generation (SVG, Canvas, D3, Three.js, Motion, Lottie) + agent system</td>
            </tr>
            <tr>
              <td>
                <code>OPENAI_API_KEY</code>
              </td>
              <td>No</td>
              <td>DALL-E 3 image generation</td>
            </tr>
            <tr>
              <td>
                <code>FAL_KEY</code>
              </td>
              <td>No</td>
              <td>Flux, Ideogram, Recraft, Stable Diffusion image generation</td>
            </tr>
            <tr>
              <td>
                <code>GOOGLE_AI_KEY</code>
              </td>
              <td>No</td>
              <td>Veo3 AI video generation</td>
            </tr>
            <tr>
              <td>
                <code>HEYGEN_API_KEY</code>
              </td>
              <td>No</td>
              <td>AI avatar talking-head video generation</td>
            </tr>
            <tr>
              <td>
                <code>ELEVENLABS_API_KEY</code>
              </td>
              <td>No</td>
              <td>Text-to-speech narration</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3>Database &amp; Infrastructure</h3>

      <div className="docs-table-wrapper">
        <table className="docs-table">
          <thead>
            <tr>
              <th>Variable</th>
              <th>Required</th>
              <th>Used by</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>DATABASE_URL</code>
              </td>
              <td>Yes</td>
              <td>PostgreSQL connection string</td>
            </tr>
            <tr>
              <td>
                <code>NEXT_PUBLIC_APP_URL</code>
              </td>
              <td>No</td>
              <td>
                Public app URL (defaults to <code>localhost:3000</code>)
              </td>
            </tr>
            <tr>
              <td>
                <code>NEXT_PUBLIC_RENDER_SERVER_URL</code>
              </td>
              <td>No</td>
              <td>
                MP4 render server URL (defaults to <code>localhost:3001</code>)
              </td>
            </tr>
            <tr>
              <td>
                <code>STORAGE_MODE</code>
              </td>
              <td>No</td>
              <td>
                <code>local</code> or <code>cloud</code> (S3-compatible storage)
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p>
        Start the dev server with <code>npm run dev</code>. The app runs at <code>http://localhost:3000</code>. For MP4
        export, also start the render server in <code>render-server/</code>.
      </p>

      <h2 id="conventions">Conventions</h2>

      <p>
        All endpoints accept and return JSON with <code>Content-Type: application/json</code>. Generation endpoints
        include a <code>usage</code> object with token counts and cost:
      </p>

      <CodeBlock lang="json">{`{
  "result": "...",
  "usage": {
    "input_tokens": 1420,
    "output_tokens": 3850,
    "cost_usd": 0.062
  }
}`}</CodeBlock>

      <p>
        Cost: <strong>$3/M input tokens</strong>, <strong>$15/M output tokens</strong> (Claude Sonnet pricing). Errors
        return standard HTTP codes with a JSON <code>error</code> field.
      </p>
    </>
  )
}

/* ── Quickstart Content ── */

function QuickstartContent() {
  return (
    <>
      <div className="docs-breadcrumb">Getting Started / Quickstart</div>
      <h1>Quickstart</h1>

      <div className="docs-blockquote">
        &ldquo;Pick your workflow&mdash;visual editor, AI coding assistant, HTTP API, or agent SDK.&rdquo;
      </div>

      <h2 id="qs-prereqs">Prerequisites</h2>

      <p>Clone the repo and install dependencies:</p>

      <CodeBlock lang="bash">{`git clone https://github.com/cench/cench-studio.git
cd cench-studio
npm install`}</CodeBlock>

      <p>Set up your environment variables. At minimum you need an Anthropic API key and a PostgreSQL database:</p>

      <CodeBlock lang="bash">{`cp .env.example .env
# Edit .env and set:
#   ANTHROPIC_API_KEY=sk-ant-...
#   DATABASE_URL=postgresql://...`}</CodeBlock>

      <p>Set up the database and start the dev server:</p>

      <CodeBlock lang="bash">{`npm run db:start     # Start PostgreSQL via Docker
npm run db:migrate   # Apply database schema
npm run dev          # Start at http://localhost:3000`}</CodeBlock>

      <p>
        Open <code>http://localhost:3000</code> to verify the app is running. You&rsquo;re ready to create scenes using
        any of the four methods below.
      </p>

      {/* ── App UI ── */}

      <h2 id="qs-app-ui">Using the App UI</h2>

      <p>
        The fastest way to get started. Open <code>http://localhost:3000</code> in your browser.
      </p>

      <h3>1. Create a project</h3>
      <p>
        Click the <strong>+</strong> button in the left sidebar or use the Projects panel to create a new project.
        Choose a name and output mode (<code>mp4</code> for video export, <code>interactive</code> for hosted embeds).
      </p>

      <h3>2. Open the Chat panel</h3>
      <p>
        In the right panel, select the <strong>Prompt</strong> tab. This opens the agent chat interface. You can
        configure:
      </p>
      <ul>
        <li>
          <strong>Model tier</strong> &mdash; Auto, Fast (Haiku), Balanced (Sonnet), Performance (Opus)
        </li>
        <li>
          <strong>Thinking mode</strong> &mdash; Off, Adaptive, Deep
        </li>
        <li>
          <strong>Agent</strong> &mdash; Auto-routed, or force Director / Scene-Maker / Editor / DoP
        </li>
        <li>
          <strong>Tools</strong> &mdash; Enable/disable SVG, Canvas, D3, Three.js, images, TTS, avatars
        </li>
      </ul>

      <h3>3. Describe your scene</h3>
      <p>
        Type a natural language prompt and press Enter. The agent generates code, writes the HTML file, and the preview
        updates in real time.
      </p>

      <CodeBlock lang="text">{`Create an animated bar chart showing quarterly revenue
growing from $2M to $8M, with bars rising sequentially`}</CodeBlock>

      <h3>4. Refine and export</h3>
      <p>
        Use the chat to make edits: <em>&ldquo;Make the bars blue instead of red&rdquo;</em> or{' '}
        <em>&ldquo;Add a title at the top&rdquo;</em>. The Editor agent handles surgical changes. When ready, click{' '}
        <strong>Export</strong> for MP4 or <strong>Publish</strong> for an interactive embed.
      </p>

      {/* ── Agent Skill ── */}

      <h2 id="qs-agent-skill">Using the Agent Skill</h2>

      <p>
        The <code>/cench</code> skill works in <strong>Claude Code</strong>, <strong>Cursor</strong>,{' '}
        <strong>Antigravity</strong>, and any AI coding tool that supports the <code>.claude/skills/</code> convention.
      </p>

      <h3>1. Ensure the server is running</h3>

      <CodeBlock lang="bash">{`npm run dev
# Server must be at localhost:3000`}</CodeBlock>

      <h3>2. Run the skill</h3>
      <p>
        In your AI coding assistant, type <code>/cench</code> followed by your prompt:
      </p>

      <CodeBlock lang="text">{`/cench A 3-scene explainer about how photosynthesis works,
whiteboard style, 8 seconds per scene`}</CodeBlock>

      <h3>3. What happens behind the scenes</h3>
      <p>
        The skill loads <code>.claude/skills/cench/SKILL.md</code> and the type-specific rule files (
        <code>rules/svg.md</code>, <code>rules/canvas2d.md</code>, etc.). It then:
      </p>
      <ul>
        <li>
          Verifies the dev server is running via <code>GET /api/projects</code>
        </li>
        <li>
          Plans the scene structure in a <code>{'<planning>'}</code> block (topic, renderer choices, durations,
          narrative arc)
        </li>
        <li>Generates code for each scene following strict rendering rules</li>
        <li>
          POSTs each scene to <code>/api/scene</code> with the project ID
        </li>
      </ul>

      <h3>4. Key rules the skill enforces</h3>
      <ul>
        <li>
          All randomness uses seeded PRNG (<code>mulberry32</code>), never <code>Math.random()</code>
        </li>
        <li>Text appears as complete words/phrases, never character-by-character</li>
        <li>
          Animations use GSAP timeline (<code>window.__tl</code>), no <code>requestAnimationFrame</code>
        </li>
        <li>
          Duration calculated as <code>max(6, wordCount / 2.5 + 3)</code> seconds
        </li>
        <li>Scene IDs are lowercase-hyphenated with timestamp suffix</li>
      </ul>

      <p>
        After generation, open <code>localhost:3000</code> to preview and refine the scenes in the app UI.
      </p>

      {/* ── REST API ── */}

      <h2 id="qs-rest-api">Using the REST API</h2>

      <p>For scripts, CI/CD pipelines, or custom integrations. Three calls to go from prompt to preview.</p>

      <h3>1. Create a project</h3>

      <CodeBlock lang="bash">{`curl -X POST http://localhost:3000/api/projects \\
  -H "Content-Type: application/json" \\
  -d '{"name": "API Demo", "outputMode": "mp4"}'`}</CodeBlock>

      <CodeBlock lang="json">{`{
  "id": "a1b2c3d4-5678-90ab-cdef-1234567890ab",
  "name": "API Demo",
  "outputMode": "mp4",
  "createdAt": "2026-03-27T12:00:00.000Z"
}`}</CodeBlock>

      <h3>2. Generate a scene</h3>

      <CodeBlock lang="bash">{`curl -X POST http://localhost:3000/api/generate \\
  -H "Content-Type: application/json" \\
  -d '{
    "prompt": "Animated bar chart showing Q1-Q4 revenue growth",
    "palette": ["#1a1a2e", "#16213e", "#0f3460", "#e94560"],
    "duration": 8
  }'`}</CodeBlock>

      <CodeBlock lang="json">{`{
  "result": "<svg viewBox=\\"0 0 1920 1080\\" ...>...</svg>",
  "usage": {
    "input_tokens": 1420,
    "output_tokens": 3850,
    "cost_usd": 0.062
  }
}`}</CodeBlock>

      <h3>3. Save to project</h3>

      <CodeBlock lang="bash">{`curl -X POST http://localhost:3000/api/scene \\
  -H "Content-Type: application/json" \\
  -d '{
    "projectId": "a1b2c3d4-...",
    "name": "Revenue Growth",
    "type": "svg",
    "generatedCode": "<svg viewBox=\\"0 0 1920 1080\\"...>...</svg>",
    "duration": 8
  }'`}</CodeBlock>

      <CodeBlock lang="json">{`{
  "success": true,
  "scene": {
    "id": "f9e8d7c6-...",
    "name": "Revenue Growth",
    "previewUrl": "/scenes/f9e8d7c6-....html"
  }
}`}</CodeBlock>

      <p>
        Open <code>http://localhost:3000/scenes/{'{id}'}.html</code> to preview. Use <code>PATCH /api/scene</code> to
        update code, or pass <code>previousSummary</code> to the next generation call for visual continuity across
        scenes.
      </p>

      <h3>Other generation endpoints</h3>

      <div className="docs-table-wrapper">
        <table className="docs-table">
          <thead>
            <tr>
              <th>Endpoint</th>
              <th>Example prompt</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>/api/generate-canvas</code>
              </td>
              <td>Particle system simulating falling snow</td>
            </tr>
            <tr>
              <td>
                <code>/api/generate-d3</code>
              </td>
              <td>Line chart of monthly active users over 12 months</td>
            </tr>
            <tr>
              <td>
                <code>/api/generate-three</code>
              </td>
              <td>Rotating 3D globe with highlighted continents</td>
            </tr>
            <tr>
              <td>
                <code>/api/generate-motion</code>
              </td>
              <td>Cinematic text reveal: &ldquo;Welcome to Cench Studio&rdquo;</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Agent API ── */}

      <h2 id="qs-agent-api">Using the Agent API</h2>

      <p>
        For building custom AI workflows on top of Cench Studio. The agent API is a Server-Sent Events endpoint that
        streams a multi-turn, multi-agent execution.
      </p>

      <h3>1. Send a message</h3>

      <CodeBlock lang="bash">{`curl -N -X POST http://localhost:3000/api/agent \\
  -H "Content-Type: application/json" \\
  -d '{
    "message": "Create a 3-scene explainer about the water cycle",
    "scenes": [],
    "globalStyle": {},
    "projectName": "Water Cycle",
    "outputMode": "mp4",
    "projectId": "a1b2c3d4-..."
  }'`}</CodeBlock>

      <h3>2. Stream SSE events</h3>
      <p>The response is a Server-Sent Events stream. Events include:</p>

      <div className="docs-table-wrapper">
        <table className="docs-table">
          <thead>
            <tr>
              <th>Event type</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>thinking_token</code>
              </td>
              <td>Streamed thinking content from extended thinking</td>
            </tr>
            <tr>
              <td>
                <code>state_change</code>
              </td>
              <td>World state mutation&mdash;scenes added, edited, or restyled</td>
            </tr>
            <tr>
              <td>
                <code>done</code>
              </td>
              <td>Agent complete with final text, tool calls, and changes</td>
            </tr>
            <tr>
              <td>
                <code>error</code>
              </td>
              <td>Error with message</td>
            </tr>
          </tbody>
        </table>
      </div>

      <CodeBlock lang="json">{`data: {"type":"state_change","changes":[{"tool":"create_scene","args":{"name":"Evaporation"}}],"updatedScenes":[...]}

data: {"type":"done","agentType":"director","modelId":"claude-sonnet-4-20250514","toolCalls":3}`}</CodeBlock>

      <h3>3. Advanced options</h3>

      <div className="docs-table-wrapper">
        <table className="docs-table">
          <thead>
            <tr>
              <th>Parameter</th>
              <th>Type</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>agentOverride</code>
              </td>
              <td>string</td>
              <td>
                Force a specific agent: <code>director</code>, <code>scene-maker</code>, <code>editor</code>,{' '}
                <code>dop</code>
              </td>
            </tr>
            <tr>
              <td>
                <code>modelTier</code>
              </td>
              <td>string</td>
              <td>
                <code>auto</code>, <code>fast</code> (Haiku), <code>balanced</code> (Sonnet), <code>performance</code>{' '}
                (Opus)
              </td>
            </tr>
            <tr>
              <td>
                <code>thinkingMode</code>
              </td>
              <td>string</td>
              <td>
                <code>adaptive</code>, <code>moderate</code>, <code>extended</code>
              </td>
            </tr>
            <tr>
              <td>
                <code>sceneContext</code>
              </td>
              <td>string</td>
              <td>
                <code>all</code>, <code>selected</code>, <code>auto</code>, or a specific scene ID
              </td>
            </tr>
            <tr>
              <td>
                <code>activeTools</code>
              </td>
              <td>string[]</td>
              <td>
                Filter available tools (e.g. <code>["svg", "canvas2d", "tts"]</code>)
              </td>
            </tr>
            <tr>
              <td>
                <code>history</code>
              </td>
              <td>object[]</td>
              <td>Previous conversation messages for multi-turn context</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Next Steps ── */}

      <h2 id="next-steps">Next steps</h2>

      <ul>
        <li>
          <strong>Scene Generation</strong> &mdash; Full request schema and parameters for each of the 6 renderers
        </li>
        <li>
          <strong>Scene CRUD</strong> &mdash; Update existing scenes with <code>PATCH</code>, manage layers, regenerate
          HTML
        </li>
        <li>
          <strong>Projects API</strong> &mdash; Configure style presets, output settings, scene ordering, and scene
          graph
        </li>
        <li>
          <strong>Export to MP4</strong> &mdash; Render your project to video via the Puppeteer + FFmpeg render server
        </li>
        <li>
          <strong>Media APIs</strong> &mdash; AI image generation, Veo3 video, HeyGen avatars, ElevenLabs TTS
        </li>
      </ul>
    </>
  )
}

/* ── Usage & Billing Content ── */

function UsageBillingContent() {
  return (
    <>
      <div className="docs-breadcrumb">Getting Started / Usage &amp; Billing</div>
      <h1>Usage &amp; Billing</h1>

      <div className="docs-blockquote">
        &ldquo;All rates below are temporary and subject to change as pricing evolves.&rdquo;
      </div>

      <p>
        Cench Studio passes API calls through to upstream providers. You pay the provider rates below directly via your
        own API keys. There is no markup.
      </p>

      <h2 id="llm-models">LLM models</h2>

      <p>
        These models power scene generation (SVG, Canvas, D3, Three.js, Motion, Lottie) and the multi-agent system.
        Anthropic models are enabled by default.
      </p>

      <h3>Anthropic (enabled by default)</h3>

      <div className="docs-table-wrapper">
        <table className="docs-table">
          <thead>
            <tr>
              <th>Model</th>
              <th>Tier</th>
              <th>Input</th>
              <th>Output</th>
              <th>Context</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>claude-haiku-4-5</code>
              </td>
              <td>Budget</td>
              <td>$0.80 / 1M</td>
              <td>$4.00 / 1M</td>
              <td>200K</td>
            </tr>
            <tr>
              <td>
                <code>claude-sonnet-4-5</code>
              </td>
              <td>Balanced</td>
              <td>$3.00 / 1M</td>
              <td>$15.00 / 1M</td>
              <td>200K</td>
            </tr>
            <tr>
              <td>
                <code>claude-opus-4-5</code>
              </td>
              <td>Performance</td>
              <td>$15.00 / 1M</td>
              <td>$75.00 / 1M</td>
              <td>200K</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3>OpenAI (disabled by default)</h3>

      <div className="docs-table-wrapper">
        <table className="docs-table">
          <thead>
            <tr>
              <th>Model</th>
              <th>Tier</th>
              <th>Input</th>
              <th>Output</th>
              <th>Context</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>gpt-4o-mini</code>
              </td>
              <td>Budget</td>
              <td>$0.15 / 1M</td>
              <td>$0.60 / 1M</td>
              <td>128K</td>
            </tr>
            <tr>
              <td>
                <code>gpt-4o</code>
              </td>
              <td>Balanced</td>
              <td>$2.50 / 1M</td>
              <td>$10.00 / 1M</td>
              <td>128K</td>
            </tr>
            <tr>
              <td>
                <code>o1</code>
              </td>
              <td>Performance</td>
              <td>$15.00 / 1M</td>
              <td>$60.00 / 1M</td>
              <td>200K</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3>Google Gemini (disabled by default)</h3>

      <div className="docs-table-wrapper">
        <table className="docs-table">
          <thead>
            <tr>
              <th>Model</th>
              <th>Tier</th>
              <th>Input</th>
              <th>Output</th>
              <th>Context</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>gemini-3-flash</code>
              </td>
              <td>Budget</td>
              <td>$0.15 / 1M</td>
              <td>$0.60 / 1M</td>
              <td>1M</td>
            </tr>
            <tr>
              <td>
                <code>gemini-2.5-flash</code>
              </td>
              <td>Balanced</td>
              <td>$0.15 / 1M</td>
              <td>$3.50 / 1M</td>
              <td>1M</td>
            </tr>
            <tr>
              <td>
                <code>gemini-2.5-pro</code>
              </td>
              <td>Performance</td>
              <td>$2.50 / 1M</td>
              <td>$15.00 / 1M</td>
              <td>1M</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 id="image-gen-pricing">Image generation</h2>

      <p>
        Image generation uses your <code>FAL_KEY</code> or <code>OPENAI_API_KEY</code>. Costs are per image generated.
      </p>

      <div className="docs-table-wrapper">
        <table className="docs-table">
          <thead>
            <tr>
              <th>Model</th>
              <th>Provider</th>
              <th>Cost</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>flux-schnell</code>
              </td>
              <td>Fal.ai</td>
              <td>$0.003</td>
            </tr>
            <tr>
              <td>
                <code>stable-diffusion-3</code>
              </td>
              <td>Fal.ai</td>
              <td>$0.03</td>
            </tr>
            <tr>
              <td>
                <code>recraft-v3</code>
              </td>
              <td>Fal.ai</td>
              <td>$0.04</td>
            </tr>
            <tr>
              <td>
                <code>dall-e-3</code>
              </td>
              <td>OpenAI</td>
              <td>$0.04</td>
            </tr>
            <tr>
              <td>
                <code>flux-1.1-pro</code>
              </td>
              <td>Fal.ai</td>
              <td>$0.05</td>
            </tr>
            <tr>
              <td>
                <code>ideogram-v3</code>
              </td>
              <td>Fal.ai</td>
              <td>$0.08</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p>
        Background removal adds <strong>$0.01</strong> per image when enabled. Available styles:{' '}
        <code>photorealistic</code>, <code>illustration</code>, <code>flat</code>, <code>sketch</code>, <code>3d</code>,{' '}
        <code>pixel</code>, <code>watercolor</code>.
      </p>

      <h2 id="video-media-pricing">Video &amp; media</h2>

      <div className="docs-table-wrapper">
        <table className="docs-table">
          <thead>
            <tr>
              <th>Service</th>
              <th>Provider</th>
              <th>Cost</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>AI avatar video</td>
              <td>HeyGen</td>
              <td>~$0.01 / second</td>
            </tr>
            <tr>
              <td>AI video generation</td>
              <td>Google Veo 3</td>
              <td>~$0.50&ndash;$2.00 / clip</td>
            </tr>
            <tr>
              <td>Text-to-speech</td>
              <td>ElevenLabs</td>
              <td>~$0.01&ndash;$0.10 / segment</td>
            </tr>
            <tr>
              <td>Background removal</td>
              <td>Fal.ai</td>
              <td>$0.01 / image</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 id="local-models">Local models</h2>

      <p>
        Cench Studio supports local inference via <strong>Ollama</strong> at zero cost. Local models are disabled by
        default&mdash;enable them in Settings &gt; Models &amp; API.
      </p>

      <div className="docs-table-wrapper">
        <table className="docs-table">
          <thead>
            <tr>
              <th>Model</th>
              <th>ID</th>
              <th>Endpoint</th>
              <th>Cost</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Llama 3.1 8B</td>
              <td>
                <code>ollama/llama3.1:8b</code>
              </td>
              <td>
                <code>localhost:11434</code>
              </td>
              <td>Free</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p>
        To use local models, install{' '}
        <a href="https://ollama.com" target="_blank" rel="noopener">
          Ollama
        </a>{' '}
        and pull the model: <code>ollama pull llama3.1:8b</code>. Local models work best for the Editor and DoP agents
        (smaller, faster tasks) but may produce lower quality results for scene generation compared to Claude Sonnet.
      </p>

      <h2 id="permissions">Permissions</h2>

      <p>
        All paid APIs (image generation, avatars, video, TTS) require permission before the agent can use them.
        Configure permission mode per API in Settings &gt; Permissions:
      </p>

      <div className="docs-table-wrapper">
        <table className="docs-table">
          <thead>
            <tr>
              <th>Mode</th>
              <th>Behavior</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>always_ask</code>
              </td>
              <td>Prompt for approval on every request (default)</td>
            </tr>
            <tr>
              <td>
                <code>ask_once</code>
              </td>
              <td>Ask once per session, then remember the decision</td>
            </tr>
            <tr>
              <td>
                <code>always_allow</code>
              </td>
              <td>Automatic approval, no prompts</td>
            </tr>
            <tr>
              <td>
                <code>always_deny</code>
              </td>
              <td>API completely disabled</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p>You can also set spend limits per API:</p>

      <ul>
        <li>
          <strong>Session limit</strong> &mdash; Maximum USD spend per browser session
        </li>
        <li>
          <strong>Monthly limit</strong> &mdash; Maximum USD spend per calendar month
        </li>
      </ul>

      <p>
        Spend is tracked automatically via the <code>/api/permissions</code> endpoint. The agent calls{' '}
        <code>request_permission</code> before any paid API call, which checks your configured mode and spend limits
        before proceeding.
      </p>

      <h2 id="rate-limits">Rate limits</h2>

      <p>
        Cench Studio does not impose its own rate limits. You are subject to the rate limits of the upstream providers
        (Anthropic, OpenAI, Fal.ai, HeyGen, ElevenLabs, Google). Check each provider&rsquo;s documentation for their
        current limits.
      </p>

      <p>
        All rates and limits on this page are temporary and subject to change as the platform evolves. We recommend
        monitoring your usage via the Settings &gt; Usage panel in the app, or by calling <code>GET /api/usage</code>.
      </p>
    </>
  )
}

/* ── Use Cench: App UI ── */

function UseAppUIContent() {
  return (
    <>
      <div className="docs-breadcrumb">Use Cench / App UI</div>
      <h1>App UI</h1>
      <div className="docs-blockquote">
        &ldquo;A visual editor with AI chat, timeline, and real-time preview.&rdquo;
      </div>

      <h2 id="editor-layout">Editor layout</h2>
      <p>
        The editor is a 3-panel workspace at <code>localhost:3000</code>:
      </p>
      <ul>
        <li>
          <strong>Left panel</strong> &mdash; Scene list with drag-and-drop reordering, project switcher, and settings
        </li>
        <li>
          <strong>Center panel</strong> &mdash; Preview canvas with playback controls, zoom/pan, and timeline scrubber
        </li>
        <li>
          <strong>Right panel</strong> &mdash; Tabbed editor with Prompt (chat), Layers, and Interact tabs
        </li>
      </ul>

      <h2 id="chat-panel">Chat panel</h2>
      <p>
        The Prompt tab is an AI chat interface. Describe what you want and the agent generates or edits scenes in real
        time. Configure:
      </p>
      <ul>
        <li>
          <strong>Model tier</strong> &mdash; Auto, Fast (Haiku), Balanced (Sonnet), Performance (Opus)
        </li>
        <li>
          <strong>Thinking mode</strong> &mdash; Off, Adaptive, Deep
        </li>
        <li>
          <strong>Agent</strong> &mdash; Auto-routed, or force Director / Scene-Maker / Editor / DoP
        </li>
        <li>
          <strong>Tools</strong> &mdash; Toggle SVG, Canvas, D3, Three.js, images, TTS, avatars, video
        </li>
      </ul>
      <p>
        Messages stream in real time showing thinking tokens, tool calls with arguments, and usage stats. You can rate
        responses with thumbs up/down.
      </p>

      <h2 id="layers-settings">Layers &amp; settings</h2>
      <p>The Layers tab controls per-scene settings:</p>
      <ul>
        <li>
          <strong>Scene settings</strong> &mdash; Duration, background color, scene-to-scene transitions (full FFmpeg
          xfade library in the Transitions section)
        </li>
        <li>
          <strong>Style preset</strong> &mdash; Whiteboard, chalkboard, blueprint, clean, etc.
        </li>
        <li>
          <strong>Media layers</strong> &mdash; Video layer, audio layer (upload or TTS), AI layers (avatars, Veo3)
        </li>
        <li>
          <strong>Content objects</strong> &mdash; Text overlays, SVG objects, stickers
        </li>
      </ul>

      <h2 id="timeline">Timeline</h2>
      <p>The bottom timeline shows all scenes as horizontal blocks with a draggable playhead. Supports:</p>
      <ul>
        <li>
          <strong>Track view</strong> &mdash; Linear scene sequence with layer tracks (text, audio, video)
        </li>
        <li>
          <strong>Graph view</strong> &mdash; Scene dependency graph for interactive mode
        </li>
        <li>
          <strong>Zoom</strong> &mdash; Fit-to-all, zoom in/out, auto-scroll during playback
        </li>
      </ul>
      <p>The project auto-saves every 30 seconds to the database.</p>
    </>
  )
}

/* ── Use Cench: Agent ── */

function UseAgentContent() {
  return (
    <>
      <div className="docs-breadcrumb">Use Cench / Agent</div>
      <h1>Agent Skill</h1>
      <div className="docs-blockquote">
        &ldquo;Run <code>/cench</code> in Claude Code, Cursor, or Antigravity to generate scenes from your
        editor.&rdquo;
      </div>

      <h2 id="cench-skill">The /cench skill</h2>
      <p>
        The <code>/cench</code> skill works in any AI coding tool that supports <code>.claude/skills/</code>. It turns
        your editor into a scene generator that reads project rules, plans structure, generates code, and persists
        scenes via the API.
      </p>

      <h2 id="skill-how">How it works</h2>
      <p>
        When you run <code>/cench</code> with a prompt, the assistant:
      </p>
      <ul>
        <li>
          Verifies the dev server is running at <code>localhost:3000</code>
        </li>
        <li>
          Loads <code>.claude/skills/cench/SKILL.md</code> and type-specific rule files
        </li>
        <li>
          Outputs a <code>{'<planning>'}</code> block (topic, audience, renderers, durations, narrative arc)
        </li>
        <li>Generates scene code following strict rules per renderer type</li>
        <li>
          POSTs each scene to <code>/api/scene</code> with project ID
        </li>
      </ul>
      <p>
        After generation, open <code>localhost:3000</code> to preview with full playback and editing.
      </p>

      <h2 id="skill-tools">Supported tools</h2>
      <p>The skill has rule files for every renderer:</p>
      <div className="docs-table-wrapper">
        <table className="docs-table">
          <thead>
            <tr>
              <th>Rule file</th>
              <th>Covers</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>rules/core.md</code>
              </td>
              <td>Universal rules (canvas size, randomness, text, timing, safe area)</td>
            </tr>
            <tr>
              <td>
                <code>rules/svg.md</code>
              </td>
              <td>SVG structure, layer order, animation classes</td>
            </tr>
            <tr>
              <td>
                <code>rules/canvas2d.md</code>
              </td>
              <td>Canvas patterns, drawing functions, seeded PRNG</td>
            </tr>
            <tr>
              <td>
                <code>rules/d3.md</code>
              </td>
              <td>D3 chart types, data binding, styling</td>
            </tr>
            <tr>
              <td>
                <code>rules/three.md</code>
              </td>
              <td>Three.js r128 constraints, materials, lighting</td>
            </tr>
            <tr>
              <td>
                <code>rules/motion.md</code>
              </td>
              <td>CSS/Anime.js choreography</td>
            </tr>
            <tr>
              <td>
                <code>rules/zdog.md</code>
              </td>
              <td>Zdog pseudo-3D library</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 id="skill-types">Scene type selection</h2>
      <div className="docs-table-wrapper">
        <table className="docs-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Best for</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>svg</code>
              </td>
              <td>Diagrams, infographics, concept maps, draw-on effects</td>
            </tr>
            <tr>
              <td>
                <code>canvas2d</code>
              </td>
              <td>Particle systems, generative art, physics, hand-drawn style</td>
            </tr>
            <tr>
              <td>
                <code>d3</code>
              </td>
              <td>Charts, graphs, data-driven visualizations</td>
            </tr>
            <tr>
              <td>
                <code>three</code>
              </td>
              <td>3D geometry, product visualization, spatial concepts</td>
            </tr>
            <tr>
              <td>
                <code>motion</code>
              </td>
              <td>Rich CSS layouts, card animations, text-heavy scenes</td>
            </tr>
            <tr>
              <td>
                <code>lottie</code>
              </td>
              <td>Overlay annotations on Lottie animations</td>
            </tr>
            <tr>
              <td>
                <code>zdog</code>
              </td>
              <td>Pseudo-3D illustrations, isometric graphics</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        Key enforced rules: seeded randomness (<code>mulberry32</code>), no character-by-character text animation, GSAP
        timeline for all animation, duration calculated as <code>max(6, wordCount / 2.5 + 3)</code>.
      </p>
    </>
  )
}

/* ── Use Cench: API ── */

function UseAPIContent() {
  return (
    <>
      <div className="docs-breadcrumb">Use Cench / API</div>
      <h1>REST API</h1>
      <div className="docs-blockquote">&ldquo;Generate scenes, manage projects, and export videos via HTTP.&rdquo;</div>

      <h2 id="gen-endpoints">Generation endpoints</h2>
      <p>
        All generation endpoints are <code>POST</code> and accept <code>prompt</code>, <code>palette</code>,{' '}
        <code>duration</code>, and <code>previousSummary</code>.
      </p>
      <div className="docs-table-wrapper">
        <table className="docs-table">
          <thead>
            <tr>
              <th>Endpoint</th>
              <th>Output</th>
              <th>Returns</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>/api/generate</code>
              </td>
              <td>SVG XML</td>
              <td>
                <code>{'{ result: string, usage }'}</code>
              </td>
            </tr>
            <tr>
              <td>
                <code>/api/generate-canvas</code>
              </td>
              <td>JS code</td>
              <td>
                <code>{'{ result: string, usage }'}</code>
              </td>
            </tr>
            <tr>
              <td>
                <code>/api/generate-d3</code>
              </td>
              <td>D3 bundle</td>
              <td>
                <code>{'{ result: { styles, sceneCode, suggestedData }, usage }'}</code>
              </td>
            </tr>
            <tr>
              <td>
                <code>/api/generate-three</code>
              </td>
              <td>Three.js code</td>
              <td>
                <code>{'{ result: { sceneCode }, usage }'}</code>
              </td>
            </tr>
            <tr>
              <td>
                <code>/api/generate-motion</code>
              </td>
              <td>Motion bundle</td>
              <td>
                <code>{'{ result: { styles, htmlContent, sceneCode }, usage }'}</code>
              </td>
            </tr>
            <tr>
              <td>
                <code>/api/generate-lottie</code>
              </td>
              <td>SVG overlay</td>
              <td>
                <code>{'{ result: string, usage }'}</code>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 id="scene-crud">Scene CRUD</h2>
      <div className="docs-table-wrapper">
        <table className="docs-table">
          <thead>
            <tr>
              <th>Method</th>
              <th>Path</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>GET</code>
              </td>
              <td>
                <code>/api/scene?projectId=X</code>
              </td>
              <td>List scenes (no code, fast)</td>
            </tr>
            <tr>
              <td>
                <code>GET</code>
              </td>
              <td>
                <code>/api/scene?projectId=X&amp;sceneId=Y</code>
              </td>
              <td>Single scene with full code</td>
            </tr>
            <tr>
              <td>
                <code>POST</code>
              </td>
              <td>
                <code>/api/scene</code>
              </td>
              <td>Create scene (writes HTML to disk)</td>
            </tr>
            <tr>
              <td>
                <code>PATCH</code>
              </td>
              <td>
                <code>/api/scene</code>
              </td>
              <td>Update scene code + regenerate HTML</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        Preview any scene at <code>http://localhost:3000/scenes/{'{id}'}.html</code>.
      </p>

      <h2 id="projects-api">Projects</h2>
      <div className="docs-table-wrapper">
        <table className="docs-table">
          <thead>
            <tr>
              <th>Method</th>
              <th>Path</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>GET</code>
              </td>
              <td>
                <code>/api/projects</code>
              </td>
              <td>List all projects (limit 50)</td>
            </tr>
            <tr>
              <td>
                <code>POST</code>
              </td>
              <td>
                <code>/api/projects</code>
              </td>
              <td>Create project with name, outputMode, globalStyle</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 id="agent-api-sse">Agent API (SSE)</h2>
      <p>
        <code>POST /api/agent</code> streams a multi-agent execution via Server-Sent Events.
      </p>
      <CodeBlock lang="json">{`{
  "message": "Create 3 scenes about the water cycle",
  "scenes": [],
  "globalStyle": {},
  "projectName": "Water Cycle",
  "outputMode": "mp4",
  "projectId": "...",
  "modelTier": "balanced",
  "thinkingMode": "adaptive"
}`}</CodeBlock>
      <p>
        SSE events: <code>thinking_token</code>, <code>state_change</code>, <code>done</code>, <code>error</code>. The{' '}
        <code>state_change</code> event carries updated scenes and global style for real-time UI updates.
      </p>
    </>
  )
}

/* ── Agent Behavior ── */

function AgentBehaviorContent() {
  return (
    <>
      <div className="docs-breadcrumb">Agent Behavior</div>
      <h1>Agents &amp; Tools</h1>
      <div className="docs-blockquote">
        &ldquo;A multi-agent system with specialized roles, tool use, and configurable models.&rdquo;
      </div>

      <h2 id="agent-types">Agent types</h2>
      <p>A Haiku-powered router automatically selects the right agent for each request:</p>
      <div className="docs-table-wrapper">
        <table className="docs-table">
          <thead>
            <tr>
              <th>Agent</th>
              <th>Role</th>
              <th>Default model</th>
              <th>Triggers</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>Director</strong>
              </td>
              <td>Multi-scene planning, narrative arcs</td>
              <td>Sonnet</td>
              <td>&ldquo;create a video about&rdquo;, 3+ scenes</td>
            </tr>
            <tr>
              <td>
                <strong>Scene-Maker</strong>
              </td>
              <td>Single scene generation</td>
              <td>Sonnet</td>
              <td>&ldquo;add a scene&rdquo;, &ldquo;new scene&rdquo;</td>
            </tr>
            <tr>
              <td>
                <strong>Editor</strong>
              </td>
              <td>Surgical edits to existing scenes</td>
              <td>Haiku</td>
              <td>&ldquo;change the color&rdquo;, &ldquo;move&rdquo;, &ldquo;fix&rdquo;</td>
            </tr>
            <tr>
              <td>
                <strong>DoP</strong>
              </td>
              <td>Global visual style across all scenes</td>
              <td>Haiku</td>
              <td>&ldquo;make everything&rdquo;, &ldquo;color palette&rdquo;</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 id="building-agents">Building agents</h2>
      <p>
        Each agent receives a system prompt defining its role, available tools, and the current world state (scenes,
        global style, project settings). The agent loop runs up to 10 tool-call iterations before stopping.
      </p>
      <p>
        World state is compressed to fit token budgets: scene summaries (name, type, duration, layer count) plus full
        code only for the selected scene. Max world state: 2000 tokens, full scene context: 3000 tokens.
      </p>

      <h2 id="custom-prompts">Customizing prompts</h2>
      <p>
        System prompts live in <code>lib/agents/prompts.ts</code>. Each agent has a base prompt with role definition,
        principles, and constraints. The Scene-Maker also receives dynamic style guidance based on the active preset
        (roughness, tool, stroke color, texture).
      </p>
      <p>Key constraints enforced across all agents:</p>
      <ul>
        <li>No character-by-character text animation</li>
        <li>
          Seeded randomness only (<code>mulberry32</code>)
        </li>
        <li>GSAP timeline for all animation</li>
        <li>
          Duration formula: <code>max(6, wordCount / 2.5 + 3)</code>
        </li>
      </ul>

      <h2 id="agent-models">Models</h2>
      <p>Override models per agent via model tiers:</p>
      <div className="docs-table-wrapper">
        <table className="docs-table">
          <thead>
            <tr>
              <th>Tier</th>
              <th>Director</th>
              <th>Scene-Maker</th>
              <th>Editor</th>
              <th>DoP</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>auto</code>
              </td>
              <td>Sonnet</td>
              <td>Sonnet</td>
              <td>Haiku</td>
              <td>Haiku</td>
            </tr>
            <tr>
              <td>
                <code>fast</code>
              </td>
              <td>Haiku</td>
              <td>Haiku</td>
              <td>Haiku</td>
              <td>Haiku</td>
            </tr>
            <tr>
              <td>
                <code>balanced</code>
              </td>
              <td>Sonnet</td>
              <td>Sonnet</td>
              <td>Sonnet</td>
              <td>Sonnet</td>
            </tr>
            <tr>
              <td>
                <code>performance</code>
              </td>
              <td>Opus</td>
              <td>Opus</td>
              <td>Sonnet</td>
              <td>Sonnet</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        OpenAI and Gemini models can be enabled in Settings &gt; Models &amp; API. Local Ollama models work for
        Editor/DoP tasks.
      </p>

      <h2 id="agent-tools">Tools</h2>
      <p>40+ tools organized by category:</p>
      <ul>
        <li>
          <strong>Scene tools</strong> (7) &mdash; create, delete, duplicate, reorder, duration, background, transition
        </li>
        <li>
          <strong>Layer tools</strong> (8) &mdash; add, remove, reorder, opacity, visibility, timing, regenerate, patch
          code
        </li>
        <li>
          <strong>Element tools</strong> (7) &mdash; add/edit/delete text overlays, move, resize, reorder, timing
        </li>
        <li>
          <strong>Global style tools</strong> (4) &mdash; set global style, scene style, all transitions, roughness
        </li>
        <li>
          <strong>Media tools</strong> (7) &mdash; generate image/sticker/avatar/video, TTS, search/place images
        </li>
        <li>
          <strong>Template tools</strong> (3) &mdash; pick, use, and save scene templates
        </li>
        <li>
          <strong>Interaction tools</strong> (3) &mdash; add/edit interactions, connect scenes (interactive mode only)
        </li>
        <li>
          <strong>Parenting tools</strong> (2) &mdash; layer parent assignment, group layers
        </li>
        <li>
          <strong>Export tools</strong> (2) &mdash; export MP4, publish interactive
        </li>
      </ul>
      <p>
        Media tools require a <code>request_permission</code> call before use, enforcing spend limits and user approval.
      </p>

      <h2 id="personalization">Personalization</h2>
      <p>Customize agent behavior through:</p>
      <ul>
        <li>
          <strong>Style presets</strong> &mdash; 8 presets that auto-configure roughness, tool, stroke color, texture
        </li>
        <li>
          <strong>Tool filtering</strong> &mdash; Enable/disable tool categories via <code>activeTools</code>
        </li>
        <li>
          <strong>Tool presets</strong> &mdash; Whiteboard (SVG+Canvas only), Full Production (all tools), Budget Mode
          (no paid APIs), Offline (local models)
        </li>
        <li>
          <strong>Permission modes</strong> &mdash; Per-API control: always_ask, ask_once, always_allow, always_deny
        </li>
        <li>
          <strong>Spend limits</strong> &mdash; Session and monthly limits per API
        </li>
      </ul>
    </>
  )
}

/* ── Export: Standard ── */

function ExportStandardContent() {
  return (
    <>
      <div className="docs-breadcrumb">Export / Standard</div>
      <h1>MP4 Export</h1>
      <div className="docs-blockquote">&ldquo;Render your project to a video file via Puppeteer + FFmpeg.&rdquo;</div>

      <h2 id="mp4-flow">How MP4 export works</h2>
      <p>
        Export streams progress via SSE from <code>POST /api/export</code>, which proxies to the render server:
      </p>
      <ul>
        <li>Each scene HTML is loaded in headless Chrome via WebVideoCreator</li>
        <li>Rendered frame-by-frame at the configured resolution and FPS</li>
        <li>Individual scene MP4s are stitched together with FFmpeg</li>
        <li>Transitions (xfade: cuts, crossfades, wipes, slides, irises, etc.) are applied during stitching</li>
      </ul>

      <h2 id="mp4-settings">Settings</h2>
      <div className="docs-table-wrapper">
        <table className="docs-table">
          <thead>
            <tr>
              <th>Setting</th>
              <th>Options</th>
              <th>Default</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Resolution</td>
              <td>
                <code>720p</code> (1280&times;720), <code>1080p</code> (1920&times;1080), <code>4k</code>{' '}
                (3840&times;2160)
              </td>
              <td>
                <code>1080p</code>
              </td>
            </tr>
            <tr>
              <td>FPS</td>
              <td>
                <code>24</code>, <code>30</code>, <code>60</code>
              </td>
              <td>
                <code>30</code>
              </td>
            </tr>
            <tr>
              <td>Format</td>
              <td>
                <code>mp4</code> (H.264)
              </td>
              <td>
                <code>mp4</code>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 id="mp4-transitions">Transitions</h2>
      <p>
        Set per-scene via <code>set_transition</code>, the agent tools, or the Layers tab (grouped: Basics, Wipe, Slide,
        Smooth, Shape, Cover/reveal, Diagonal, Depth). Examples:
      </p>
      <ul>
        <li>
          <code>none</code> &mdash; Instant cut (concat path when every scene is cut; otherwise a 1-frame blend in the
          xfade chain)
        </li>
        <li>
          <code>crossfade</code> / <code>dissolve</code> &mdash; Soft blends (default blend duration 0.5s)
        </li>
        <li>
          <code>fade-black</code> / <code>fade-white</code> &mdash; Through black or white
        </li>
        <li>
          <code>wipe-*</code>, <code>slide-*</code>, <code>smooth-*</code> &mdash; Directional moves
        </li>
        <li>
          <code>circle-open</code>, <code>radial</code>, <code>vert-open</code>, <code>horz-open</code> &mdash; Iris and
          curtain-style
        </li>
        <li>
          <code>cover-*</code>, <code>reveal-*</code>, <code>diag-*</code>, <code>zoom-in</code>, <code>distance</code>{' '}
          &mdash; Stylized handoffs
        </li>
      </ul>
      <p>
        When every scene uses <code>none</code>, export uses FFmpeg concat (no re-encoding). Any blend uses the xfade
        filter.
      </p>

      <h2 id="render-server">Render server</h2>
      <p>
        The render server runs separately at <code>localhost:3001</code>:
      </p>
      <CodeBlock lang="bash">{`cd render-server
npm install
npm start`}</CodeBlock>
      <p>
        Requires Google Chrome installed locally. On Linux, renders in headless mode. On macOS/Windows, opens a visible
        Chrome window (headless is unreliable on these platforms).
      </p>
    </>
  )
}

/* ── Export: Interactive ── */

function ExportInteractiveContent() {
  return (
    <>
      <div className="docs-breadcrumb">Export / Interactive</div>
      <h1>Interactive Export</h1>
      <div className="docs-blockquote">
        &ldquo;Publish branching, interactive experiences with hotspots, quizzes, and variables.&rdquo;
      </div>

      <h2 id="scene-graph">Scene graph</h2>
      <p>
        Interactive projects use a scene graph instead of a linear timeline. The graph editor (bottom panel, Graph view)
        lets you connect scenes with conditional edges:
      </p>
      <ul>
        <li>
          <strong>Auto</strong> &mdash; Proceeds to next scene when current ends
        </li>
        <li>
          <strong>Hotspot</strong> &mdash; User clicks a region to jump
        </li>
        <li>
          <strong>Choice</strong> &mdash; Multiple-choice buttons, each linking to a scene
        </li>
        <li>
          <strong>Quiz</strong> &mdash; Correct/wrong answers branch to different scenes
        </li>
        <li>
          <strong>Gate</strong> &mdash; Pauses until user clicks continue
        </li>
        <li>
          <strong>Variable</strong> &mdash; Branch based on stored variable values
        </li>
      </ul>

      <h2 id="interaction-types">Interactions</h2>
      <p>Six interaction element types, positioned as percentage of viewport:</p>
      <div className="docs-table-wrapper">
        <table className="docs-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Description</th>
              <th>Branches?</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>Hotspot</strong>
              </td>
              <td>Clickable region (circle/rect/pill) with pulse/glow/border style</td>
              <td>Yes</td>
            </tr>
            <tr>
              <td>
                <strong>Choice</strong>
              </td>
              <td>Multiple-choice buttons with optional question</td>
              <td>Yes</td>
            </tr>
            <tr>
              <td>
                <strong>Quiz</strong>
              </td>
              <td>Single-answer quiz with correct/wrong branching</td>
              <td>Yes</td>
            </tr>
            <tr>
              <td>
                <strong>Gate</strong>
              </td>
              <td>Pause button with optional minimum watch time</td>
              <td>No</td>
            </tr>
            <tr>
              <td>
                <strong>Tooltip</strong>
              </td>
              <td>Hover/click info overlay</td>
              <td>No</td>
            </tr>
            <tr>
              <td>
                <strong>Form</strong>
              </td>
              <td>Text/select/radio inputs that set variables</td>
              <td>Optional</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 id="variables">Variables</h2>
      <p>
        Variables persist across scene transitions. Set by Form inputs, used in edge conditions and HTML interpolation (
        <code>{'{varName}'}</code> tokens replaced at runtime).
      </p>

      <h2 id="player-settings">Player settings</h2>
      <div className="docs-table-wrapper">
        <table className="docs-table">
          <thead>
            <tr>
              <th>Setting</th>
              <th>Options</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Theme</td>
              <td>
                <code>dark</code>, <code>light</code>, <code>transparent</code>
              </td>
            </tr>
            <tr>
              <td>Brand color</td>
              <td>Hex color for buttons and progress bar</td>
            </tr>
            <tr>
              <td>Progress bar</td>
              <td>Show/hide</td>
            </tr>
            <tr>
              <td>Scene nav</td>
              <td>Show/hide dot navigation</td>
            </tr>
            <tr>
              <td>Fullscreen</td>
              <td>Allow/disallow</td>
            </tr>
            <tr>
              <td>Autoplay</td>
              <td>Start playing on load</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 id="publishing">Publishing</h2>
      <p>
        Click <strong>Publish</strong> to generate a hosted embed at <code>/v/{'{projectId}'}</code>. Publishing creates
        a <code>manifest.json</code> with the scene graph, player options, and scene HTML files. Each publish
        auto-increments the version number.
      </p>
    </>
  )
}

/* ── Scene Generation ── */

function SceneGenContent() {
  return (
    <>
      <div className="docs-breadcrumb">Scene Generation</div>
      <h1>Renderers &amp; Types</h1>
      <div className="docs-blockquote">
        &ldquo;Seven rendering engines, each optimized for a different visual style.&rdquo;
      </div>

      <h2 id="sg-svg">SVG</h2>
      <p>
        Endpoint: <code>POST /api/generate</code>. Returns raw SVG XML with embedded CSS/SMIL animations.
      </p>
      <ul>
        <li>
          ViewBox: <code>0 0 1920 1080</code>
        </li>
        <li>Layer order: background &rarr; midground &rarr; foreground &rarr; text</li>
        <li>
          Animation classes: <code>stroke</code>, <code>fadein</code>, <code>scale</code>, <code>slide-up</code>,{' '}
          <code>slide-left</code>, <code>bounce</code>, <code>rotate</code>
        </li>
        <li>
          GSAP timeline integration via <code>window.__tl</code>
        </li>
      </ul>
      <p>
        Extra params: <code>enhance</code> (rewrite prompt), <code>summarize</code> (generate summary),{' '}
        <code>edit</code> + <code>editInstruction</code> + <code>svgContent</code> (modify existing SVG).
      </p>

      <h2 id="sg-canvas">Canvas 2D</h2>
      <p>
        Endpoint: <code>POST /api/generate-canvas</code>. Returns raw JavaScript code targeting{' '}
        <code>document.getElementById(&apos;c&apos;)</code>.
      </p>
      <ul>
        <li>
          Drawing functions: <code>animateRoughLine</code>, <code>animateRoughCircle</code>,{' '}
          <code>animateRoughRect</code>, <code>animateRoughArrow</code>, <code>drawText</code>
        </li>
        <li>Tools: pen, marker, chalk, brush, highlighter</li>
        <li>Textures: grain, paper, chalk, lines (applied once, not in loop)</li>
        <li>
          All randomness via seeded <code>mulberry32</code>
        </li>
      </ul>
      <p>
        Extra param: <code>bgColor</code> (canvas background).
      </p>

      <h2 id="sg-d3">D3</h2>
      <p>
        Endpoint: <code>POST /api/generate-d3</code>. Returns <code>{'{ styles, sceneCode, suggestedData }'}</code>.
      </p>
      <ul>
        <li>D3 v7 available as global</li>
        <li>
          Chart container: <code>#chart</code> div
        </li>
        <li>
          Extra globals: <code>DATA</code>, <code>AXIS_COLOR</code>, <code>GRID_COLOR</code>
        </li>
        <li>GSAP preferred over D3 transitions</li>
      </ul>
      <p>
        Extra param: <code>d3Data</code> (pass your own dataset).
      </p>

      <h2 id="sg-three">Three.js</h2>
      <p>
        Endpoint: <code>POST /api/generate-three</code>. Returns <code>{'{ sceneCode }'}</code>.
      </p>
      <ul>
        <li>THREE global (r128), no ES module imports</li>
        <li>
          Preset materials: <code>MATERIALS.plastic</code>, <code>metal</code>, <code>glass</code>, <code>matte</code>,{' '}
          <code>glow</code>
        </li>
        <li>No CapsuleGeometry (not in r128), no OrbitControls from modules</li>
        <li>
          Must include <code>preserveDrawingBuffer: true</code>
        </li>
      </ul>

      <h2 id="sg-motion">Motion / Anime.js</h2>
      <p>
        Endpoint: <code>POST /api/generate-motion</code>. Returns <code>{'{ styles, htmlContent, sceneCode }'}</code>.
      </p>
      <ul>
        <li>Motion library v11 (ES module imports) + Anime.js (global)</li>
        <li>
          All elements start at <code>opacity: 0</code>, animated in via JS
        </li>
        <li>
          Use <code>anime()</code> with delays for sequencing (no timeline)
        </li>
      </ul>

      <h2 id="sg-lottie">Lottie</h2>
      <p>
        Endpoint: <code>POST /api/generate-lottie</code>. Returns SVG overlay XML for annotating Lottie animations.
      </p>
      <ul>
        <li>Lottie player already integrated on page</li>
        <li>Overlays are sparse annotations, not the animation itself</li>
        <li>
          Available classes: <code>stroke</code>, <code>fadein</code> with draw/pop keyframes
        </li>
      </ul>

      <h2 id="sg-zdog">Zdog</h2>
      <p>
        Pseudo-3D rendering engine for isometric illustrations. Generated via the agent skill, no dedicated REST
        endpoint.
      </p>
    </>
  )
}

/* ── Audio & Video ── */

function MediaAVContent() {
  return (
    <>
      <div className="docs-breadcrumb">Scene Generation / Audio &amp; Video</div>
      <h1>Audio &amp; Video</h1>

      <h2 id="tts">Text-to-speech</h2>
      <p>
        <code>POST /api/tts</code> generates narration via ElevenLabs.
      </p>
      <CodeBlock lang="json">{`{
  "text": "Welcome to this explanation of photosynthesis.",
  "sceneId": "scene-01",
  "voiceId": "21m00Tcm4TlvDq8ikWAM"
}`}</CodeBlock>
      <p>
        Default voice: Rachel (clear, neutral). Voice settings: stability 0.5, similarity boost 0.75. Output saved as
        MP3 at <code>/uploads/tts-{'{sceneId}'}.mp3</code>.
      </p>

      <h2 id="custom-audio">Custom audio</h2>
      <p>
        Upload MP3 or WAV files via <code>POST /api/upload</code> (multipart, max 100MB). Configure per scene:
      </p>
      <ul>
        <li>
          <strong>Volume</strong> &mdash; 0&ndash;100%
        </li>
        <li>
          <strong>Fade in / fade out</strong> &mdash; Toggle on/off
        </li>
        <li>
          <strong>Start offset</strong> &mdash; Delay in seconds before audio begins
        </li>
      </ul>
      <p>
        Set via the Layers tab in the UI or the <code>set_audio_layer</code> agent tool.
      </p>

      <h2 id="video-gen">Video generation</h2>
      <p>
        <code>POST /api/generate-video</code> creates clips via Google Veo 3 (async with polling).
      </p>
      <CodeBlock lang="json">{`{
  "prompt": "Aerial drone shot of ocean waves at sunset",
  "aspectRatio": "16:9",
  "duration": 8,
  "enhancePrompt": true
}`}</CodeBlock>
      <p>
        Returns an <code>operationName</code> for polling via <code>GET /api/generate-video?operationName=...</code>.
        Clips are 5 or 8 seconds. Best for atmospheric backgrounds and b-roll, not diagrams or talking heads.
      </p>
    </>
  )
}

/* ── Avatars ── */

function MediaAvatarContent() {
  return (
    <>
      <div className="docs-breadcrumb">Scene Generation / Avatars</div>
      <h1>Avatars</h1>

      <h2 id="heygen">HeyGen avatars</h2>
      <p>
        <code>POST /api/generate-avatar</code> creates AI talking-head videos. Async with polling via{' '}
        <code>GET /api/generate-avatar?videoId=...</code>.
      </p>
      <CodeBlock lang="json">{`{
  "avatarId": "josh_lite3_20230714",
  "voiceId": "2d5b0e6cf36f460aa7fc47e3eee4ba54",
  "script": "Let me explain how photosynthesis works.",
  "width": 512,
  "height": 512,
  "bgColor": "#00FF00"
}`}</CodeBlock>
      <p>Default background is green (#00FF00) for chroma key removal. Cost: ~$0.01 per second of generated video.</p>

      <h2 id="avatar-options">Avatar options</h2>
      <p>
        List available avatars via <code>GET</code> through the <code>list_avatars</code> agent tool (results cached 24
        hours). Each avatar has a preview image and optional preview video.
      </p>

      <h2 id="avatar-voices">Voices</h2>
      <p>
        HeyGen provides a voice catalog with language, gender, and preview audio. Voices are also cached for 24 hours.
        Use the <code>voiceId</code> from the catalog when generating an avatar.
      </p>
      <p>
        Avatar layers in scenes support: positioning (x, y), sizing, opacity, z-index ordering, background removal, and
        start time offset.
      </p>
    </>
  )
}

/* ── Resources ── */

function ResourcesContent() {
  return (
    <>
      <div className="docs-breadcrumb">Resources</div>
      <h1>SDKs &amp; Components</h1>

      <h2 id="res-skill">Agent skill</h2>
      <p>
        The <code>/cench</code> skill at <code>.claude/skills/cench/</code> is the primary SDK for AI coding assistants.
        It includes:
      </p>
      <ul>
        <li>
          <code>SKILL.md</code> &mdash; Main skill definition with pre-flight checks, planning, and generation workflow
        </li>
        <li>
          <code>rules/*.md</code> &mdash; Type-specific rendering rules (7 files: core, svg, canvas2d, d3, three,
          motion, zdog)
        </li>
      </ul>
      <p>
        Works with Claude Code, Cursor, Antigravity, and any tool supporting <code>.claude/skills/</code>.
      </p>

      <h2 id="res-api">REST API</h2>
      <p>The HTTP API is the foundation for all integrations. Key packages:</p>
      <ul>
        <li>
          <code>@anthropic-ai/sdk</code> &mdash; Claude API for scene generation and agent system
        </li>
        <li>
          <code>openai</code> &mdash; OpenAI for DALL-E 3 image generation
        </li>
        <li>
          <code>@google/genai</code> &mdash; Google Gemini + Veo 3
        </li>
        <li>
          <code>@fal-ai/serverless-client</code> &mdash; Fal.ai for Flux, Ideogram, Recraft, SD3
        </li>
      </ul>
      <p>
        There is no standalone npm SDK package. Integrate by calling the REST endpoints directly from any language or
        framework.
      </p>

      <h2 id="res-ui">UI components</h2>
      <p>The app is built with React + Next.js + Tailwind. Key components:</p>
      <ul>
        <li>
          <code>components/Editor.tsx</code> &mdash; Main editor layout with resizable panels
        </li>
        <li>
          <code>components/AgentChat.tsx</code> &mdash; Chat interface with streaming, tool calls, usage stats
        </li>
        <li>
          <code>components/PreviewPlayer.tsx</code> &mdash; Scene preview with GSAP timeline control
        </li>
        <li>
          <code>components/SceneEditor.tsx</code> &mdash; Tabbed editor (Prompt, Layers, Interact)
        </li>
        <li>
          <code>components/timeline/SceneTrack.tsx</code> &mdash; Timeline track visualization
        </li>
        <li>
          <code>lib/store.ts</code> &mdash; Zustand store with full editor state
        </li>
      </ul>
      <p>State management uses Zustand with localStorage persistence and auto-save to PostgreSQL every 30 seconds.</p>
    </>
  )
}

/* ── Main Component ── */

export default function DocsPage() {
  const [dark, setDark] = useState(true)
  const [activeSection, setActiveSection] = useState<Section>('getting-started')
  const [activeTocId, setActiveTocId] = useState<string>('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const mainRef = useRef<HTMLElement>(null)

  const toc = tocBySection[activeSection]

  // Reset scroll and active TOC on section change
  useEffect(() => {
    mainRef.current?.scrollTo(0, 0)
    setActiveTocId(toc[0]?.id ?? '')
  }, [activeSection, toc])

  // Cmd+K to open search, Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setSearchOpen(true)
        setSearchQuery('')
      }
      if (e.key === 'Escape') {
        setSearchOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Track which h2 is currently in view via IntersectionObserver
  useEffect(() => {
    const scrollContainer = mainRef.current
    if (!scrollContainer) return

    const ids = toc.map((t) => t.id)
    const elements = ids.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[]
    if (elements.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the topmost visible heading
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible.length > 0) {
          setActiveTocId(visible[0].target.id)
        }
      },
      {
        root: scrollContainer,
        rootMargin: '-10% 0px -70% 0px',
        threshold: 0,
      },
    )

    elements.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [toc, activeSection])

  const handleTocClick = useCallback((id: string) => {
    setActiveTocId(id)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  return (
    <div className={`docs-layout${dark ? '' : ' docs-light'}`}>
      {/* Left Sidebar */}
      <aside className="docs-sidebar">
        <div className="docs-sidebar-header">
          <div className="docs-logo">
            <Image src="/cench-logo.png" alt="Cench Studio" width={52} height={52} className="docs-logo-img" />
          </div>
          <button className="docs-theme-toggle" onClick={() => setDark((d) => !d)} aria-label="Toggle theme">
            <span className={`docs-theme-toggle-option${!dark ? ' active' : ''}`}>
              <IconSun />
            </span>
            <span className={`docs-theme-toggle-option${dark ? ' active' : ''}`}>
              <IconMoon />
            </span>
            <span className="docs-theme-toggle-thumb" style={{ left: dark ? 'calc(50% - 2px)' : '2px' }} />
          </button>
        </div>

        <div
          className="docs-search"
          onClick={() => {
            setSearchOpen(true)
            setSearchQuery('')
          }}
        >
          <span className="docs-search-icon">
            <IconSearch />
          </span>
          <input className="docs-search-input" type="text" placeholder="Search..." readOnly />
          <span className="docs-search-shortcut">&#8984;K</span>
        </div>

        <nav className="docs-nav">
          {navSections.map((section) => (
            <div className="docs-nav-section" key={section.title}>
              <div className="docs-nav-section-title">{section.title}</div>
              <ul className="docs-nav-list">
                {section.items.map((item) => (
                  <li className="docs-nav-item" key={item.label}>
                    <a
                      className={`docs-nav-link${item.section === activeSection ? ' active' : ''}`}
                      href="#"
                      onClick={(e) => {
                        e.preventDefault()
                        if (item.section) setActiveSection(item.section)
                      }}
                    >
                      {item.badge && (
                        <span className={`docs-badge docs-badge-${item.badge.variant}`}>{item.badge.text}</span>
                      )}
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="docs-sidebar-footer">
          <a className="docs-sidebar-footer-link" href="#">
            Contact Us <IconExternal />
          </a>
          <a className="docs-sidebar-footer-link" href="#">
            Get Started <IconExternal />
          </a>
        </div>
      </aside>

      {/* Main Content */}
      <main className="docs-main" ref={mainRef}>
        <div className="docs-content-wrapper">
          <article className="docs-content">
            {activeSection === 'getting-started' && <GettingStartedContent />}
            {activeSection === 'quickstart' && <QuickstartContent />}
            {activeSection === 'usage-billing' && <UsageBillingContent />}
            {activeSection === 'use-app-ui' && <UseAppUIContent />}
            {activeSection === 'use-agent' && <UseAgentContent />}
            {activeSection === 'use-api' && <UseAPIContent />}
            {activeSection === 'agent-behavior' && <AgentBehaviorContent />}
            {activeSection === 'export-standard' && <ExportStandardContent />}
            {activeSection === 'export-interactive' && <ExportInteractiveContent />}
            {activeSection === 'scene-gen' && <SceneGenContent />}
            {activeSection === 'media-av' && <MediaAVContent />}
            {activeSection === 'media-avatar' && <MediaAvatarContent />}
            {activeSection === 'resources' && <ResourcesContent />}

            {/* Footer */}
            <footer className="docs-footer">
              <div className="docs-footer-row">
                <div className="docs-footer-left">
                  <div className="docs-footer-logo">
                    <Image src="/cench-logo.png" alt="Cench" width={36} height={36} className="docs-logo-img" />
                  </div>
                  <span className="docs-footer-copyright">&copy; 2026 Cench Studio</span>
                </div>
                <div className="docs-footer-socials">
                  <a className="docs-footer-social" href="#" aria-label="GitHub">
                    <IconGitHub />
                  </a>
                  <a className="docs-footer-social" href="#" aria-label="X">
                    <IconX />
                  </a>
                </div>
              </div>
            </footer>
          </article>

          {/* Right TOC */}
          <aside className="docs-toc">
            <div className="docs-toc-title">
              <IconList />
              On this page
            </div>
            <ul className="docs-toc-list">
              <div
                className="docs-toc-indicator"
                style={{
                  top: `${
                    Math.max(
                      0,
                      toc.findIndex((t) => t.id === activeTocId),
                    ) * 28
                  }px`,
                }}
              />
              {toc.map((item) => (
                <li key={item.id}>
                  <a
                    className={`docs-toc-link${activeTocId === item.id ? ' active' : ''}`}
                    href={`#${item.id}`}
                    onClick={(e) => {
                      e.preventDefault()
                      handleTocClick(item.id)
                    }}
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </main>

      {/* Search Overlay */}
      {searchOpen && (
        <div className="docs-search-overlay" onClick={() => setSearchOpen(false)}>
          <div className="docs-search-modal" onClick={(e) => e.stopPropagation()}>
            <div className="docs-search-modal-input-row">
              <span className="docs-search-modal-icon">
                <IconSearch />
              </span>
              <input
                className="docs-search-modal-input"
                type="text"
                placeholder="Search documentation..."
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <kbd className="docs-search-modal-esc" onClick={() => setSearchOpen(false)}>
                esc
              </kbd>
            </div>
            {searchQuery.length === 0 && (
              <div className="docs-search-modal-empty">Type to search across all documentation pages.</div>
            )}
            {searchQuery.length > 0 && (
              <div className="docs-search-modal-empty">No results for &ldquo;{searchQuery}&rdquo;</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
