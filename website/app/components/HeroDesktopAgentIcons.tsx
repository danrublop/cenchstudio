import Image from 'next/image'

export type HeroToolbarId = 'cench' | 'library' | 'api' | 'claude'

const iconSize = 1024
/** macOS-style tile behind the mark (`public/cench-app-icon-bg.png`). */
const cenchAppBgW = 512
const cenchAppBgH = 288

/** Cench, API, Claude — slightly larger than Library */
const iconBoxLg =
  'h-[3.75rem] w-[3.75rem] shrink-0 sm:h-20 sm:w-20'
const iconBoxMd = 'h-14 w-14 shrink-0 sm:h-[4.5rem] sm:w-[4.5rem]'

const items = [
  { id: 'cench' as const, src: '/blacklogo.png', label: 'Cench', width: iconSize, height: iconSize },
  { id: 'api' as const, src: '/hero-agents/api.png', label: 'API', width: iconSize, height: iconSize },
  { id: 'claude' as const, src: '/hero-agents/claude.png', label: 'Claude Code', width: iconSize, height: iconSize },
  { id: 'library' as const, src: '/hero-agents/studio.png', label: 'Library', width: iconSize, height: iconSize },
] as const

type HeroDesktopAgentIconsProps = {
  activePanel: 'api' | 'claude' | 'library' | 'cench' | null
  onActivate: (id: HeroToolbarId) => void
}

function CenchAppTile() {
  return (
    <div
      className={`relative ${iconBoxLg} transition-[transform,filter] duration-200 ease-out select-none group-hover:scale-[1.06] group-hover:brightness-110 sm:group-hover:scale-[1.07]`}
    >
      <div className="absolute inset-[13%] overflow-hidden rounded-[20%]">
        <Image
          src="/cench-app-icon-bg.png"
          alt=""
          width={cenchAppBgW}
          height={cenchAppBgH}
          className="h-full w-full object-cover"
          sizes="(max-width: 640px) 48px, 64px"
        />
      </div>
      <Image
        src="/blacklogo.png"
        alt=""
        width={iconSize}
        height={iconSize}
        className="absolute left-1/2 top-1/2 z-[1] h-[72%] w-[72%] -translate-x-1/2 -translate-y-1/2 object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)]"
        sizes="52px"
      />
    </div>
  )
}

/**
 * Glass toolbar along the bottom of the hero image (all icons in one dock).
 */
export function HeroDesktopAgentIcons({ activePanel, onActivate }: HeroDesktopAgentIconsProps) {
  return (
    <div className="absolute inset-x-0 bottom-0 z-[3] flex justify-center px-1 pb-2 pt-8 sm:px-2 sm:pb-3.5 sm:pt-11">
      <div
        className="pointer-events-auto flex flex-row items-end gap-2 rounded-[1.625rem] border border-white/[0.38] bg-linear-to-b from-white/[0.22] via-white/[0.08] to-white/[0.04] px-2.5 py-1.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.45),0_12px_36px_rgba(0,0,0,0.2),0_3px_12px_rgba(0,0,0,0.1)] backdrop-blur-2xl backdrop-saturate-150 sm:gap-2.5 sm:rounded-[2rem] sm:px-3 sm:py-1.5"
        role="toolbar"
        aria-label="Integrations"
      >
        {items.map(({ id, src, label, width, height }) => {
          const isActive =
            (id === 'api' && activePanel === 'api') ||
            (id === 'claude' && activePanel === 'claude') ||
            (id === 'library' && activePanel === 'library') ||
            (id === 'cench' && activePanel === 'cench')
          const isLargeIcon = id === 'api' || id === 'claude'
          const iconBox = isLargeIcon ? iconBoxLg : iconBoxMd
          return (
            <button
              key={id}
              type="button"
              onClick={() => onActivate(id)}
              aria-pressed={isActive}
              className={`group flex cursor-pointer flex-col items-center gap-1 rounded-2xl px-1.5 py-0.5 transition-[background-color,transform,box-shadow] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 sm:gap-1.5 sm:px-2 sm:py-1 ${
                isActive
                  ? 'bg-white/[0.2] ring-2 ring-white/40 ring-offset-0'
                  : 'hover:bg-white/[0.14]'
              }`}
            >
              {id === 'cench' ? (
                <CenchAppTile />
              ) : (
                <Image
                  src={src}
                  alt=""
                  width={width}
                  height={height}
                  className={`${iconBox} object-contain select-none transition-[transform,filter] duration-200 ease-out group-hover:scale-[1.06] group-hover:brightness-110 sm:group-hover:scale-[1.07]`}
                  sizes={
                    isLargeIcon ? '(max-width: 640px) 60px, 80px' : '(max-width: 640px) 56px, 72px'
                  }
                />
              )}
              <span className="max-w-full text-center font-sans text-[10px] font-medium leading-tight tracking-tight text-white/95 drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)] transition-[transform,color,font-weight] duration-200 ease-out group-hover:scale-105 group-hover:text-white group-hover:font-semibold sm:text-xs">
                {label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
