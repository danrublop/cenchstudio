/**
 * Shared URL guard against trivial SSRF vectors.
 *
 * Blocks obvious bad cases at URL-parse time:
 *   - non-http(s) schemes (`file://`, `data:`, `javascript:`, …)
 *   - loopback hosts (`localhost`, `127.0.0.1`, `::1`)
 *   - RFC1918 private ranges (`10.*`, `192.168.*`, `172.16-31.*`)
 *   - link-local / cloud metadata (`169.254.*`)
 *   - `.local` mDNS, `0.0.0.0`
 *   - IPv6 ULA (`fc00::/7`) + link-local (`fe80::/10`)
 *
 * Does NOT protect against DNS rebinding (a `public.attacker.com` that
 * resolves to `169.254.169.254` between the HEAD and GET calls). That
 * needs IP pinning at fetch time and is out of scope for this guard.
 *
 * Callers convert `UrlGuardError` to whatever their validation-error
 * subclass is (e.g. `IngestValidationError`).
 */

export class UrlGuardError extends Error {
  readonly code = 'URL_GUARD' as const
  constructor(message: string) {
    super(message)
    this.name = 'UrlGuardError'
  }
}

function isLoopbackOrPrivateV4(hostname: string): boolean {
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) return true
  if (hostname.endsWith('.local')) return true
  if (hostname === '0.0.0.0') return true
  if (hostname === '127.0.0.1' || hostname.startsWith('127.')) return true
  if (hostname === '::1') return true
  if (hostname.startsWith('169.254.')) return true
  if (hostname.startsWith('10.')) return true
  if (hostname.startsWith('192.168.')) return true
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) return true
  return false
}

function isPrivateV6(hostname: string): boolean {
  // Node keeps brackets on `url.hostname` for IPv6 literals — strip so the
  // regexes can anchor on the address bytes themselves.
  const bare = hostname.replace(/^\[/, '').replace(/\]$/, '').toLowerCase()
  if (bare === '::' || bare === '::1') return true
  // ULA: fc00::/7 → first byte 0xfc or 0xfd
  if (/^(fc|fd)[0-9a-f]{0,2}:/.test(bare)) return true
  // Link-local: fe80::/10 → fe80..febf (first hextet only — second nibble 8..b)
  if (/^fe[89ab][0-9a-f]?:/.test(bare)) return true
  // IPv4-mapped IPv6 (`::ffff:a.b.c.d` or the normalized `::ffff:xxxx:xxxx`).
  // These shouldn't appear in any legitimate public URL — they're an
  // internal representation format. Reject the whole class rather than
  // decoding the last 32 bits and re-running the private-v4 check.
  if (/^::ffff:/.test(bare)) return true
  return false
}

export interface AssertPublicHttpUrlOptions {
  /** Default: `['http:', 'https:']`. Pass `['https:']` to force TLS. */
  allowedSchemes?: string[]
}

/**
 * Validates `urlString` and returns the parsed `URL`. Throws
 * `UrlGuardError` on disallowed schemes or non-public hosts.
 */
export function assertPublicHttpUrl(urlString: string, opts: AssertPublicHttpUrlOptions = {}): URL {
  const allowedSchemes = opts.allowedSchemes ?? ['http:', 'https:']

  let parsed: URL
  try {
    parsed = new URL(urlString)
  } catch {
    throw new UrlGuardError('Invalid URL')
  }

  if (!allowedSchemes.includes(parsed.protocol)) {
    throw new UrlGuardError(`Disallowed URL scheme: ${parsed.protocol}`)
  }

  const hostname = parsed.hostname.toLowerCase()
  if (!hostname) {
    throw new UrlGuardError('URL has no hostname')
  }

  if (isLoopbackOrPrivateV4(hostname) || isPrivateV6(hostname)) {
    throw new UrlGuardError(`Internal address not allowed: ${hostname}`)
  }

  return parsed
}
