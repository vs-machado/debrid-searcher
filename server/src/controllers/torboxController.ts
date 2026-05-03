import type { Request, Response } from 'express'
import { torboxAddSchema, torboxDownloadSchema, torboxStatusSchema } from '../schemas/torboxSchemas.js'
import type { TorboxService } from '../services/torboxService.js'
import { findTorrentId } from '../utils/object.js'

export function createTorboxAddController(torboxService: TorboxService) {
  return async (req: Request, res: Response) => {
    const body = torboxAddSchema.parse(req.body)
    const torbox = await torboxService.addFromMagnet(body)
    res.json({ ok: true, detail: 'Created torrent in TorBox.', torrentId: findTorrentId(torbox), torbox })
  }
}

export function createTorboxStatusController(torboxService: TorboxService) {
  return async (req: Request, res: Response) => {
    const parsed = torboxStatusSchema.parse(req.query)
    const out = await torboxService.getTorrentStatus(parsed)
    res.setHeader('cache-control', 'no-store')
    res.json({ ok: true, detail: out.ready ? 'Torrent is ready in TorBox.' : 'Torrent is not ready yet.', ...out })
  }
}

export function createTorboxDownloadController(torboxService: TorboxService) {
  return async (req: Request, res: Response) => {
    const body = torboxDownloadSchema.parse(req.body)
    const out = await torboxService.downloadFromMagnet(body)
    res.json({ ok: true, detail: 'Download link ready.', ...out })
  }
}
