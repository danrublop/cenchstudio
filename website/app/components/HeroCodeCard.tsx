/**
 * Editorial code card for the hero showcase — dark panel, window dots, syntax colors, FIG caption.
 */

type HeroCodeCardProps = {
  className?: string
}

export function HeroCodeCard({ className = '' }: HeroCodeCardProps) {
  return (
    <div className={`relative mx-auto w-full max-w-[min(100%,400px)] sm:max-w-[440px] ${className}`}>
      <p className="mb-3 text-center font-mono text-[10px] font-medium uppercase tracking-[0.42em] text-white drop-shadow-[0_1px_8px_rgba(0,0,0,0.45)] sm:mb-3.5 sm:text-[11px]">
        API
      </p>

      <div className="rounded-[10px] border border-white/[0.08] bg-[#121214] px-3.5 py-3.5 sm:px-[18px] sm:py-[18px]">
        <div className="mb-2.5 flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#ff6159]" />
          <span className="h-2 w-2 rounded-full bg-[#ffbd2e]" />
          <span className="h-2 w-2 rounded-full bg-[#28c840]" />
        </div>
        <p className="mb-3 font-mono text-[11px] leading-none text-[#6b6b70] sm:text-xs">...</p>

        <pre className="font-mono text-[10px] leading-[1.68] text-[#e8e8ec] sm:text-[11px] sm:leading-[1.72]">
          <span className="text-[#7eb6ff]">async function</span>
          <span className="text-[#e8e8ec]"> </span>
          <span className="text-[#d4af37]">handler</span>
          <span className="text-[#e8e8ec]">{'({ prompt }) {'}</span>
          {'\n'}
          <span className="text-[#e8e8ec]">{'  '}</span>
          <span className="text-[#7eb6ff]">if</span>
          <span className="text-[#e8e8ec]">{' (prompt) {'}</span>
          {'\n'}
          <span className="text-[#e8e8ec]">{'    const [scene] = '}</span>
          <span className="text-[#7eb6ff]">await</span>
          <span className="text-[#e8e8ec]">{' agent`'}</span>
          {'\n'}
          <span className="text-[#d4a574]">{'      GENERATE MOTION_SCENE'}</span>
          {'\n'}
          <span className="text-[#d4a574]">{'      FROM'}</span>
          <span className="text-[#e8e8ec]">{' (${prompt})'}</span>
          {'\n'}
          <span className="text-[#d4a574]">{'      RETURNING id, html, duration'}</span>
          {'\n'}
          <span className="text-[#e8e8ec]">{'    '}</span>
          <span className="text-[#e8e8ec]">`</span>
          <span className="text-[#e8e8ec]">;</span>
          {'\n'}
          <span className="text-[#e8e8ec]">{'    '}</span>
          <span className="text-[#7eb6ff]">return</span>
          <span className="text-[#e8e8ec]">{' { scene };'}</span>
          {'\n'}
          <span className="text-[#e8e8ec]">{'  }'}</span>
          {'\n'}
          <span className="text-[#e8e8ec]">{'}'}</span>
        </pre>

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
