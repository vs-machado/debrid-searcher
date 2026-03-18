import { useCallback } from 'react'
import { apiPost } from '../api'
import type { AddResponse, DownloadResponse } from '../types'

export function useTorbox(params: {
  strictCached: boolean
  zipLink: boolean
  onLinkReady?: (url: string) => void
}) {
  const add = useCallback(
    async (magnet: string) => {
      return await apiPost<AddResponse>('/api/torbox/add', {
        magnet,
        addOnlyIfCached: params.strictCached,
      })
    },
    [params.strictCached],
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

  return { add, download }
}
