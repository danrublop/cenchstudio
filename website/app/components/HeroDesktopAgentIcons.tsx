import Image from 'next/image'

export type HeroToolbarId = 'cench' | 'library' | 'api' | 'claude'

const iconSize = 1024
/** macOS-style tile behind the mark (`public/cench-app-icon-bg.png`). */
const cenchAppBgW = 512
const cenchAppBgH = 288

/** Cench, API, Claude — slightly larger than Library */
const iconBoxLg =
  'h-[4.5rem] w-[4.5rem] shrink-0 sm:h-24 sm:w-24'
const iconBoxMd = 'h-16 w-16 shrink-0 sm:h-[5.5rem] sm:w-[5.5rem]'

const items = [
  { id: 'cench' as const, src: '/blacklogo.png', label: 'Cench', width: iconSize, height: iconSize },
  { id: 'api' as const, src: '/hero-agents/api.png', label: 'API', width: iconSize, height: iconSize },
  { id: 'claude' as const, src: '/hero-agents/claude.png', label: 'Claude Code', width: iconSize, height: iconSize },
  { id: 'library' as const, src: '/hero-agents/studio.png', label: 'Library', width: iconSize, height: iconSize },
] as const

type HeroDesktopAgentIconsProps = {
  activePanel: 'api' | 'claude' | 'library' | null
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
          sizes="(max-width: 640px) 58px, 80px"
        />
      </div>
      <Image
        src="/blacklogo.png"
        alt=""
        width={iconSize}
        height={iconSize}
        className="absolute left-1/2 top-1/2 z-[1] h-[72%] w-[72%] -translate-x-1/2 -translate-y-1/2 object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)]"
        sizes="64px"
      />
    </div>
  )
}

/**
 * Glass toolbar along the bottom of the hero image (all icons in one dock).
 */
export function HeroDesktopAgentIcons({ activePanel, onActivate }: HeroDesktopAgentIconsProps) {
  return (
    <div className="absolute inset-x-0 bottom-0 z-[3] flex justify-center px-3 pb-3 pt-10 sm:px-5 sm:pb-5 sm:pt-14">
      <div
        className="pointer-events-auto flex flex-row items-end gap-2.5 rounded-[1.35rem] border border-white/[0.38] bg-linear-to-b from-white/[0.22] via-white/[0.08] to-white/[0.04] px-3 py-2 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.45),0_16px_48px_rgba(0,0,0,0.22),0_4px_16px_rgba(0,0,0,0.12)] backdrop-blur-2xl backdrop-saturate-150 sm:gap-3.5 sm:rounded-3xl sm:px-4 sm:py-2"
        role="toolbar"
        aria-label="Integrations"
      >
        {items.map(({ id, src, label, width, height }) => {
          const isActive =
            (id === 'api' && activePanel === 'api') ||
            (id === 'claude' && activePanel === 'claude') ||
            (id === 'library' && activePanel === 'library')
          const isLargeIcon = id === 'api' || id === 'claude'
          const iconBox = isLargeIcon ? iconBoxLg : iconBoxMd
          return (
            <button
              key={id}
              type="button"
              onClick={() => onActivate(id)}
              aria-pressed={isActive}
              className={`group flex cursor-pointer flex-col items-center gap-1.5 rounded-xl px-2 py-1 transition-[background-color,transform,box-shadow] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 sm:px-2.5 sm:py-1.5 ${
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
                    isLargeIcon ? '(max-width: 640px) 72px, 96px' : '(max-width: 640px) 64px, 88px'
                  }
                />
              )}
              <span className="max-w-full text-center font-sans text-[11px] font-medium leading-tight tracking-tight text-white/95 drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)] transition-[transform,color,font-weight] duration-200 ease-out group-hover:scale-105 group-hover:text-white group-hover:font-semibold sm:text-[13px]">
                {label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
