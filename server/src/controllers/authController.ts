import type { Request, Response } from 'express'
import { z } from 'zod'
import type { createAuthService } from '../services/authService.js'
import { serializeCookie, parseCookieHeader } from '../utils/cookies.js'

const loginSchema = z.object({
  username: z.string().min(1).max(200),
  password: z.string().min(1).max(200),
})

function clientIp(req: Request) {
  return req.ip || req.headers['x-forwarded-for']?.toString() || 'unknown'
}

export function createAuthLoginController(auth: ReturnType<typeof createAuthService>) {
  return (req: Request, res: Response) => {
    const body = loginSchema.parse(req.body)
    const out = auth.login(clientIp(req), body.username, body.password)
    if (!out.ok) {
      if (out.reason === 'misconfigured') {
        res.status(503).json({ ok: false, reason: 'misconfigured', detail: 'Auth is not configured' })
        return
      }
      if (out.reason === 'locked') {
        res.status(429).json({ ok: false, reason: 'locked', lockedUntilMs: out.lockedUntilMs, remainingAttempts: out.remainingAttempts })
        return
      }
      res.status(401).json({ ok: false, reason: 'invalid', remainingAttempts: out.remainingAttempts })
      return
    }

    const cookie = serializeCookie(auth.getCookieName(), out.cookieValue, {
      httpOnly: true,
      secure: auth.cookieSecure(),
      sameSite: 'lax',
      path: '/',
      maxAgeSeconds: auth.cookieMaxAgeSeconds(),
    })

    res.setHeader('set-cookie', cookie)
    res.status(200).json({ ok: true, username: out.username })
  }
}

export function createAuthLogoutController(auth: ReturnType<typeof createAuthService>) {
  return (_req: Request, res: Response) => {
    const cookie = serializeCookie(auth.getCookieName(), '', {
      httpOnly: true,
      secure: auth.cookieSecure(),
      sameSite: 'lax',
      path: '/',
      maxAgeSeconds: 0,
    })
    res.setHeader('set-cookie', cookie)
    res.status(200).json({ ok: true })
  }
}

export function createAuthMeController(auth: ReturnType<typeof createAuthService>) {
  return (req: Request, res: Response) => {
    if (!auth.isConfigured()) {
      res.status(503).json({ ok: false, reason: 'misconfigured', detail: 'Auth is not configured' })
      return
    }

    const cookies = parseCookieHeader(req.headers.cookie)
    const raw = cookies[auth.getCookieName()]
    const verified = auth.verifySessionCookieValue(raw)
    if (!verified.ok) {
      res.status(401).json({ ok: false, reason: 'unauthorized' })
      return
    }

    res.status(200).json({ ok: true, username: verified.username })
  }
}
