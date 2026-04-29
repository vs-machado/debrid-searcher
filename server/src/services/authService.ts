import crypto from 'node:crypto'
import type { AppEnv } from '../config/env.js'

type AttemptState = { failedCount: number; lockedUntilMs: number }

const SESSION_COOKIE = 'dd_session'
const MAX_ATTEMPTS = 4
const LOCK_MS = 5 * 60 * 1000
const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60

function base64url(buf: Buffer) {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function unbase64url(s: string) {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad
  return Buffer.from(b64, 'base64')
}

function timingSafeEqual(a: string, b: string) {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return crypto.timingSafeEqual(ab, bb)
}

function sign(secret: string, data: string) {
  return base64url(crypto.createHmac('sha256', secret).update(data).digest())
}

export type LoginOutcome =
  | { ok: true; username: string; cookieValue: string }
  | { ok: false; reason: 'locked' | 'invalid' | 'misconfigured'; lockedUntilMs?: number; remainingAttempts?: number }

export function createAuthService(env: AppEnv) {
  const attempts = new Map<string, AttemptState>()

  function isConfigured() {
    return Boolean(env.authUsername && env.authPassword && env.authCookieSecret)
  }

  function getCookieName() {
    return SESSION_COOKIE
  }

  function cookieMaxAgeSeconds() {
    return SESSION_MAX_AGE_SECONDS
  }

  function cookieSecure() {
    return env.authCookieSecure ?? process.env.NODE_ENV === 'production'
  }

  function makeSessionCookieValue(username: string) {
    const payload = { u: username, iat: Date.now() }
    const encoded = base64url(Buffer.from(JSON.stringify(payload)))
    const sig = sign(env.authCookieSecret!, encoded)
    return `${encoded}.${sig}`
  }

  function verifySessionCookieValue(cookieValue: string | undefined): { ok: true; username: string } | { ok: false } {
    if (!cookieValue) return { ok: false }
    if (!isConfigured()) return { ok: false }
    const idx = cookieValue.lastIndexOf('.')
    if (idx <= 0) return { ok: false }
    const encoded = cookieValue.slice(0, idx)
    const sig = cookieValue.slice(idx + 1)
    const expected = sign(env.authCookieSecret!, encoded)
    if (!timingSafeEqual(sig, expected)) return { ok: false }

    try {
      const parsed = JSON.parse(unbase64url(encoded).toString('utf8')) as { u?: string }
      if (!parsed?.u) return { ok: false }
      if (parsed.u !== env.authUsername) return { ok: false }
      return { ok: true, username: parsed.u }
    } catch {
      return { ok: false }
    }
  }

  function login(ipKey: string, username: string, password: string): LoginOutcome {
    if (!isConfigured()) return { ok: false, reason: 'misconfigured' }
    const now = Date.now()
    const key = ipKey || 'unknown'

    const state = attempts.get(key) || { failedCount: 0, lockedUntilMs: 0 }
    if (state.lockedUntilMs > now) {
      return { ok: false, reason: 'locked', lockedUntilMs: state.lockedUntilMs }
    }

    if (username === env.authUsername && password === env.authPassword) {
      attempts.delete(key)
      return { ok: true, username, cookieValue: makeSessionCookieValue(username) }
    }

    const nextFailed = state.failedCount + 1
    if (nextFailed >= MAX_ATTEMPTS) {
      const lockedUntilMs = now + LOCK_MS
      attempts.set(key, { failedCount: MAX_ATTEMPTS, lockedUntilMs })
      return { ok: false, reason: 'locked', lockedUntilMs, remainingAttempts: 0 }
    }

    attempts.set(key, { failedCount: nextFailed, lockedUntilMs: 0 })
    return { ok: false, reason: 'invalid', remainingAttempts: MAX_ATTEMPTS - nextFailed }
  }

  return {
    isConfigured,
    getCookieName,
    cookieMaxAgeSeconds,
    cookieSecure,
    verifySessionCookieValue,
    login,
  }
}
