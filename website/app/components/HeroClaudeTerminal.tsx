import Link from 'next/link'

type HeroClaudeTerminalProps = {
  className?: string
}

/**
 * Same chrome and scale as {@link HeroCodeCard}; Claude Code / skill setup copy.
 */
export function HeroClaudeTerminal({ className = '' }: HeroClaudeTerminalProps) {
  return (
    <div className={`relative mx-auto w-full max-w-[min(100%,400px)] sm:max-w-[440px] ${className}`}>
      <p className="mb-3 text-center font-mono text-[10px] font-medium uppercase tracking-[0.42em] text-white drop-shadow-[0_1px_8px_rgba(0,0,0,0.45)] sm:mb-3.5 sm:text-[11px]">
        Claude Code
      </p>

      <div className="rounded-[10px] border border-white/[0.08] bg-[#121214] px-3.5 py-3.5 sm:px-[18px] sm:py-[18px]">
        <div className="mb-2.5 flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#ff6159]" />
          <span className="h-2 w-2 rounded-full bg-[#ffbd2e]" />
          <span className="h-2 w-2 rounded-full bg-[#28c840]" />
        </div>
        <p className="mb-3 font-mono text-[11px] leading-none text-[#6b6b70] sm:text-xs">...</p>

        <pre className="font-mono text-[10px] leading-[1.68] text-[#e8e8ec] sm:text-[11px] sm:leading-[1.72]">
          <span className="text-[#6b6b70]"># Install the /cench skill</span>
          {'\n'}
          <span className="text-[#7eb6ff]">$</span>
          <span className="text-[#e8e8ec]">{' mkdir -p .claude/skills '}</span>
          <span className="text-[#d4a574]">{'&&'}</span>
          <span className="text-[#e8e8ec]">{' cp -r'}</span>
          {'\n'}
          <span className="text-[#e8e8ec]">{'  /path/to/cench/.claude/skills/cench .claude/skills/'}</span>
          {'\n'}
          {'\n'}
          <span className="text-[#7eb6ff]">$</span>
          <span className="text-[#e8e8ec]">{' npm run dev'}</span>
          <span className="text-[#6b6b70]">{'  # localhost:3000'}</span>
          {'\n'}
          {'\n'}
          <span className="text-[#6b6b70]"># In Claude Code:</span>
          {'\n'}
          <span className="text-[#d4af37]">/cench &lt;your scene prompt&gt;</span>
        </pre>

        <p className="mt-3 font-mono text-[10px] leading-[1.68] text-[#6b6b70] sm:text-[11px] sm:leading-[1.72]">
          Copy{' '}
          <code className="text-[#d4a574]">cench</code> from a{' '}
          <Link
            href="/docs#qs-agent-skill"
            className="text-[#7eb6ff] underline decoration-white/25 underline-offset-2 transition-colors hover:text-[#e8e8ec] hover:decoration-white/50"
          >
            Cench Studio clone
          </Link>
          . Full steps in docs.
        </p>

        <div className="mt-1 flex items-center gap-0.5">
          <span
            className="hero-code-cursor inline-block h-[13px] w-px translate-y-px bg-[#d4af37] sm:h-[14px]"
            aria-hidden
          />
        </div>
      </div>
    </div>
  )
}
