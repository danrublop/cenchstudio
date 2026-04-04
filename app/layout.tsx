import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { DM_Mono, Caveat } from 'next/font/google'
import './globals.css'
import '@/lib/fonts/imports'

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
  title: 'Cench Studio',
  description: 'Create and edit animated videos',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${dmMono.variable} ${caveat.variable}`}>
      <body className="font-sans antialiased overflow-hidden" suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}
