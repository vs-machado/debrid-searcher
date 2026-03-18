import { useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import type { SearchResult } from './types'
import ToastHost from './components/ToastHost'
import ResultCard from './components/ResultCard'
import { fmtBytes } from './lib/format'
import { useToasts } from './hooks/useToasts'
import { useClipboard } from './hooks/useClipboard'
import { useSearch } from './hooks/useSearch'
import { useTorbox } from './hooks/useTorbox'
import { useAuthSession } from '../login/hooks/useAuth'

type ViewMode = 'cached' | 'all'

export default function SearchPage() {
  const navigate = useNavigate()
  const { logout, session, loading: authLoading } = useAuthSession()
  const [view, setView] = useState<ViewMode>('cached')

  if (!authLoading && !session) {
    return <Navigate to="/login" />
  }

  const [strictCached, setStrictCached] = useState(true)
  const [zipLink, setZipLink] = useState(true)

  const { q, setQ, loading, data, cachedCount, run: runSearch } = useSearch()
  const [selected, setSelected] = useState<SearchResult | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const { toasts, push, dismiss } = useToasts()
  const { copyText } = useClipboard()
  const dialogRef = useRef<HTMLDialogElement | null>(null)

  const { add: torboxAdd, download: torboxDownload } = useTorbox({
    strictCached,
    zipLink,
    onLinkReady: (url) => window.open(url, '_blank', 'noopener,noreferrer'),
  })

  const results = useMemo(() => {
    if (!data) return []
    if (view === 'all') return data.results
    return data.cachedResults?.length ? data.cachedResults : data.results.filter((r) => r.cached)
  }, [data, view])

  async function doSearch() {
    const res = await runSearch()
    if (res.ok) {
      push('success', 'Search complete', `${res.out.results.length} result(s) in ${res.out.elapsedMs}ms`)
    } else if (res.query) {
      push('error', 'Search failed', res.error)
    }
  }

  async function copyMagnet(magnet?: string) {
    if (!magnet) return
    try {
      await copyText(magnet)
      push('success', 'Copied magnet')
    } catch {
      push('warning', 'Clipboard blocked', 'Your browser blocked clipboard access.')
    }
  }

  async function addToTorbox(magnet?: string) {
    if (!magnet) return
    try {
      const res = await torboxAdd(magnet)
      push('success', res.detail || 'Added to TorBox')
    } catch (e) {
      push('error', 'TorBox add failed', e instanceof Error ? e.message : String(e))
    }
  }

  async function downloadFromTorbox(magnet?: string, infoHash?: string) {
    if (!magnet) return
    try {
      const res = await torboxDownload({ magnet, infoHash })
      if (!res.url) {
        push('error', 'No URL returned')
        return
      }
      push('success', 'Download link ready', `Torrent ${res.torrentId ?? ''}`.trim())
    } catch (e) {
      push('error', 'TorBox download failed', e instanceof Error ? e.message : String(e))
    }
  }

  function openDetails(r: SearchResult) {
    setSelected(r)
    dialogRef.current?.showModal()
  }

  return (
    <div className="min-h-dvh relative text-base-content/90 font-body">
      <div className="atmo" aria-hidden="true" />
      <ToastHost toasts={toasts} onClose={dismiss} />

      {/* Navigation Header */}
      <nav className="max-w-6xl mx-auto px-6 py-12 flex flex-col md:flex-row gap-6 md:items-end justify-between border-b border-base-content/5 mb-8">
        <div className="flex gap-5 items-center">
          <div className="brand-mark shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <h1 className="font-display text-4xl md:text-5xl font-extrabold tracking-tighter leading-none uppercase">
              DEBRID <span className="text-primary/80">LAB</span>
            </h1>
            <p className="text-[11px] font-mono tracking-widest opacity-40 mt-3 uppercase">
              Torznab Indexer Engine // TorBox Cache Intelligence
            </p>
          </div>
        </div>

        <div className="flex flex-col md:items-end gap-3 text-right">
          <div className="flex items-center gap-4 text-[11px] font-mono uppercase tracking-widest opacity-60">
            <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse shrink-0" />
            System_Operational
            <a className="hover:text-primary transition-colors" href="/api/health" target="_blank" rel="noreferrer">
              [API_HEALTH]
            </a>
          </div>
          <div className="flex items-center gap-4 font-mono text-[10px] uppercase tracking-[0.2em]">
            <span className="opacity-50">Identity:</span>
            <span className="text-primary font-bold">{session?.username || 'ANON'}</span>
            <button 
              onClick={async () => {
                await logout()
                navigate('/login')
              }}
              className="ml-2 px-2 py-0.5 border border-primary/30 hover:bg-primary/20 hover:border-primary/50 transition-all text-primary/80 hover:text-primary"
            >
              [DISCONNECT]
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 pb-24">
        {/* Control Center */}
        <section className="machined-card p-1 rounded-sm">
          <div className="bg-base-200/40 p-6 md:p-8 flex flex-col gap-8">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
              <div className="md:col-span-8 flex flex-col gap-3">
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] opacity-50">Main_Search_Input</span>
                <input
                  className="input w-full bg-base-300/40 border border-primary/40 font-mono text-lg focus:border-primary focus:ring-2 focus:ring-primary/10 focus:outline-none placeholder:opacity-20 h-16 rounded-sm transition-all"
                  type="search"
                  placeholder="E.G. DUNE_2024_REMUX"
                  value={q}
                  onChange={(e) => setQ(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void doSearch()
                  }}
                  disabled={loading}
                />
              </div>

              <div className="md:col-span-4 flex gap-4">
                <label className="btn btn-outline border-base-content/10 flex-1 hover:bg-base-100 hover:text-primary rounded-sm h-16">
                  <input
                    type="checkbox"
                    className="toggle toggle-primary toggle-sm mr-2"
                    checked={view === 'cached'}
                    onChange={(e) => setView(e.target.checked ? 'cached' : 'all')}
                  />
                  <span className="text-[11px] font-mono uppercase tracking-widest">Only_Cached</span>
                </label>

                <button 
                  className="btn btn-primary h-16 px-10 rounded-sm font-mono uppercase tracking-widest group" 
                  onClick={() => void doSearch()} 
                  disabled={loading}
                >
                  {loading ? (
                    <span className="loading loading-spinner loading-sm" />
                  ) : (
                    <span className="flex items-center gap-2">
                      Run
                      <span className="animate-blink">_</span>
                    </span>
                  )}
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 py-2 border-t border-base-content/5">
              <div className="text-[11px] font-mono opacity-50 flex items-center gap-6">
                {data ? (
                  <>
                    <div>CACHE: <span className="text-success">{cachedCount}</span></div>
                    <div>TOTAL: {data.results.length}</div>
                    <div>TIME: {data.elapsedMs}MS</div>
                  </>
                ) : (
                  <div>READY: WAITING FOR_COMMAND</div>
                )}
              </div>

              <div className="flex gap-4">
                <button 
                  className={`text-[10px] font-mono uppercase tracking-widest transition-opacity ${showAdvanced ? 'opacity-100 text-primary' : 'opacity-30 hover:opacity-100'}`}
                  onClick={() => setShowAdvanced(!showAdvanced)}
                >
                  {showAdvanced ? '[-] CLOSE_CONFIG' : '[+] OPEN_CONFIG'}
                </button>
              </div>
            </div>

            {showAdvanced && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-6 border-t border-base-content/5 animate-rise">
                <ConfigCard 
                  title="STRICT_CACHE_PROTECTION"
                  desc="Prevents any operation on uncached torrents."
                  checked={strictCached}
                  onChange={(v) => setStrictCached(v)}
                />
                <ConfigCard 
                  title="ZIP_PACKAGE_LINKS"
                  desc="Requests results as ZIP archives."
                  checked={zipLink}
                  onChange={(v) => setZipLink(v)}
                />
                <div className="p-5 bg-base-300/30 border border-base-content/5 rounded-sm">
                  <div className="text-[10px] font-mono uppercase tracking-[0.2em] opacity-40 mb-3">GLOBAL_VIEW_MODE</div>
                  <div className="join flex">
                    <button 
                      className={`btn btn-sm join-item flex-1 font-mono uppercase text-[10px] ${view === 'cached' ? 'btn-neutral' : 'btn-ghost'}`}
                      onClick={() => setView('cached')}
                    >
                      Cached
                    </button>
                    <button 
                      className={`btn btn-sm join-item flex-1 font-mono uppercase text-[10px] ${view === 'all' ? 'btn-neutral' : 'btn-ghost'}`}
                      onClick={() => setView('all')}
                    >
                      All
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Results Stream */}
        <section className="mt-16">
          {!data && !loading && (
            <div className="empty-state border-dashed opacity-50">
              <h2 className="font-display text-2xl font-bold uppercase tracking-tight">ENGINE_IDLE</h2>
              <p className="mt-2 text-sm opacity-60">System is ready for torznab search queries.</p>
            </div>
          )}

          {loading && (
            <div className="grid grid-cols-1 gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="machined-card h-40 shimmer opacity-20" />
              ))}
            </div>
          )}

          {data && !loading && (
            results.length ? (
              <div className="grid grid-cols-1 gap-4">
                {results.map((r, idx) => (
                  <ResultCard
                    key={`${r.infoHash || r.magnet || r.title}-${idx}`}
                    r={r}
                    strictCached={strictCached}
                    onInspect={() => openDetails(r)}
                    onCopyMagnet={() => void copyMagnet(r.magnet)}
                    onAdd={() => void addToTorbox(r.magnet)}
                    onDownload={() => void downloadFromTorbox(r.magnet, r.infoHash)}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <h2 className="font-display text-2xl font-bold uppercase tracking-tight text-error/80">NO_RESULTS_MATCHED</h2>
                <p className="mt-2 text-sm opacity-60">Adjust filters or search parameters.</p>
              </div>
            )
          )}
        </section>
      </main>

      {/* Details Dialog */}
      <dialog ref={dialogRef} className="modal backdrop-blur-sm">
        <div className="modal-box rounded-sm bg-base-200 border border-base-content/10 max-w-4xl p-0 overflow-hidden shadow-3xl">
          <div className="bg-base-300 px-8 py-6 border-b border-base-content/5 flex items-start justify-between">
            <div className="min-w-0 pr-12">
              <h3 className="font-display text-2xl font-black uppercase tracking-tighter leading-tight break-words">
                {selected?.title}
              </h3>
              <div className="mt-4 flex flex-wrap gap-4 font-mono text-[10px] tracking-widest uppercase opacity-60">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  INDEXER: {selected?.indexer}
                </div>
                {selected?.size && <div>SIZE: {fmtBytes(selected.size)}</div>}
                {selected?.publishDate && <div>PUBLISHED: {selected.publishDate}</div>}
              </div>
            </div>
            <form method="dialog">
              <button className="btn btn-sm btn-ghost font-mono opacity-50 hover:opacity-100">[X]</button>
            </form>
          </div>

          <div className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <DetailBox label="HASH_IDENTIFIER" value={selected?.infoHash || 'N/A'} mono />
              <DetailBox label="HEALTH_METRICS" value={`SEED: ${selected?.seeders ?? 0} / LEECH: ${selected?.leechers ?? 0}`} mono />
            </div>

            <div className="space-y-4">
              <div className="text-[10px] font-mono uppercase tracking-widest opacity-40">MAGNET_URI_ENCODING</div>
              <textarea
                className="textarea textarea-bordered w-full h-32 bg-base-300 font-mono text-[11px] border-base-content/5 focus:border-primary/30"
                readOnly
                value={selected?.magnet || 'NO_MAGNET_DATA_AVAILABLE'}
              />
            </div>

            <div className="mt-10 flex flex-wrap gap-4 justify-end">
              <button className="btn btn-ghost px-8 rounded-sm font-mono text-[11px] uppercase tracking-widest border border-base-content/5" onClick={() => void copyMagnet(selected?.magnet)}>
                Copy_Magnet
              </button>
              <button 
                className="btn btn-secondary px-8 rounded-sm font-mono text-[11px] uppercase tracking-widest"
                onClick={() => void addToTorbox(selected?.magnet)}
                disabled={!selected?.magnet || (strictCached && selected?.cached === false)}
              >
                Add_To_Torbox
              </button>
              <button 
                className="btn btn-primary px-8 rounded-sm font-mono text-[11px] uppercase tracking-widest"
                onClick={() => void downloadFromTorbox(selected?.magnet, selected?.infoHash)}
                disabled={!selected?.magnet || (strictCached && selected?.cached === false)}
              >
                Execute_Download
              </button>
            </div>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop bg-black/40">
          <button>close</button>
        </form>
      </dialog>
    </div>
  )
}

function ConfigCard({ title, desc, checked, onChange }: { title: string, desc: string, checked: boolean, onChange: (v: boolean) => void }) {
  return (
    <label className="p-5 bg-base-300/30 border border-base-content/5 rounded-sm flex items-start justify-between gap-6 cursor-pointer hover:bg-base-300/50 transition-colors">
      <div className="min-w-0">
        <div className="text-[10px] font-mono uppercase tracking-[0.2em] opacity-40 mb-1">{title}</div>
        <div className="text-[11px] opacity-70 leading-relaxed font-body">{desc}</div>
      </div>
      <input 
        type="checkbox" 
        className="toggle toggle-primary toggle-sm mt-1" 
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  )
}

function DetailBox({ label, value, mono }: { label: string, value: string, mono?: boolean }) {
  return (
    <div className="p-4 bg-base-300 border border-base-content/5 rounded-sm">
      <div className="text-[10px] font-mono uppercase tracking-widest opacity-40 mb-2">{label}</div>
      <div className={`${mono ? 'font-mono' : 'font-body'} text-sm break-all text-base-content/80`}>{value}</div>
    </div>
  )
}
