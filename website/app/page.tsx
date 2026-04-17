import Image from 'next/image'
import { Send } from 'lucide-react'
import { sairaStencil } from './fonts'

function AttachImageIcon() {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21.1935 16.793C20.8437 19.2739 20.6689 20.5143 19.7717 21.2572C18.8745 22 17.5512 22 14.9046 22H9.09536C6.44881 22 5.12553 22 4.22834 21.2572C3.33115 20.5143 3.15626 19.2739 2.80648 16.793L2.38351 13.793C1.93748 10.6294 1.71447 9.04765 2.66232 8.02383C3.61017 7 5.29758 7 8.67239 7H15.3276C18.7024 7 20.3898 7 21.3377 8.02383C22.0865 8.83268 22.1045 9.98979 21.8592 12" />
      <path d="M19.5617 7C19.7904 5.69523 18.7863 4.5 17.4617 4.5H6.53788C5.21323 4.5 4.20922 5.69523 4.43784 7" />
      <path d="M17.4999 4.5C17.5283 4.24092 17.5425 4.11135 17.5427 4.00435C17.545 2.98072 16.7739 2.12064 15.7561 2.01142C15.6497 2 15.5194 2 15.2588 2H8.74099C8.48035 2 8.35002 2 8.24362 2.01142C7.22584 2.12064 6.45481 2.98072 6.45704 4.00434C6.45727 4.11135 6.47146 4.2409 6.49983 4.5" />
      <circle cx="16.5" cy="11.5" r="1.5" />
      <path d="M19.9999 20L17.1157 17.8514C16.1856 17.1586 14.8004 17.0896 13.7766 17.6851L13.5098 17.8403C12.7984 18.2542 11.8304 18.1848 11.2156 17.6758L7.37738 14.4989C6.6113 13.8648 5.38245 13.8309 4.5671 14.4214L3.24316 15.3803" />
    </svg>
  )
}

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-bone text-[#0a0a0b]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(10,10,11,0.08),transparent_35%),radial-gradient(circle_at_78%_22%,rgba(80,72,230,0.13),transparent_45%),radial-gradient(circle_at_50%_85%,rgba(10,10,11,0.11),transparent_42%)]" />

      <header className="relative z-10 border-b border-[#0a0a0b]/10 bg-[#ffffeb]/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
          <a href="/" className="flex items-center gap-2">
            <Image src="/cench2.0.svg" alt="Cench" width={34} height={34} />
            <span className={`${sairaStencil.className} text-base tracking-[0.08em] uppercase`}>Cench Studio</span>
          </a>
          <span className="rounded-full border border-[#0a0a0b]/15 bg-[#0a0a0b] px-4 py-1.5 text-xs font-semibold text-white">
            Book demo
          </span>
        </div>
      </header>

      <main className="relative z-10 flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-6 pb-48 pt-10 text-center">
        <h1 className="max-w-5xl text-balance text-4xl font-semibold leading-tight tracking-tight sm:text-6xl lg:text-7xl">
          Create any Video you can imagine
        </h1>
        <p className="mt-5 max-w-4xl text-balance text-sm font-medium leading-relaxed text-[#0a0a0b]/70 sm:text-base">
          Agent driven video creation and editing. Bringing together top diffusion models, react driven animtions, 3D,
          vectors, interactive, audio, LUTs, data, avatars, and more +
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full border border-[#0a0a0b] bg-[#0a0a0b] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2a2a2d]"
          >
            Waitlist
            <Send size={16} strokeWidth={2} className="opacity-90" aria-hidden />
          </button>
          <a
            href="/gallery"
            className="inline-flex items-center gap-2 rounded-full border border-[#0a0a0b]/30 bg-white/65 px-5 py-2 text-sm font-semibold text-[#0a0a0b] transition-colors hover:bg-white"
          >
            View gallery
            <AttachImageIcon />
          </a>
        </div>
        <section className="pointer-events-none absolute inset-x-0 bottom-2 z-0 mx-auto flex w-full max-w-5xl items-end justify-center px-6">
          <div className="relative flex w-full max-w-3xl flex-wrap items-center justify-center gap-3">
          <div className="relative flex h-14 w-14 rotate-[-15deg] items-center justify-center rounded-[18px] border border-white/45 bg-[linear-gradient(160deg,rgba(255,255,255,0.65),rgba(255,255,255,0.24))] shadow-[0_16px_32px_-12px_rgba(10,10,11,0.4),inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-xl">
            <img src="/logos/openai-black-monoblossom.svg" alt="OpenAI" className="h-9 w-9 object-contain" />
          </div>
          <div className="relative flex h-14 w-14 rotate-[-6deg] items-center justify-center rounded-[18px] border border-white/45 bg-[linear-gradient(160deg,rgba(255,255,255,0.65),rgba(255,255,255,0.24))] shadow-[0_16px_32px_-12px_rgba(10,10,11,0.4),inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-xl">
            <img src="/logos/claude-ai-symbol.svg" alt="Claude" className="h-7 w-7 object-contain" />
          </div>
          <div className="relative flex h-16 w-16 items-center justify-center rounded-[20px] border border-white/50 bg-[linear-gradient(160deg,rgba(255,255,255,0.72),rgba(255,255,255,0.26))] shadow-[0_18px_36px_-12px_rgba(10,10,11,0.45),inset_0_1px_0_rgba(255,255,255,0.82)] backdrop-blur-xl">
            <img src="/logos/google-gemini-icon-new.svg" alt="Gemini" className="h-9 w-9 object-contain" />
          </div>
          <div className="relative flex h-14 w-14 rotate-[7deg] items-center justify-center rounded-[18px] border border-white/45 bg-[linear-gradient(160deg,rgba(255,255,255,0.65),rgba(255,255,255,0.24))] shadow-[0_16px_32px_-12px_rgba(10,10,11,0.4),inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-xl">
            <img src="/logos/heygen-symbol-blue-logo.svg" alt="HeyGen" className="h-9 w-9 object-contain" />
          </div>
          <div className="relative flex h-14 w-14 rotate-[14deg] items-center justify-center rounded-[18px] border border-white/45 bg-[linear-gradient(160deg,rgba(255,255,255,0.65),rgba(255,255,255,0.24))] shadow-[0_16px_32px_-12px_rgba(10,10,11,0.4),inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-xl">
            <img src="/logos/kling.png" alt="Kling" className="h-7 w-7 object-contain [filter:brightness(0)_saturate(100%)]" />
          </div>
          <div className="relative flex h-14 w-14 rotate-[2deg] items-center justify-center rounded-[18px] border border-white/45 bg-[linear-gradient(160deg,rgba(255,255,255,0.65),rgba(255,255,255,0.24))] shadow-[0_16px_32px_-12px_rgba(10,10,11,0.4),inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-xl">
            <img src="/logos/fal-favicon.svg" alt="Fal" className="h-7 w-7 object-contain" />
          </div>
          <div className="relative flex h-12 w-12 rotate-[-7deg] items-center justify-center rounded-2xl border border-white/45 bg-[linear-gradient(160deg,rgba(255,255,255,0.65),rgba(255,255,255,0.24))] shadow-[0_16px_32px_-12px_rgba(10,10,11,0.4),inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-xl text-[#38bdf8]">
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
              <circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none" />
              <ellipse cx="12" cy="12" rx="9" ry="3.8" />
              <ellipse cx="12" cy="12" rx="9" ry="3.8" transform="rotate(60 12 12)" />
              <ellipse cx="12" cy="12" rx="9" ry="3.8" transform="rotate(120 12 12)" />
            </svg>
          </div>
          <div className="relative flex h-12 w-12 rotate-[-10deg] items-center justify-center rounded-2xl border border-white/45 bg-[linear-gradient(160deg,rgba(255,255,255,0.65),rgba(255,255,255,0.24))] shadow-[0_16px_32px_-12px_rgba(10,10,11,0.4),inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-xl">
            <img src="/logos/elevenlabs-symbol-download.svg" alt="ElevenLabs" className="h-8 w-8 object-contain" />
          </div>
          <div className="relative flex h-12 w-12 rotate-[8deg] items-center justify-center rounded-2xl border border-white/45 bg-[linear-gradient(160deg,rgba(255,255,255,0.65),rgba(255,255,255,0.24))] shadow-[0_16px_32px_-12px_rgba(10,10,11,0.4),inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-xl">
            <img src="/logos/threejs-logo.svg" alt="Three.js" className="h-7 w-7 object-contain" />
          </div>
          <div className="relative flex h-12 w-12 rotate-[3deg] items-center justify-center rounded-2xl border border-white/45 bg-[linear-gradient(160deg,rgba(255,255,255,0.65),rgba(255,255,255,0.24))] shadow-[0_16px_32px_-12px_rgba(10,10,11,0.4),inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-xl">
            <img src="/logos/lf-secondary-logomark-full-color.svg" alt="LottieFiles" className="h-7 w-7 object-contain" />
          </div>
          <div className="relative flex h-12 w-12 rotate-[-4deg] items-center justify-center rounded-2xl border border-white/45 bg-[linear-gradient(160deg,rgba(255,255,255,0.65),rgba(255,255,255,0.24))] shadow-[0_16px_32px_-12px_rgba(10,10,11,0.4),inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-xl">
            <img src="/logos/google-g-logo.svg" alt="Google" className="h-7 w-7 object-contain" />
          </div>
          <div className="relative flex h-12 w-12 rotate-[12deg] items-center justify-center rounded-2xl border border-white/45 bg-[linear-gradient(160deg,rgba(255,255,255,0.65),rgba(255,255,255,0.24))] shadow-[0_16px_32px_-12px_rgba(10,10,11,0.4),inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-xl">
            <img src="/logos/ollama.svg" alt="Ollama" className="h-7 w-7 object-contain" />
          </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-[#0a0a0b]/10 bg-[#ffffeb]/70 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-5 text-[#0a0a0b]/75 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Image src="/cench2.0.svg" alt="Cench" width={20} height={20} />
            <span className={`${sairaStencil.className} text-sm tracking-[0.08em] uppercase text-[#0a0a0b]`}>
              Cench Studio
            </span>
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
