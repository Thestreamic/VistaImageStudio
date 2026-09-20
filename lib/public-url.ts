/** Prefix for static files when the site is not at the domain root (GitHub project Pages). */
export function publicUrl(path: string): string {
  const raw = typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_BASE_PATH ?? '' : ''
  const prefix = String(raw).replace(/\/$/, '')
  const suffix = path.startsWith('/') ? path : `/${path}`
  return `${prefix}${suffix}`
}
