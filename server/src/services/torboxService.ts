import type { AppEnv } from '../config/env.js'
import { torboxClient } from '../clients/torbox.js'
import { HttpError } from '../utils/httpError.js'
import { findTorrentId, isRecord, unwrapStandardData } from '../utils/object.js'

export type TorboxService = {
  addFromMagnet: (params: { magnet: string; addOnlyIfCached: boolean }) => Promise<unknown>
  getTorrentStatus: (params: { torrentId?: number; infoHash?: string }) => Promise<{
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
  }>
  downloadFromMagnet: (params: {
    magnet: string
    infoHash?: string
    addOnlyIfCached: boolean
    zipLink: boolean
  }) => Promise<{ url: string; torrentId: number }>
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined
}

function lowerText(v: unknown): string | undefined {
  const s = asString(v)
  return s ? s.toLowerCase() : undefined
}

function pickTorrentHash(v: unknown): string | undefined {
  if (!isRecord(v)) return undefined
  return asString((v as any).hash) ?? asString((v as any).infoHash) ?? asString((v as any).info_hash)
}

function pickTorrentStatus(v: unknown): string | undefined {
  if (!isRecord(v)) return undefined
  return (
    asString((v as any).download_state) ??
    asString((v as any).downloadState) ??
    asString((v as any).status) ??
    asString((v as any).state)
  )
}

function pickTorrentLabel(v: unknown): string | undefined {
  if (!isRecord(v)) return undefined
  return (
    asString((v as any).download_label) ??
    asString((v as any).downloadLabel) ??
    asString((v as any).label) ??
    asString((v as any).availability)
  )
}

function pickTorrentProgress(v: unknown): number | undefined {
  if (!isRecord(v)) return undefined
  const raw = (v as any).progress ?? (v as any).download_progress ?? (v as any).downloadProgress ?? (v as any).percent ?? (v as any).percentage
  const n = typeof raw === 'string' ? Number(raw) : raw
  if (typeof n !== 'number' || !Number.isFinite(n)) return undefined
  const percent = n <= 1 ? n * 100 : n
  return Number(Math.max(0, Math.min(100, percent)).toFixed(6))
}

function pickTorrentUserId(v: unknown): string | undefined {
  if (!isRecord(v)) return undefined
  return asString((v as any).auth_id) ?? asString((v as any).authId) ?? asString((v as any).owner) ?? asString((v as any).user_id) ?? asString((v as any).userId)
}

function isTorrentReady(v: unknown) {
  if (!isRecord(v)) return false

  const status = lowerText(pickTorrentStatus(v))
  const label = lowerText(pickTorrentLabel(v))
  const readyFlag = (v as any).download_ready ?? (v as any).downloadReady ?? (v as any).ready
  const cachedFlag = (v as any).cached ?? (v as any).is_cached ?? (v as any).isCached

  return (
    readyFlag === true ||
    cachedFlag === true ||
    status === 'cached' ||
    status === 'download ready' ||
    status === 'download_ready' ||
    label === 'cached' ||
    label === 'download ready' ||
    label === 'download_ready'
  )
}

function findTorrentItem(items: unknown, params: { torrentId?: number; infoHash?: string }) {
  const wantHash = params.infoHash?.trim().toLowerCase()

  if (isRecord(items)) {
    if (params.torrentId !== undefined && findTorrentId(items) === params.torrentId) return items
    const hash = pickTorrentHash(items)?.trim().toLowerCase()
    if (wantHash && hash === wantHash) return items
  }

  if (!Array.isArray(items)) return undefined
  for (const item of items) {
    if (!isRecord(item)) continue
    if (params.torrentId !== undefined && findTorrentId(item) === params.torrentId) return item
    const hash = pickTorrentHash(item)?.trim().toLowerCase()
    if (wantHash && hash === wantHash) return item
  }
  return undefined
}

