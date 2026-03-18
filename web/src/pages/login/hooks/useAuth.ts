import { useCallback, useEffect, useState } from 'react'
import type { AuthSession } from '../types'
import { apiLogout, apiMe } from '../api'

export function useAuthSession() {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<AuthSession | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiMe()
      if (res.ok) setSession({ username: res.username })
      else setSession(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await apiLogout()
    } finally {
      await refresh()
    }
  }, [refresh])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { loading, session, refresh, logout }
}
