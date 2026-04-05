import type { Metadata } from 'next'
import { Manrope } from 'next/font/google'

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
})

export const metadata: Metadata = {
  title: 'Cench — AI-Powered Animated Video Creation',
  description: 'From prompt to MP4. AI agents generate, animate, and export production-ready video scenes.',
}

export default function StealthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${manrope.variable} !bg-white !text-[#1a1a1a]`}
      style={{ background: '#fff', color: '#1a1a1a', fontFamily: 'var(--font-manrope), var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif' }}
    >
      {children}
    </div>
  )
}
