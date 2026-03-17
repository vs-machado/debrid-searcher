export type TorboxClientOpts = {
  baseUrl: string
  apiKey: string
}

function authHeaders(apiKey: string) {
  return { authorization: `Bearer ${apiKey}` }
}

function dbgEnabled() {
  const raw = process.env.LOG_TORBOX
  if (!raw) return false
  const s = raw.trim().toLowerCase()
  return s === '1' || s === 'true' || s === 'yes' || s === 'y' || s === 'on'
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

function unwrapCheckCachedPayload(data: unknown): unknown {
  // TorBox responses are sometimes wrapped (e.g. { success, data: ... }).
  // Unwrap a few common envelope shapes so the cache interpreter sees the
  // actual hash->cached mapping.
  if (!data || typeof data !== 'object') return data

  const obj = data as any

  const candidates = [obj.data, obj.result, obj.results, obj.response, obj.payload, obj.cached, obj.hashes]
  for (const c of candidates) {
    if (c !== undefined && c !== null) return unwrapCheckCachedPayload(c)
  }

  // Nothing obvious to unwrap.
  return data
}

function pickHash(v: unknown): string | undefined {
  if (!v || typeof v !== 'object') return undefined
  const obj = v as any
  const raw = obj.hash ?? obj.infohash ?? obj.infoHash ?? obj.info_hash ?? obj.btih
  return typeof raw === 'string' && raw.trim() ? raw.trim() : undefined
}

function interpretCheckCached(data: unknown, hashes: string[]) {
  const out: Record<string, boolean> = {}

  const reqByLower: Record<string, string> = {}
  for (const h of hashes) reqByLower[h.toLowerCase()] = h

  data = unwrapCheckCachedPayload(data)

  // Some responses collapse to a single object like { hash, cached, ... }.
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const h = pickHash(data)
    const b = isCachedValue(data)
    // If the API returns an object for a hash, that object represents a cached item
    // even if it doesn't explicitly include a cached flag.
    if (h && (typeof b === 'boolean' || b === undefined)) {
      const key = reqByLower[h.toLowerCase()]
      if (key) out[key] = b ?? true
      for (const hh of hashes) if (typeof out[hh] !== 'boolean') out[hh] = false
      return out
    }
  }

  if (Array.isArray(data)) {
    // Some formats return a list of cached hashes.
    if (data.every((x) => typeof x === 'string' || typeof x === 'number')) {
      const set = new Set(data.map(String).map((s) => s.toLowerCase()))
      for (const h of hashes) out[h] = set.has(h.toLowerCase())
      return out
    }

    // Other formats return an array of objects with { hash, cached }.
    const byLower: Record<string, boolean> = {}
    for (const item of data) {
      const h = pickHash(item)
      if (!h) continue
      const b = isCachedValue(item)
      // For checkcached, items included in the response are cached by definition.
      // Some responses omit an explicit cached flag and only return cached items.
      if (typeof b === 'boolean') byLower[h.toLowerCase()] = b
      else byLower[h.toLowerCase()] = true
    }

    for (const h of hashes) out[h] = byLower[h.toLowerCase()] ?? false
    return out
  }

  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>
    for (const h of hashes) {
      const v = obj[h] ?? obj[h.toLowerCase()] ?? obj[h.toUpperCase()]
      const b = isCachedValue(v)
      if (typeof b === 'boolean') out[h] = b
      else if (v !== undefined && v !== null) out[h] = true
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

  function chunk<T>(arr: T[], size: number): T[][] {
    if (size <= 0) return [arr]
    const out: T[][] = []
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
    return out
  }

  return {
    async checkCached(hashes: string[]) {
      if (!hashes.length) return {} as Record<string, boolean>

      async function doReq(batch: string[], useQueryHashes: boolean) {
        const url = new URL(`${base}/v1/api/torrents/checkcached`)
        url.searchParams.set('format', 'object')
        url.searchParams.set('list_files', 'false')
        if (useQueryHashes) {
          for (const h of batch) url.searchParams.append('hash', h)
        }

        const res = await fetch(url.toString(), {
          method: 'POST',
          headers: {
            ...authHeaders(opts.apiKey),
            'content-type': 'application/json',
          },
          body: JSON.stringify({ hashes: batch }),
        })

        if (!res.ok) {
          const text = await res.text().catch(() => '')
          throw new Error(`TorBox checkcached failed: ${res.status} ${res.statusText}${text ? ` - ${text}` : ''}`)
        }

        const data = (await res.json().catch(() => ({}))) as unknown
        return interpretCheckCached(data, batch)
      }

      // Use JSON body by default (avoids long-URL 414s), but fall back to query hashes if needed.
      const merged: Record<string, boolean> = {}
      const batches = chunk(hashes, 100)
      for (const batch of batches) {
        try {
          Object.assign(merged, await doReq(batch, false))
        } catch (e) {
          // Some setups appear to ignore JSON bodies for this endpoint. Retry with query params,
          // but in small batches to avoid 414 Request-URI Too Large.
          const smallBatches = batch.length > 25 ? chunk(batch, 25) : [batch]
          for (const sb of smallBatches) {
            Object.assign(merged, await doReq(sb, true))
          }
        }
      }

      if (dbgEnabled()) {
        const cachedCount = Object.values(merged).filter(Boolean).length
        console.log(`torbox.checkcached: hashes=${hashes.length} cached=${cachedCount}`)
      }

      return merged
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
