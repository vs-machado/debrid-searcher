import type { NextFunction, Request, Response } from 'express'
import { ZodError } from 'zod'
import { HttpError } from '../utils/httpError.js'

export function errorHandler() {
  return (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (res.headersSent) return

    if (err instanceof HttpError) {
      res.status(err.status).json({ ok: false, detail: err.message })
      return
    }

    if (err instanceof ZodError) {
      res.status(400).json({ ok: false, detail: 'Invalid request', issues: err.issues })
      return
    }

    console.error(err)
    res.status(500).json({ ok: false, detail: 'Internal server error' })
  }
}
