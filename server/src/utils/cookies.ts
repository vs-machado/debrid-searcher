export function parseCookieHeader(header: string | undefined): Record<string, string> {
  if (!header) return {}
  const out: Record<string, string> = {}
  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx <= 0) continue
    const k = part.slice(0, idx).trim()
    const v = part.slice(idx + 1).trim()
    if (!k) continue
    out[k] = decodeURIComponent(v)
  }
  return out
}

export function serializeCookie(
  name: string,
  value: string,
  opts: {
    httpOnly?: boolean
    secure?: boolean
    sameSite?: 'lax' | 'strict' | 'none'
    path?: string
    maxAgeSeconds?: number
  } = {},
) {
  const parts: string[] = [`${name}=${encodeURIComponent(value)}`]
  parts.push(`Path=${opts.path || '/'}`)
  if (opts.httpOnly) parts.push('HttpOnly')
  if (opts.secure) parts.push('Secure')
  if (opts.sameSite) parts.push(`SameSite=${opts.sameSite[0].toUpperCase()}${opts.sameSite.slice(1)}`)
  if (typeof opts.maxAgeSeconds === 'number') parts.push(`Max-Age=${Math.max(0, Math.floor(opts.maxAgeSeconds))}`)
  return parts.join('; ')
}
