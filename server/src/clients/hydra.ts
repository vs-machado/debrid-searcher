import { btihToInfoHashHex, magnetToInfoHashHex } from '../utils/hash.js'
import type { TorznabResult } from './torznab.js'

type JsonObject = Record<string, unknown>

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function firstString(object: JsonObject, keys: string[]) {
  for (const key of keys) {
    const value = object[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return undefined
}

function collectUris(value: unknown): string[] {
  if (typeof value === 'string') return [value.trim()].filter(Boolean)
  if (Array.isArray(value)) return value.flatMap(collectUris)
  if (!isObject(value)) return []

  const uri = firstString(value, ['uri', 'url', 'href', 'magnet'])
  return uri ? [uri] : []
}

function getEntries(payload: unknown): JsonObject[] {
  if (Array.isArray(payload)) return payload.filter(isObject)
  if (!isObject(payload)) return []

  for (const key of ['downloads', 'games', 'items', 'data']) {
    const entries = payload[key]
    if (Array.isArray(entries)) return entries.filter(isObject)
  }

  return []
}

function normalizeSearchText(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function parseNumber(value: unknown): number | undefined {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : undefined
}

function parseSize(value: unknown): number | undefined {
  const number = parseNumber(value)
  if (number !== undefined) return number
  if (typeof value !== 'string') return undefined

  const match = value.trim().replace(/,/g, '').match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB|TB)$/i)
  if (!match) return undefined

  const units: Record<string, number> = { B: 0, KB: 1, MB: 2, GB: 3, TB: 4 }
  return Number(match[1]) * 1024 ** units[match[2].toUpperCase()]
}

function sourceName(payload: unknown, sourceUrl: string) {
  if (isObject(payload)) {
    const name = firstString(payload, ['name', 'source', 'title'])
    if (name) return name
  }

  return new URL(sourceUrl).hostname
}

function endpointName(sourceUrl: string) {
  try {
    return new URL(sourceUrl).hostname
  } catch {
    return sourceUrl
  }
}

export async function searchHydraSource(sourceUrl: string, query: string, timeoutMs = 60000): Promise<TorznabResult[]> {
  const ac = new AbortController()
  const timeout = setTimeout(() => ac.abort(), timeoutMs)

  try {
    const response = await fetch(sourceUrl, {
      signal: ac.signal,
      headers: { accept: 'application/json' },
    })
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)

    const payload = (await response.json()) as unknown
    const name = sourceName(payload, sourceUrl)
    const terms = normalizeSearchText(query).split(' ').filter(Boolean)

    return getEntries(payload)
      .filter((entry) => {
        const title = firstString(entry, ['title', 'name', 'gameName', 'displayName'])
        if (!title) return false
        const normalizedTitle = normalizeSearchText(title)
        return terms.every((term) => normalizedTitle.includes(term))
      })
      .flatMap((entry) => {
        const title = firstString(entry, ['title', 'name', 'gameName', 'displayName']) || 'Untitled'
        const uris = [
          ...collectUris(entry.uris),
          ...collectUris(entry.uri),
          ...collectUris(entry.magnets),
          ...collectUris(entry.magnet),
          ...collectUris(entry.links),
          ...collectUris(entry.downloadUrls),
          ...collectUris(entry.downloadUrl),
        ].filter((uri, index, all) => all.indexOf(uri) === index)
        const magnet = uris.find((uri) => /^magnet:\?/i.test(uri))
        const downloadUrl = magnet ? undefined : uris.find((uri) => /^https?:\/\//i.test(uri))
        const explicitInfoHash = firstString(entry, ['infoHash', 'infohash', 'hash'])
        const infoHash = btihToInfoHashHex(explicitInfoHash || '') || (magnet ? magnetToInfoHashHex(magnet) : undefined)

        if (!magnet && !downloadUrl && !infoHash) return []

        return [{
          title,
          indexer: name,
          size: parseSize(entry.fileSize ?? entry.filesize ?? entry.size),
          publishDate: firstString(entry, ['uploadDate', 'upload_date', 'publishDate', 'publishedAt', 'date']),
          infoHash,
          magnet,
          downloadUrl,
          seeders: parseNumber(entry.seeders),
          leechers: parseNumber(entry.leechers),
        }]
      })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs}ms`)
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

export function hydraSourceName(sourceUrl: string) {
  return endpointName(sourceUrl)
}
