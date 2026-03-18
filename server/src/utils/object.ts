export function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

export function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : []
}

export function unwrapStandardData(v: unknown): unknown {
  if (!isRecord(v)) return v
  const cands = [(v as any).data, (v as any).result, (v as any).results, (v as any).response, (v as any).payload]
  for (const c of cands) {
    if (c !== undefined) return unwrapStandardData(c)
  }
  return v
}

export function findTorrentId(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (!v) return undefined
  if (isRecord(v)) {
    const direct = (v as any).torrent_id ?? (v as any).torrentId ?? (v as any).id
    const n = typeof direct === 'string' ? Number(direct) : direct
    if (typeof n === 'number' && Number.isFinite(n)) return n

    // Common TorBox envelope { data: { torrent_id } }
    const cands = [(v as any).data, (v as any).result, (v as any).response, (v as any).payload]
    for (const c of cands) {
      const got = findTorrentId(c)
      if (got !== undefined) return got
    }
  }
  return undefined
}
