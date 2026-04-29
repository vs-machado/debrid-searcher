import { XMLParser } from 'fast-xml-parser'
import { btihToInfoHashHex, magnetToInfoHashHex } from '../utils/hash.js'

export type TorznabResult = {
  title: string
  indexer: string
  seeders?: number
  leechers?: number
  size?: number
  publishDate?: string
  infoHash?: string
  magnet?: string
  downloadUrl?: string
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: false,
})

function asArray<T>(v: T | T[] | undefined): T[] {
  if (!v) return []
  return Array.isArray(v) ? v : [v]
}

function attrValue(attrs: unknown, name: string): string | undefined {
  const list = asArray<any>(attrs as any)
  for (const a of list) {
    const n = (a?.['@_name'] ?? a?.name ?? '').toString().toLowerCase()
    if (n === name.toLowerCase()) return (a?.['@_value'] ?? a?.value ?? '').toString()
  }
  return undefined
}

function toInt(v: unknown): number | undefined {
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

function pickMagnet(item: any): string | undefined {
  const enc = item?.enclosure
  const url = enc?.['@_url'] || item?.link || item?.guid
  if (typeof url === 'string' && url.startsWith('magnet:?')) return url
  return undefined
}

function pickDownloadUrl(item: any): string | undefined {
  const enc = item?.enclosure
  const url = enc?.['@_url']
  if (typeof url === 'string' && /^https?:\/\//i.test(url)) return url
  const link = item?.link
  if (typeof link === 'string' && /^https?:\/\//i.test(link)) return link
  return undefined
}

export async function searchTorznab(indexerUrl: string, query: string, timeoutMs = 60000): Promise<TorznabResult[]> {
  const u = new URL(indexerUrl)
  u.searchParams.set('t', u.searchParams.get('t') || 'search')
  u.searchParams.set('q', query)

  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), timeoutMs)

  try {
    const res = await fetch(u.toString(), { signal: ac.signal })
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
    const xml = await res.text()
    const parsed = parser.parse(xml)
    const items = asArray<any>(parsed?.rss?.channel?.item)

    const indexerName = u.hostname

    return items
      .map((item) => {
        const attrs = item?.['torznab:attr'] || item?.attr
        const magnet = pickMagnet(item)
        const rawInfoHash = attrValue(attrs, 'infohash') || attrValue(attrs, 'infoHash')
        const infoHash = btihToInfoHashHex(rawInfoHash || '') || (magnet ? magnetToInfoHashHex(magnet) : undefined)

        const seeders = toInt(attrValue(attrs, 'seeders'))
        const leechers = toInt(attrValue(attrs, 'peers')) ?? toInt(attrValue(attrs, 'leechers'))
        const size = toInt(item?.size ?? item?.['torznab:size'] ?? item?.enclosure?.['@_length'])
        const publishDate = typeof item?.pubDate === 'string' ? item.pubDate : undefined
        const title = typeof item?.title === 'string' ? item.title : 'Untitled'

        const downloadUrl = magnet ? undefined : pickDownloadUrl(item)

        const out: TorznabResult = {
          title,
          indexer: indexerName,
          seeders,
          leechers,
          size,
          publishDate,
          infoHash,
          magnet,
          downloadUrl,
        }

        return out
      })
      .filter((r) => r.title)
  } finally {
    clearTimeout(t)
  }
}
