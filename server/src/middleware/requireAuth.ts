import type { NextFunction, Request, Response } from 'express'
import { HttpError } from '../utils/httpError.js'
import { parseCookieHeader } from '../utils/cookies.js'
import type { createAuthService } from '../services/authService.js'

export function requireAuth(auth: ReturnType<typeof createAuthService>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!auth.isConfigured()) {
      next(new HttpError(503, 'Auth is not configured'))
      return
    }

    const cookies = parseCookieHeader(req.headers.cookie)
    const raw = cookies[auth.getCookieName()]
    const verified = auth.verifySessionCookieValue(raw)
    if (!verified.ok) {
      next(new HttpError(401, 'Unauthorized'))
      return
    }

    next()
  }
}