export function createTorboxService(env: AppEnv): TorboxService {
  return {
    async addFromMagnet(params) {
      if (!env.torboxApiKey) throw new HttpError(400, 'TORBOX_API_KEY is not set')

      const client = torboxClient({ baseUrl: env.torboxBaseUrl, apiKey: env.torboxApiKey })
      try {
        return await client.createTorrentFromMagnet(params.magnet, params.addOnlyIfCached)
      } catch (e) {
        throw new HttpError(502, e instanceof Error ? e.message : String(e))
      }
    },

    async getTorrentStatus(params) {
      if (!env.torboxApiKey) throw new HttpError(400, 'TORBOX_API_KEY is not set')

      const client = torboxClient({ baseUrl: env.torboxBaseUrl, relayBaseUrl: env.torboxRelayBaseUrl, apiKey: env.torboxApiKey })
      try {
        const listParams = {
          id: params.torrentId,
          bypassCache: true,
          limit: params.torrentId ? undefined : 200,
          offset: params.torrentId ? undefined : 0,
        }
        let list = await client.getTorrentList(listParams)
        let item = findTorrentItem(unwrapStandardData(list), params)
        let refreshed = false

        const torrentIdForRefresh = item ? findTorrentId(item) : params.torrentId
        const userId = pickTorrentUserId(item)
        if (item && torrentIdForRefresh !== undefined && userId && !isTorrentReady(item)) {
          try {
            await client.requestTorrentUpdate({ userId, torrentId: torrentIdForRefresh })
            refreshed = true
            list = await client.getTorrentList(listParams)
            item = findTorrentItem(unwrapStandardData(list), params)
          } catch {
            // Relay refresh is best-effort; return the latest main API snapshot if it fails.
          }
        }

        const torrentId = item ? findTorrentId(item) : params.torrentId
        const infoHash = item ? pickTorrentHash(item) : params.infoHash
        const status = pickTorrentStatus(item)
        const label = pickTorrentLabel(item)
        const progress = pickTorrentProgress(item)
        const ready = isTorrentReady(item)

        return {
          torrentId,
          infoHash,
          found: !!item,
          ready,
          cached: ready,
          status,
          label,
          progress,
          refreshed,
          torbox: item,
        }
      } catch (e) {
        throw new HttpError(502, e instanceof Error ? e.message : String(e))
      }
    },

    async downloadFromMagnet(params) {
      if (!env.torboxApiKey) throw new HttpError(400, 'TORBOX_API_KEY is not set')

      const client = torboxClient({ baseUrl: env.torboxBaseUrl, relayBaseUrl: env.torboxRelayBaseUrl, apiKey: env.torboxApiKey })

      let torrentId: number | undefined
      let createErr: unknown = null
      try {
        const created = await client.createTorrentFromMagnet(params.magnet, params.addOnlyIfCached)
        torrentId = findTorrentId(created)
      } catch (e) {
        createErr = e
      }

      // If create failed (often due to duplicates), try to locate it by hash in the user's list.
      if (torrentId === undefined && params.infoHash) {
        try {
          const list = await client.getTorrentList({ bypassCache: true, limit: 200, offset: 0 })
          const items = unwrapStandardData(list)
          if (Array.isArray(items)) {
            const want = params.infoHash.trim().toLowerCase()
            for (const it of items) {
              if (!isRecord(it)) continue
              const h = typeof (it as any).hash === 'string' ? (it as any).hash.trim().toLowerCase() : ''
              if (h && h === want) {
                const id = findTorrentId(it)
                if (id !== undefined) {
                  torrentId = id
                  break
                }
              }
            }
          }
        } catch {
          // ignore fallback errors; surface the original create error below
        }
      }

      if (torrentId === undefined) {
        const msg = createErr instanceof Error ? createErr.message : String(createErr || 'Failed to create torrent in TorBox')
        throw new HttpError(502, msg)
      }

      try {
        const url = await client.requestTorrentDownloadLink({ torrentId, zipLink: params.zipLink, redirect: false })
        return { url, torrentId }
      } catch (e) {
        throw new HttpError(502, e instanceof Error ? e.message : String(e))
      }
    },
  }
}
