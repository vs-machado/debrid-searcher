import { useCallback } from 'react'
import { apiGet, apiPost } from '../api'
import type { AddResponse, DownloadResponse, TorboxStatusResponse } from '../types'

export function useTorbox(params: {
  strictCached: boolean
  zipLink: boolean
  onLinkReady?: (url: string) => void
}) {
  const add = useCallback(
    async (magnet: string) => {
      return await apiPost<AddResponse>('/api/torbox/add', {
        magnet,
        addOnlyIfCached: false,
      })
    },
    [],
  )

  const download = useCallback(
    async (input: { magnet: string; infoHash?: string }) => {
      const res = await apiPost<DownloadResponse>('/api/torbox/download', {
        magnet: input.magnet,
        infoHash: input.infoHash,
        addOnlyIfCached: params.strictCached,
        zipLink: params.zipLink,
      })

      if (res.url && params.onLinkReady) params.onLinkReady(res.url)
      return res
    },
    [params.strictCached, params.zipLink, params.onLinkReady],
  )

  const status = useCallback(async (input: { torrentId?: number; infoHash?: string }) => {
    const qs = new URLSearchParams()
    if (input.torrentId !== undefined) qs.set('torrentId', String(input.torrentId))
    if (input.infoHash) qs.set('infoHash', input.infoHash)
    return await apiGet<TorboxStatusResponse>(`/api/torbox/status?${qs.toString()}`)
  }, [])

  return { add, download, status }
}
