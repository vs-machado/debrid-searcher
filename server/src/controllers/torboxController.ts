import type { Request, Response } from 'express'
import { torboxAddSchema, torboxDownloadSchema } from '../schemas/torboxSchemas.js'
import type { TorboxService } from '../services/torboxService.js'

export function createTorboxAddController(torboxService: TorboxService) {
  return async (req: Request, res: Response) => {
    const body = torboxAddSchema.parse(req.body)
    const torbox = await torboxService.addFromMagnet(body)
    res.json({ ok: true, detail: 'Created torrent in TorBox.', torbox })
  }
}

export function createTorboxDownloadController(torboxService: TorboxService) {
  return async (req: Request, res: Response) => {
    const body = torboxDownloadSchema.parse(req.body)
    const out = await torboxService.downloadFromMagnet(body)
    res.json({ ok: true, detail: 'Download link ready.', ...out })
  }
}
