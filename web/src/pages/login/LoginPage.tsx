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
    <div className="min-h-dvh relative flex flex-col items-center justify-center text-base-content/90 font-body overflow-hidden">
      <div className="atmo" aria-hidden="true" />
      
      {/* Decorative Brand Background */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] select-none">
        <h1 className="font-display text-[20vw] font-black uppercase tracking-tighter leading-none">
          DEBRID
        </h1>
      </div>

      <main className="relative z-10 w-full max-w-lg px-6">
        <div className="mb-12 text-center">
          <div className="flex justify-center mb-6">
            <div className="brand-mark h-12 w-12" aria-hidden="true" />
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-extrabold tracking-tighter leading-none uppercase">
            DEBRID <span className="text-primary/80">LAB</span>
          </h1>
          <p className="text-[11px] font-mono tracking-widest opacity-40 mt-4 uppercase">
            Access Protocol // Central Management Terminal
          </p>
        </div>

        <section className="machined-card p-1 rounded-sm shadow-3xl">
          <div className="bg-base-200/60 p-8 md:p-12">
            <div className="flex items-center gap-3 mb-10 text-[10px] font-mono uppercase tracking-[0.2em] opacity-50">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Authentication_Required
            </div>
            
            <LoginForm />

            <div className="mt-10 pt-6 border-t border-base-content/5 flex items-center justify-between text-[10px] font-mono uppercase tracking-widest opacity-30">
              <span>SECURE_SESSION_V2</span>
              <span>AES_256_ENCRYPTED</span>
            </div>
          </div>
        </section>

        <div className="mt-8 text-center flex items-center justify-center gap-4 text-[10px] font-mono uppercase tracking-[0.2em] opacity-30 hover:opacity-100 transition-opacity">
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
