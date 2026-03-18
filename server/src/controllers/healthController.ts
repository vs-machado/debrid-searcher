import type { Request, Response } from 'express'

export function healthController(_req: Request, res: Response) {
  res.json({ ok: true })
}
