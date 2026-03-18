export type AuthSession = {
  username: string
}

export type LoginAttemptState = {
  failedCount: number
  lockedUntilMs: number
}

export type LoginResult =
  | { ok: true }
  | {
      ok: false
      reason: 'locked' | 'invalid' | 'misconfigured'
      lockedUntilMs?: number
      remainingAttempts?: number
    }
