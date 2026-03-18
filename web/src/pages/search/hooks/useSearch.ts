import { useCallback, useMemo, useState } from 'react'
import { apiGet } from '../api'
import type { SearchResponse } from '../types'

export function useSearch() {
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<SearchResponse | null>(null)

  const cachedCount = useMemo(() => (data ? data.results.filter((r) => r.cached).length : 0), [data])

  const run = useCallback(async () => {
    const query = q.trim()
    if (!query || loading) return { ok: false as const, query }

    setLoading(true)
    setData(null)
    try {
      const out = await apiGet<SearchResponse>(`/api/search?q=${encodeURIComponent(query)}`)
      setData(out)
      return { ok: true as const, query, out }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      const out: SearchResponse = {
        query,
        elapsedMs: 0,
        results: [],
        cachedResults: [],
        errors: [{ indexer: 'web', message: msg }],
      }
      setData(out)
      return { ok: false as const, query, error: msg }
    } finally {
      setLoading(false)
    }
  }, [q, loading])

  return { q, setQ, loading, data, setData, cachedCount, run }
}
