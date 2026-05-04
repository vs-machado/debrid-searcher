import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLogin } from '../hooks/useLogin'

function fmtCountdown(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}

export default function LoginForm() {
  const nav = useNavigate()
  const { username, setUsername, password, setPassword, submitting, result, lockedUntilMs, submit } = useLogin()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!lockedUntilMs) return
    const t = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(t)
  }, [lockedUntilMs])

  const lockedMsLeft = useMemo(() => {
    if (!lockedUntilMs) return 0
    return Math.max(0, lockedUntilMs - now)
  }, [lockedUntilMs, now])

  return (
    <form
      className="space-y-5 sm:space-y-8"
      onSubmit={(e) => {
        e.preventDefault()
        void submit().then((res) => {
          if (res?.ok) nav('/', { replace: true })
        })
      }}
    >
      <div className="flex flex-col gap-2 sm:gap-3">
        <label className="text-[10px] font-mono uppercase tracking-[0.2em] opacity-40 px-2 flex justify-between">
          Username
          {submitting && <span className="text-primary animate-pulse">Syncing...</span>}
        </label>
        <input
          className="input w-full bg-base-300/40 border border-primary/40 font-mono text-base sm:text-lg focus:border-primary focus:ring-2 focus:ring-primary/10 focus:outline-none placeholder:opacity-20 h-12 sm:h-16 rounded-sm transition-all"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="ENTER_ID"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={submitting || lockedMsLeft > 0}
        />
      </div>

      <div className="flex flex-col gap-2 sm:gap-3">
        <label className="text-[10px] font-mono uppercase tracking-[0.2em] opacity-40 px-2 flex justify-between">
          Access_Key
          {lockedMsLeft > 0 && <span className="text-error">LOCKOUT: {fmtCountdown(lockedMsLeft)}</span>}
        </label>
        <input
          className="input w-full bg-base-300/40 border border-primary/40 font-mono text-base sm:text-lg focus:border-primary focus:ring-2 focus:ring-primary/10 focus:outline-none placeholder:opacity-20 h-12 sm:h-16 rounded-sm transition-all"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={submitting || lockedMsLeft > 0}
        />
      </div>

      <div className="space-y-3 sm:space-y-4">
        {result?.ok === false && result.reason === 'misconfigured' && (
          <div className="p-4 bg-warning/10 border border-warning/20 rounded-sm text-[11px] font-mono uppercase tracking-tight text-warning/80 leading-relaxed">
            [FATAL] SERVER_AUTH_MISCONFIGURED: CHECK_ENVIRONMENT_VARIABLES
          </div>
        )}

        {result?.ok === false && result.reason === 'invalid' && (
          <div className="p-4 bg-error/10 border border-error/20 rounded-sm text-[11px] font-mono uppercase tracking-tight text-error/80 leading-relaxed">
            [ACCESS_DENIED] INVALID_CREDENTIALS: {result.remainingAttempts ?? '?'} ATTEMPTS_REMAINING
          </div>
        )}

        {lockedMsLeft > 0 && (
          <div className="p-4 bg-error/20 border border-error/40 rounded-sm text-[11px] font-mono uppercase tracking-tight text-error/80 leading-relaxed animate-pulse">
            [LOCKED] TOO_MANY_FAILED_ATTEMPTS: RE-SYNC_IN {fmtCountdown(lockedMsLeft)}
          </div>
        )}

        <button 
          className="btn btn-primary h-12 sm:h-16 w-full rounded-sm font-mono uppercase tracking-[0.18em] sm:tracking-[0.3em] group relative overflow-hidden" 
          type="submit" 
          disabled={submitting || lockedMsLeft > 0}
        >
          {submitting ? (
            <span className="loading loading-spinner loading-md" />
          ) : (
            <span className="flex items-center gap-2">
              Execute_Auth_Sequence
              <span className="animate-blink">_</span>
            </span>
          )}
        </button>
      </div>
    </form>
  )
}
