import type { AppEnv } from '../config/env.js'
import { searchTorznab, type TorznabResult } from '../clients/torznab.js'
import { hydraSourceName, searchHydraSource } from '../clients/hydra.js'
import { torboxClient } from '../clients/torbox.js'
import { computeRelevanceScore } from '../utils/scoring.js'

export type ApiResult = TorznabResult & { cached?: boolean }
export type SearchError = { indexer: string; message: string }

function endpointName(url: string) {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

export type SearchService = {
  search: (q: string) => Promise<{
    query: string
    elapsedMs: number
    results: ApiResult[]
    cachedResults: ApiResult[]
    errors: SearchError[]
  }>
}

export function createSearchService(env: AppEnv): SearchService {
  return {
    async search(q: string) {
      const started = Date.now()

      const endpoints = [
        ...env.indexerUrls.map((url) => ({ kind: 'torznab' as const, url })),
        ...env.hydraSourceUrls.map((url) => ({ kind: 'hydra' as const, url })),
      ]
      if (!endpoints.length) {
        return {
          query: q,
          elapsedMs: Date.now() - started,
          results: [],
          cachedResults: [],
          errors: [{ indexer: 'config', message: 'No sources configured. Set INDEXERS_TORZNAB_URLS or INDEXERS_HYDRA_URLS in server/.env.' }],
        }
      }

      const settled = await Promise.allSettled(
        endpoints.map((endpoint) => endpoint.kind === 'torznab' ? searchTorznab(endpoint.url, q) : searchHydraSource(endpoint.url, q)),
      )
      const errors: SearchError[] = []
      const merged: ApiResult[] = []

      for (let i = 0; i < settled.length; i++) {
        const s = settled[i]
        const endpoint = endpoints[i]
        const indexer = endpoint.kind === 'hydra' ? hydraSourceName(endpoint.url) : endpointName(endpoint.url)
        if (s.status === 'fulfilled') {
          for (const r of s.value) merged.push({ ...r, indexer: r.indexer || indexer })
        } else {
          errors.push({ indexer, message: s.reason instanceof Error ? s.reason.message : String(s.reason) })
        }
      }

      // Dedupe by infoHash, then magnet, then title.
      const seen = new Set<string>()
      const results: ApiResult[] = []
      for (const r of merged) {
        const key = (r.infoHash && `h:${r.infoHash}`) || (r.magnet && `m:${r.magnet}`) || `t:${r.title}`
        if (seen.has(key)) continue
        seen.add(key)
        results.push(r)
      }

      // Cache check in one batch.
      if (env.torboxApiKey) {
        const hashes = results
          .map((r) => r.infoHash)
          .filter((h): h is string => typeof h === 'string' && !!h.trim())
          .map((h) => h.trim().toLowerCase())
        const unique = Array.from(new Set(hashes))

        try {
          const client = torboxClient({ baseUrl: env.torboxBaseUrl, apiKey: env.torboxApiKey })
          const map = await client.checkCached(unique)
          for (const r of results) {
            if (r.infoHash) r.cached = !!map[r.infoHash.trim().toLowerCase()]
          }
        } catch (e) {
          errors.push({ indexer: 'torbox', message: e instanceof Error ? e.message : String(e) })
        }
      } else {
        errors.push({ indexer: 'torbox', message: 'TORBOX_API_KEY is not set; cannot check cache.' })
      }

      const rank = new WeakMap<ApiResult, number>()
      for (const r of results) rank.set(r, computeRelevanceScore(q, r.title))

      results.sort((a, b) => {
        // cached -> query relevance -> title
        const ac = a.cached ? 1 : 0
        const bc = b.cached ? 1 : 0
        if (ac !== bc) return bc - ac

        const ar = rank.get(a) ?? 0
        const br = rank.get(b) ?? 0
        if (ar !== br) return br - ar

        return a.title.localeCompare(b.title)
      })

      const cachedResults = results.filter((r) => r.cached)

      return { query: q, elapsedMs: Date.now() - started, results, cachedResults, errors }
    },
  }
}
