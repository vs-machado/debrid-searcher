export type TorboxClientOpts = {
  baseUrl: string
  apiKey: string
}

function authHeaders(apiKey: string) {
  return { authorization: `Bearer ${apiKey}` }
}

function asBool(v: unknown): boolean | undefined {
  if (typeof v === 'boolean') return v
  if (typeof v === 'number') return v !== 0
  if (typeof v === 'string') {
    const s = v.toLowerCase().trim()
    if (s === 'true' || s === '1' || s === 'yes') return true
    if (s === 'false' || s === '0' || s === 'no') return false
  }
  return undefined
}

function isCachedValue(v: unknown): boolean | undefined {
  if (typeof v === 'boolean') return v
  if (v && typeof v === 'object') {
    const obj = v as any
    return (
      asBool(obj.cached) ??
      asBool(obj.is_cached) ??
      asBool(obj.isCached) ??
      (typeof obj.status === 'string' ? obj.status.toLowerCase() === 'cached' : undefined)
    )
  }
  return undefined
}

function interpretCheckCached(data: unknown, hashes: string[]) {
  const out: Record<string, boolean> = {}

  if (Array.isArray(data)) {
    const set = new Set(data.map(String).map((s) => s.toLowerCase()))
    for (const h of hashes) out[h] = set.has(h.toLowerCase())
    return out
  }

  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>
    for (const h of hashes) {
      const v = obj[h] ?? obj[h.toLowerCase()] ?? obj[h.toUpperCase()]
      const b = isCachedValue(v)
      if (typeof b === 'boolean') out[h] = b
    }
  }

  // Default: unknown => false
  for (const h of hashes) {
    if (typeof out[h] !== 'boolean') out[h] = false
  }
  return out
}

export function torboxClient(opts: TorboxClientOpts) {
  const base = opts.baseUrl.replace(/\/+$/, '')

  return {
    async checkCached(hashes: string[]) {
      if (!hashes.length) return {} as Record<string, boolean>

      const url = new URL(`${base}/v1/api/torrents/checkcached`)
      url.searchParams.set('format', 'object')
      url.searchParams.set('list_files', 'false')

      const res = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          ...authHeaders(opts.apiKey),
          'content-type': 'application/json',
        },
        body: JSON.stringify({ hashes }),
      })

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`TorBox checkcached failed: ${res.status} ${res.statusText}${text ? ` - ${text}` : ''}`)
      }

      const data = (await res.json().catch(() => ({}))) as unknown
      return interpretCheckCached(data, hashes)
    },

    async createTorrentFromMagnet(magnet: string, addOnlyIfCached: boolean) {
      const url = `${base}/v1/api/torrents/createtorrent`
      const form = new FormData()
      form.set('magnet', magnet)
      form.set('add_only_if_cached', String(addOnlyIfCached))
      form.set('as_queued', 'false')
      form.set('allow_zip', 'true')

      const res = await fetch(url, {
        method: 'POST',
        headers: authHeaders(opts.apiKey),
        body: form,
      })

      const data = (await res.json().catch(() => ({}))) as unknown
      if (!res.ok) {
        const detail = (data as any)?.detail || (data as any)?.error || `${res.status} ${res.statusText}`
        throw new Error(String(detail))
      }
      return data
    },
  }
}
