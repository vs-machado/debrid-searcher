import { apiGet, apiPostJson } from '../search/api'

export type MeResponse = { ok: true; username: string } | { ok: false; reason: 'unauthorized' | 'misconfigured'; detail?: string }

export async function apiMe(): Promise<MeResponse> {
  try {
    const out = await apiGet<MeResponse>('/api/auth/me')
    return out
  } catch {
    return { ok: false, reason: 'unauthorized' }
  }
}

export type LoginResponse =
  | { ok: true; username: string }
  | { ok: false; reason: 'locked' | 'invalid' | 'misconfigured'; detail?: string; lockedUntilMs?: number; remainingAttempts?: number }

export async function apiLogin(username: string, password: string): Promise<LoginResponse> {
  const res = await apiPostJson('/api/auth/login', { username, password })
  return res.json as LoginResponse
}

export async function apiLogout(): Promise<{ ok: true } | { ok: false } > {
  const res = await apiPostJson('/api/auth/logout', {})
  return res.json as any
}
