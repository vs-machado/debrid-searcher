import type { AppEnv } from '../config/env.js'
import { torboxClient } from '../clients/torbox.js'
import { HttpError } from '../utils/httpError.js'
import { findTorrentId, isRecord, unwrapStandardData } from '../utils/object.js'

export type TorboxService = {
  addFromMagnet: (params: { magnet: string; addOnlyIfCached: boolean }) => Promise<unknown>
  downloadFromMagnet: (params: {
    magnet: string
    infoHash?: string
    addOnlyIfCached: boolean
    zipLink: boolean
  }) => Promise<{ url: string; torrentId: number }>
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

    async downloadFromMagnet(params) {
      if (!env.torboxApiKey) throw new HttpError(400, 'TORBOX_API_KEY is not set')

      const client = torboxClient({ baseUrl: env.torboxBaseUrl, apiKey: env.torboxApiKey })

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
