'use client'

import { useState } from 'react'
import Image from 'next/image'

const videos = [
  { id: 'clouds-1', src: '/hero-sky-clouds.mp4', title: 'Sky Clouds' },
  { id: 'neural-1', src: '/neural-networks-explained.mp4', title: 'Neural Motion' },
  { id: 'clouds-2', src: '/hero-sky-clouds.mp4', title: 'Ambient Atmosphere' },
  { id: 'neural-2', src: '/neural-networks-explained.mp4', title: 'Tech Narrative' },
  { id: 'clouds-3', src: '/hero-sky-clouds.mp4', title: 'Cinematic Intro' },
  { id: 'neural-3', src: '/neural-networks-explained.mp4', title: 'Future UI' },
] as const

export default function CloudGlassPage() {
  const [prompt, setPrompt] = useState('')

  return (
    <div className="min-h-screen bg-[#070a13] text-white">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-5 sm:px-8">
        <a href="/cloud-glass" className="inline-flex items-center">
          <Image
            src="/cench2.0.svg"
            alt="Cench symbol"
            width={44}
            height={44}
            className="h-11 w-11 opacity-95 [filter:brightness(0)_invert(1)]"
          />
        </a>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            className="rounded-full border border-white/35 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition-colors hover:bg-white/12"
          >
            Book a demo
          </button>
          <button
            type="button"
            className="rounded-full border border-white/70 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[#070a13] transition-opacity hover:opacity-85"
          >
            Waitlist
          </button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col items-center px-6 pb-16 pt-8 sm:px-8 sm:pt-12">
        <h1 className="text-center text-3xl font-semibold tracking-tight text-white sm:text-5xl">
          Create any video you can imagine
        </h1>

        <section className="mt-8 w-full rounded-[26px] border border-white/20 bg-white/10 p-4 shadow-[0_24px_80px_-30px_rgba(0,0,0,0.65)] backdrop-blur-2xl sm:mt-10 sm:p-5">
          <div className="rounded-2xl border border-white/20 bg-black/30 p-3 sm:p-4">
            <label htmlFor="video-prompt" className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-white/70">
              Prompt
            </label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                id="video-prompt"
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe your video idea..."
                className="h-11 w-full rounded-xl border border-white/20 bg-white/10 px-4 text-sm text-white outline-none placeholder:text-white/55 focus:border-white/45"
              />
              <button
                type="button"
                className="h-11 shrink-0 rounded-xl border border-white/60 bg-white px-5 text-sm font-semibold text-[#070a13] transition-opacity hover:opacity-85"
              >
                Generate
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {videos.map((video) => (
              <article
                key={video.id}
                className="overflow-hidden rounded-2xl border border-white/20 bg-black/35 shadow-[0_12px_36px_-18px_rgba(0,0,0,0.8)]"
              >
                <video
                  className="aspect-video w-full bg-black object-cover"
                  src={video.src}
                  muted
                  loop
                  autoPlay
                  playsInline
                />
                <div className="border-t border-white/15 px-3 py-2.5">
                  <p className="text-sm font-medium text-white/90">{video.title}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
