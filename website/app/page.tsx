'use client'

import Image from 'next/image'
import { TiltImage } from './components/TiltImage'
import { UseCasesScroll } from './components/UseCasesScroll'

const agents = [
  { name: 'Director', desc: 'Multi-scene planning and narrative arc.', color: '#a855f7' },
  { name: 'Scene Maker', desc: 'Creates and regenerates full scenes.', color: '#3b82f6' },
  { name: 'Editor', desc: 'Surgical edits to timing, copy, and layers.', color: '#22c55e' },
  { name: 'DoP', desc: 'Global look: palette, type, transitions.', color: '#f97316' },
  { name: 'Specialists', desc: 'SVG, Canvas2D, D3, Three.js, Motion.', color: '#64748b' },
]

const models = [
  { label: 'Anthropic', items: ['Claude 4 Opus', 'Claude 4 Sonnet', 'Claude 3.5 Haiku'] },
  { label: 'Gemini', items: ['Gemini 2.5 Pro', 'Gemini 2.5 Flash', 'Gemini 2.0 Flash'] },
  { label: 'OpenAI', items: ['GPT-4.1', 'GPT-4o', 'o3', 'o4-mini'] },
  { label: 'Audio', items: ['ElevenLabs', 'OpenAI TTS', 'Google TTS', 'Cartesia'] },
  { label: 'Media Gen', items: ['Veo 3', 'Sora', 'Imagen 4', 'DALL-E 3', 'Flux 1.1 Pro'] },
  { label: 'Local', items: ['Ollama', 'LM Studio', 'Any OpenAI-compatible endpoint'] },
]

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Image src="/cenchhccenvch.png" alt="Cench" width={36} height={36} />
            <nav className="hidden sm:flex items-center gap-6">
              <a href="#animations" className="text-sm font-medium text-gray-600 hover:text-black transition-colors">Animations</a>
              <a href="#agents" className="text-sm font-medium text-gray-600 hover:text-black transition-colors">Agents</a>
              <a href="#docs" className="text-sm font-medium text-gray-600 hover:text-black transition-colors">Docs</a>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <a href="#signup" className="text-sm font-medium text-gray-600 hover:text-black transition-colors">Sign up</a>
            <a href="#get-started" className="bg-[#0a0a0b] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors">
              Get started
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-8">
        {/* Hero */}
        <section className="py-24 sm:py-32">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-5xl sm:text-6xl font-bold tracking-tight leading-[1.1]">
                Create videos<br />with prompts.
              </h1>
              <p className="mt-6 text-lg text-gray-500 max-w-md leading-relaxed">
                AI-powered animated video creation. From prompt to MP4, powered by agents.
              </p>
              <div className="mt-8 flex gap-3">
                <a href="#get-started" className="bg-[#0a0a0b] text-white text-sm font-semibold px-6 py-3 rounded-lg hover:bg-gray-800 transition-colors">
                  Get started
                </a>
                <a href="#docs" className="border border-gray-200 text-sm font-semibold px-6 py-3 rounded-lg hover:bg-gray-50 transition-colors">
                  Read docs
                </a>
              </div>
            </div>
            <div className="flex justify-center lg:justify-end">
              <TiltImage src="/cenchdisk.png" alt="Cench" />
            </div>
          </div>
        </section>

        {/* Screenshot */}
        <section className="pb-24">
          <Image
            src="/bettecc.png"
            alt="Cench Studio"
            width={1920}
            height={1080}
            className="w-full h-auto rounded-lg shadow-2xl"
            priority
          />
        </section>

        {/* Use it your way */}
        <UseCasesScroll />

        {/* Agents & Models */}
        <section id="agents" className="py-24">
          <div className="grid gap-16 md:grid-cols-2">
            {/* Agents */}
            <div>
              <h2 className="text-2xl font-bold mb-2">Agents.</h2>
              <p className="text-gray-500 text-sm mb-6">Five built-in agents orchestrate every video. Or bring your own via the open API.</p>
              <div className="flex flex-col">
                {agents.map((a) => (
                  <div key={a.name} className="flex items-start gap-3 border-b border-gray-100 py-3">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: a.color }} />
                    <div>
                      <span className="text-sm font-semibold">{a.name}</span>
                      <span className="ml-2 text-sm text-gray-500">{a.desc}</span>
                    </div>
                  </div>
                ))}
                <div className="flex items-start gap-3 py-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gray-300" />
                  <div>
                    <span className="text-sm font-semibold text-gray-400">Your agent</span>
                    <span className="ml-2 text-sm text-gray-400">Connect any MCP-compatible agent via the open API.</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Models */}
            <div>
              <h2 className="text-2xl font-bold mb-2">Models.</h2>
              <p className="text-gray-500 text-sm mb-6">Route automatically or pin any model per scene.</p>
              <div className="flex flex-col">
                {models.map((g) => (
                  <details key={g.label} className="group border-b border-gray-100">
                    <summary className="flex cursor-pointer list-none items-center justify-between py-3 [&::-webkit-details-marker]:hidden">
                      <span className="text-sm font-semibold">{g.label}</span>
                      <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3 text-gray-400 transition-transform group-open:rotate-180" aria-hidden>
                        <path d="M2 4l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </summary>
                    <ul className="pb-3 flex flex-col gap-1">
                      {g.items.map((item) => (
                        <li key={item} className="flex items-center gap-2 text-sm text-gray-500">
                          <span className="h-1 w-1 rounded-full bg-gray-300" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </details>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8">
        <div className="max-w-6xl mx-auto px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Image src="/blacklogo.png" alt="Cench" width={20} height={20} />
            <span className="text-sm text-gray-500">&copy; 2025 Cench. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#" className="text-sm text-gray-500 hover:text-black transition-colors">X</a>
            <a href="#" className="text-sm text-gray-500 hover:text-black transition-colors">GitHub</a>
            <a href="#" className="text-sm text-gray-500 hover:text-black transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
