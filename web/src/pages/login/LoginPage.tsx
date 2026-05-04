import LoginForm from './components/LoginForm'
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthSession } from './hooks/useAuth'

export default function LoginPage() {
  const nav = useNavigate()
  const { loading, session } = useAuthSession()

  useEffect(() => {
    if (loading) return
    if (session) nav('/', { replace: true })
  }, [loading, session, nav])

  return (
    <div className="h-dvh relative flex flex-col items-center justify-center text-base-content/90 font-body overflow-hidden">
      <div className="atmo" aria-hidden="true" />
      
      <main className="relative z-10 w-full max-w-lg h-full px-4 py-3 sm:px-6 sm:py-6 flex flex-col justify-center">
        <div className="mb-4 sm:mb-12 text-center shrink-0">
          <div className="flex justify-center mb-3 sm:mb-6">
            <img
              src="/website_logo.png"
              className="brand-logo h-24 w-24 sm:h-36 sm:w-36"
              alt=""
              decoding="async"
              loading="eager"
            />
          </div>
          <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tighter leading-none uppercase">
            DEBRID <span className="text-primary/80">SEARCHER</span>
          </h1>
          <p className="text-[10px] sm:text-[11px] font-mono tracking-widest opacity-40 mt-3 sm:mt-4 uppercase leading-relaxed">
            Access Protocol // Central Management Terminal
          </p>
        </div>

        <section className="machined-card p-1 rounded-sm shadow-3xl min-h-0">
          <div className="bg-base-200/60 p-4 sm:p-8 md:p-12">
            <div className="flex items-center gap-3 mb-5 sm:mb-10 text-[10px] font-mono uppercase tracking-[0.2em] opacity-50">
              <div className="w-1.5 h-1.5 shrink-0 rounded-full bg-primary animate-blink" />
              Authentication_Required
            </div>
            
            <LoginForm />

            <div className="hidden sm:flex mt-10 pt-6 border-t border-base-content/5 flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[10px] font-mono uppercase tracking-widest opacity-30 overflow-hidden">
              <span>SECURE_SESSION_V2</span>
              <span className="min-w-0 break-all text-right">AES_256_ENCRYPTED</span>
            </div>
          </div>
        </section>

        <div className="mt-3 sm:mt-8 text-center flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[9px] sm:text-[10px] font-mono uppercase tracking-[0.2em] opacity-30 hover:opacity-100 transition-opacity shrink-0">
          <div className="w-1 h-1 rounded-full bg-success" />
          SYSTEM_OPERATIONAL
          <a className="hover:text-primary transition-colors ml-2" href="/api/health" target="_blank" rel="noreferrer">
            [DIAGNOSTICS]
          </a>
        </div>
      </main>
    </div>
  )
}
