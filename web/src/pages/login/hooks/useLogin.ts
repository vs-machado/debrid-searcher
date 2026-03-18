import { useState } from 'react'
import type { LoginResult } from '../types'
import { apiLogin } from '../api'

export function useLogin() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<LoginResult | null>(null)

  async function submit() {
    if (submitting) return
    setSubmitting(true)
    try {
      const res = await apiLogin(username, password)
      if (res.ok) {
        setResult({ ok: true })
        return { ok: true } as const
      }

      const fail: LoginResult = {
        ok: false,
        reason: res.reason,
        lockedUntilMs: res.lockedUntilMs,
        remainingAttempts: res.remainingAttempts,
      }
      setResult(fail)
      return fail
    } finally {
      setSubmitting(false)
    }
  }

  return {
    username,
    setUsername,
    password,
    setPassword,
    submitting,
    result,
    lockedUntilMs: result?.ok === false && result.reason === 'locked' ? (result.lockedUntilMs || 0) : 0,
    submit,
  }
}
