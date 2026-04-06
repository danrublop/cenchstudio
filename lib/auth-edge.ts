import GitHub from 'next-auth/providers/github'
import Google from 'next-auth/providers/google'
import type { NextAuthConfig } from 'next-auth'

/**
 * Auth.js configuration shared between middleware (Edge) and server (Node).
 * This file must NOT import anything that requires Node.js APIs (pg, fs, etc.)
 * because middleware runs in the Edge Runtime.
 */
export const authConfig = {
  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  pages: {
    signIn: '/login',
  },
  callbacks: {
    authorized() {
      // We handle our own auth logic in middleware.ts, so always allow here.
      return true
    },
  },
} satisfies NextAuthConfig
