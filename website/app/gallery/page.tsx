import Image from 'next/image'
import { Send } from 'lucide-react'
import { sairaStencil } from '../fonts'

type UsedIcon =
  | { kind: 'image'; src: string; alt: string }
  | { kind: 'react'; alt: string }

const previewUsedIcons: UsedIcon[] = [
  { kind: 'image', src: '/logos/openai-black-monoblossom.svg', alt: 'OpenAI' },
  { kind: 'image', src: '/logos/google-gemini-icon-new.svg', alt: 'Gemini' },
  { kind: 'react', alt: 'React' },
  { kind: 'image', src: '/logos/threejs-logo.svg', alt: 'Three.js' },
  { kind: 'image', src: '/logos/heygen-symbol-blue-logo.svg', alt: 'HeyGen' },
]

function ReactMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-[#38bdf8]" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none" />
      <ellipse cx="12" cy="12" rx="8.6" ry="3.6" />
      <ellipse cx="12" cy="12" rx="8.6" ry="3.6" transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="12" rx="8.6" ry="3.6" transform="rotate(120 12 12)" />
    </svg>
  )
}

export default function GalleryPage() {
  return (
    <div className="min-h-screen bg-bone text-[#0a0a0b]">
      <header className="relative z-10 border-b border-[#0a0a0b]/10 bg-[#ffffeb]/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
          <a href="/" className="flex items-center gap-2">
            <Image src="/cench2.0.svg" alt="Cench" width={34} height={34} />
            <span className={`${sairaStencil.className} text-base tracking-[0.08em] uppercase`}>Cench Studio</span>
          </a>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full border border-[#0a0a0b] bg-[#0a0a0b] px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#2a2a2d]"
            >
              Waitlist
              <Send size={14} strokeWidth={2} className="opacity-90" aria-hidden />
            </button>
            <button
              type="button"
              className="rounded-full border border-[#0a0a0b]/20 bg-white/70 px-4 py-1.5 text-xs font-semibold text-[#0a0a0b] transition-colors hover:bg-white"
            >
              Book demo
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 py-10 sm:py-12">
        <div className="mb-8 text-center sm:mb-10">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">Video Gallery</h1>
          <p className="mx-auto mt-3 max-w-3xl text-sm leading-relaxed text-[#0a0a0b]/70 sm:text-base">
            Real examples generated in Cench Studio, with each prompt and the app symbols used to create the result.
          </p>
        </div>

        <section className="mx-auto max-w-3xl">
          <article className="overflow-hidden rounded-2xl border border-[#0a0a0b]/10 bg-white/60 p-8 text-center shadow-[0_16px_42px_-20px_rgba(10,10,11,0.28)] backdrop-blur-sm sm:p-10">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Coming soon</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-[#0a0a0b]/70 sm:text-base">
              The full video gallery is on the way. We are curating the best examples with prompts and tool breakdowns.
            </p>
            <div className="mt-6 flex items-center justify-center gap-2">
              {previewUsedIcons.map((icon, idx) => (
                <span
                  key={`preview-icon-${idx}`}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[#0a0a0b]/10 bg-white/80 shadow-[0_6px_16px_-10px_rgba(10,10,11,0.3)]"
                >
                  {icon.kind === 'react' ? (
                    <ReactMark />
                  ) : (
                    <img src={icon.src} alt={icon.alt} className="h-4 w-4 object-contain" />
                  )}
                </span>
              ))}
            </div>
          </article>
        </section>
      </main>

      <footer className="relative z-10 border-t border-[#0a0a0b]/10 bg-[#ffffeb]/70 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-5 text-[#0a0a0b]/75 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Image src="/cench2.0.svg" alt="Cench" width={20} height={20} />
            <span className={`${sairaStencil.className} text-sm tracking-[0.08em] uppercase text-[#0a0a0b]`}>Cench Studio</span>
          </div>
          <nav className="flex items-center gap-5 text-sm font-medium">
            <a href="/docs" className="transition-colors hover:text-[#0a0a0b]">
              Docs
            </a>
            <a href="#" className="transition-colors hover:text-[#0a0a0b]">
              Privacy
            </a>
            <a href="#" className="transition-colors hover:text-[#0a0a0b]">
              Terms
            </a>
          </nav>
          <div className="flex items-center gap-4">
            <p className="text-xs font-medium text-[#0a0a0b]/55">Copyright &copy; 2026 Cench Studio</p>
            <a href="#" aria-label="Instagram" className="text-[#0a0a0b]/70 transition-colors hover:text-[#0a0a0b]">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
                <path d="M7.75 2h8.5A5.75 5.75 0 0 1 22 7.75v8.5A5.75 5.75 0 0 1 16.25 22h-8.5A5.75 5.75 0 0 1 2 16.25v-8.5A5.75 5.75 0 0 1 7.75 2zm8.5 1.5h-8.5A4.25 4.25 0 0 0 3.5 7.75v8.5A4.25 4.25 0 0 0 7.75 20.5h8.5a4.25 4.25 0 0 0 4.25-4.25v-8.5A4.25 4.25 0 0 0 16.25 3.5z" />
                <path d="M12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 1.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z" />
                <circle cx="17.35" cy="6.65" r="1.15" />
              </svg>
            </a>
            <a href="#" aria-label="X" className="text-[#0a0a0b]/70 transition-colors hover:text-[#0a0a0b]">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            <a href="#" aria-label="LinkedIn" className="text-[#0a0a0b]/70 transition-colors hover:text-[#0a0a0b]">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}

