export type SearchResult = {
  title: string
  indexer: string
  seeders?: number
  leechers?: number
  size?: number
  publishDate?: string
  infoHash?: string
  magnet?: string
  downloadUrl?: string
  cached?: boolean
}

export type SearchResponse = {
  query: string
  elapsedMs: number
  results: SearchResult[]
  cachedResults: SearchResult[]
  errors: Array<{ indexer: string; message: string }>
}

export type AddResponse = {
  ok: boolean
  detail?: string
  torbox?: unknown
}

export type DownloadResponse = {
  ok: boolean
  detail?: string
  url?: string
  torrentId?: number
}
