import type { Metadata } from 'next'
import { DM_Mono, Caveat } from 'next/font/google'
import './globals.css'

const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-dm-mono',
})

const caveat = Caveat({
  subsets: ['latin'],
  variable: '--font-caveat',
})

export const metadata: Metadata = {
  title: 'SVG Video Editor',
  description: 'Create and edit animated SVG videos',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmMono.variable} ${caveat.variable}`}>
      <body className="font-mono antialiased overflow-hidden">{children}</body>
    </html>
  )
}
