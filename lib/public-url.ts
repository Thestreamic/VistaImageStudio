/** Prefix for static files when the site is not at the domain root (GitHub project Pages). */

export type LocationLike = {
  protocol?: string
  hostname?: string
  pathname?: string
  href?: string
  origin?: string
}

let runtimePrefix: string | null = null

function normalizePrefix(raw: string): string {
  const trimmed = String(raw ?? '').trim()
  if (!trimmed || trimmed === '/') return ''
  const withSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  return withSlash.replace(/\/$/, '')
}

/** Override used by the AI worker after the window posts its resolved prefix. */
export function setPublicBasePath(prefix: string | null): void {
  runtimePrefix = prefix == null ? null : normalizePrefix(prefix)
}

function envPrefix(): string {
  try {
    if (typeof process === 'undefined' || !process.env) return ''
    return normalizePrefix(process.env.NEXT_PUBLIC_BASE_PATH ?? process.env.BASE_PATH ?? '')
  } catch {
    return ''
  }
}

function isLocalHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
}

export function inferPublicBasePath(loc: LocationLike): string {
  const protocol = loc.protocol ?? ''
  if (protocol !== 'http:' && protocol !== 'https:') return ''
  const hostname = loc.hostname ?? ''
  if (isLocalHost(hostname)) return ''

  let pathname = loc.pathname ?? ''
  if (!pathname && loc.href) {
    try {
      pathname = new URL(loc.href).pathname
    } catch {
      pathname = ''
    }
  }

  const nextAt = pathname.indexOf('/_next/')
  if (nextAt > 0) return normalizePrefix(pathname.slice(0, nextAt))

  if (hostname.endsWith('.github.io')) {
    const first = pathname.split('/').filter(Boolean)[0]
    if (first && first !== '_next' && !first.includes('.')) return `/${first}`
  }
  return ''
}

function locationIgnoresEnvPrefix(loc: LocationLike, fromEnv: string): boolean {
  if (!fromEnv) return false
  const protocol = loc.protocol ?? ''
  if (protocol !== 'http:' && protocol !== 'https:') return false
  const hostname = loc.hostname ?? ''
  if (isLocalHost(hostname)) return false
  const pathname = loc.pathname ?? '/'
  if (pathname === fromEnv || pathname.startsWith(`${fromEnv}/`)) return false
  if (pathname.includes(`${fromEnv}/_next/`)) return false
  return true
}

export function publicBasePath(loc?: LocationLike): string {
  if (runtimePrefix != null) return runtimePrefix
  const here =
    loc ?? (typeof self !== 'undefined' ? (self as { location?: LocationLike }).location : undefined)
  const fromEnv = envPrefix()
  if (here && locationIgnoresEnvPrefix(here, fromEnv)) return inferPublicBasePath(here)
  if (fromEnv) return fromEnv
  return here ? inferPublicBasePath(here) : ''
}

export function publicUrl(path: string, loc?: LocationLike): string {
  const suffix = path.startsWith('/') ? path : `/${path}`
  const prefix = publicBasePath(loc)
  if (!prefix) return suffix
  if (suffix === prefix || suffix.startsWith(`${prefix}/`)) return suffix
  return `${prefix}${suffix}`
}

function documentOrigin(loc: LocationLike): string {
  const protocol = loc.protocol ?? ''
  const origin = loc.origin ?? ''
  const href = loc.href ?? ''
  if (protocol === 'http:' || protocol === 'https:' || protocol === 'lumen:') {
    if (origin) return origin
    try {
      return href ? new URL(href).origin : ''
    } catch {
      return ''
    }
  }
  if (protocol === 'blob:') {
    const inner = href.startsWith('blob:') ? href.slice('blob:'.length) : origin
    try {
      const u = new URL(inner)
      if (u.protocol === 'http:' || u.protocol === 'https:' || u.protocol === 'lumen:') return u.origin
    } catch {
      return origin.startsWith('http') || origin.startsWith('lumen:') ? origin : ''
    }
  }
  return ''
}

/**
 * Absolute href for a file in public/. Workers often run as blob: URLs, and
 * `new URL('/models/x', blobUrl)` is invalid — always resolve against the page.
 */
export function absolutePublicHref(path: string, loc?: LocationLike): string {
  const rel = publicUrl(path, loc)
  if (/^(https?:|file:)/i.test(rel)) return rel
  const here =
    loc ?? (typeof self !== 'undefined' ? (self as { location?: LocationLike }).location : undefined)
  if (!here) return rel

  const httpOrigin = documentOrigin(here)
  if (httpOrigin) return new URL(rel, httpOrigin).href

  const href = here.href ?? ''
  const from = href.startsWith('blob:') ? href.slice('blob:'.length) : href
  const marker = '/_next/'
  const cut = from.lastIndexOf(marker)
  const base = cut >= 0 ? from.slice(0, cut + 1) : from.replace(/[^/]+$/, '')
  if (!base) return rel
  return new URL(rel.replace(/^\//, ''), base).href
}
