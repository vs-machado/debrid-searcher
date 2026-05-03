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

export type TorboxPollPhase = 'added' | 'checking' | 'ready' | 'failed'

export type TorboxPollState = {
  phase: TorboxPollPhase
  torrentId?: number
  status?: string
  label?: string
  progress?: number
  message?: string
}

export type TorboxTrackedTorrent = TorboxPollState & {
  key: string
  title: string
  magnet?: string
  infoHash?: string
  addedAt: number
  updatedAt: number
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
  torrentId?: number
  torbox?: unknown
}

export type TorboxStatusResponse = {
  ok: boolean
  detail?: string
  torrentId?: number
  infoHash?: string
  found: boolean
  ready: boolean
  cached: boolean
  status?: string
  label?: string
  progress?: number
  refreshed?: boolean
  torbox?: unknown
}

export type DownloadResponse = {
  ok: boolean
  detail?: string
  url?: string
  torrentId?: number
}
