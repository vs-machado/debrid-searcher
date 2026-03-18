import { useEffect, useMemo, useRef, useState } from 'react'
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
  const [isPerformingModalAction, setIsPerformingModalAction] = useState(false)

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [orderBy, setOrderBy] = useState<'relevance' | 'size' | 'seeds'>('relevance')
  const resultsContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    resultsContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [page])

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
    const base = data.results.filter((r) => r.cached !== undefined)
    if (view === 'all') return base
    return base.filter((r) => r.cached)
  }, [data, view])

  const orderedResults = useMemo(() => {
    if (orderBy === 'relevance') return results

    const decorated = results.map((r, idx) => ({ r, idx }))
    decorated.sort((a, b) => {
      if (orderBy === 'size') {
        const av = Number.isFinite(a.r.size) ? (a.r.size as number) : -1
        const bv = Number.isFinite(b.r.size) ? (b.r.size as number) : -1
        const cmp = bv - av
        return cmp !== 0 ? cmp : a.idx - b.idx
      }

      const av = Number.isFinite(a.r.seeders) ? (a.r.seeders as number) : -1
      const bv = Number.isFinite(b.r.seeders) ? (b.r.seeders as number) : -1
      const cmp = bv - av
      return cmp !== 0 ? cmp : a.idx - b.idx
    })

    return decorated.map((d) => d.r)
  }, [results, orderBy])

  const totalPages = Math.ceil(orderedResults.length / pageSize)
  const paginatedResults = useMemo(() => {
    return orderedResults.slice((page - 1) * pageSize, page * pageSize)
  }, [orderedResults, page, pageSize])

  useEffect(() => {
    setPage(1)
  }, [orderedResults.length, pageSize, orderBy])

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
    setIsPerformingModalAction(true)
    try {
      const res = await torboxAdd(magnet)
      push('success', res.detail || 'Added to TorBox')
    } catch (e) {
      push('error', 'TorBox add failed', e instanceof Error ? e.message : String(e))
    } finally {
      setIsPerformingModalAction(false)
    }
  }

  async function downloadFromTorbox(magnet?: string, infoHash?: string) {
    if (!magnet) return
    setIsPerformingModalAction(true)
    try {
      const res = await torboxDownload({ magnet, infoHash })
      if (!res.url) {
        push('error', 'No URL returned')
        return
      }
      push('success', 'Download link ready', `Torrent ${res.torrentId ?? ''}`.trim())
    } catch (e) {
      push('error', 'TorBox download failed', e instanceof Error ? e.message : String(e))
    } finally {
      setIsPerformingModalAction(false)
    }
  }

  function openDetails(r: SearchResult) {
    setSelected(r)
    dialogRef.current?.showModal()
  }

  return (
    <div className="h-dvh flex flex-col overflow-hidden relative text-base-content/90 font-body">
      <div className="atmo" aria-hidden="true" />
      <ToastHost toasts={toasts} onClose={dismiss} />

      {/* Navigation Header */}
      <nav className="shrink-0 max-w-6xl w-full mx-auto px-6 py-6 flex flex-col md:flex-row gap-4 md:items-end justify-between border-b border-base-content/5">
        <div className="flex gap-4 items-center">
          <div className="brand-mark shrink-0 w-8 h-8" aria-hidden="true" />
          <div className="min-w-0">
            <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tighter leading-none uppercase">
              DEBRID <span className="text-primary/80">SEARCHER</span>
            </h1>
          </div>
        </div>

        <div className="flex flex-col md:items-end gap-2 text-right">
          <div className="flex items-center gap-4 text-[10px] font-mono uppercase tracking-widest opacity-60">
            <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse shrink-0" />
            System_Operational
          </div>
          <div className="flex items-center gap-3 font-mono text-[9px] uppercase tracking-[0.2em]">
            <span className="text-primary font-bold">{session?.username || 'ANON'}</span>
            <button 
              onClick={async () => {
                await logout()
                navigate('/login')
              }}
              className="px-1.5 py-0.5 border border-primary/30 hover:bg-primary/20 transition-all text-primary/80"
            >
              [DISCONNECT]
            </button>
          </div>
        </div>
      </nav>

      <main className="flex-1 min-h-0 max-w-6xl w-full mx-auto px-6 py-6 flex flex-col gap-6 overflow-hidden">
        {/* Control Center */}
        <section className="machined-card p-0.5 rounded-sm shrink-0">
          <div className="bg-base-200/40 p-5 md:p-6 flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
              <div className="md:col-span-8 flex flex-col gap-2">
                <span className="text-[9px] font-mono uppercase tracking-[0.2em] opacity-50">Main_Search_Input</span>
                <input
                  className="input w-full bg-base-300/40 border border-primary/40 font-mono text-base focus:border-primary focus:ring-2 focus:ring-primary/10 focus:outline-none placeholder:opacity-20 h-12 rounded-sm transition-all"
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

              <div className="md:col-span-4 flex gap-3">
                <label className="btn btn-outline border-base-content/10 flex-1 hover:bg-base-100 hover:text-primary rounded-sm h-12 min-h-0">
                  <input
                    type="checkbox"
                    className="toggle toggle-primary toggle-xs mr-2"
                    checked={view === 'cached'}
                    onChange={(e) => setView(e.target.checked ? 'cached' : 'all')}
                  />
                  <span className="text-[10px] font-mono uppercase tracking-widest">Cached</span>
                </label>

                <button 
                  className="btn btn-primary h-12 min-h-0 px-8 rounded-sm font-mono uppercase tracking-widest group" 
                  onClick={() => void doSearch()} 
                  disabled={loading}
                >
                  {loading ? (
                    <span className="loading loading-spinner loading-xs" />
                  ) : (
                    <span className="flex items-center gap-2 text-xs">
                      Run
                      <span className="animate-blink">_</span>
                    </span>                    
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 py-1.5 border-t border-base-content/5">
              <div className="text-[10px] font-mono opacity-50 flex items-center gap-4">
                {data ? (
                  <>
                    <div>CACHE: <span className="text-success">{cachedCount}</span></div>
                    <div>TOTAL: {data.results.length}</div>
                  </>
                ) : (
                  <div>READY: WAITING_FOR_COMMAND</div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <span className="text-[9px] font-mono uppercase tracking-widest opacity-40">ORDER_BY</span>
                <div className="join">
                  <button
                    className={`btn btn-xs join-item border-base-content/10 font-mono uppercase tracking-widest text-[8px] h-7 min-h-0 px-2 ${orderBy === 'relevance' ? 'btn-neutral' : 'btn-ghost'}`}
                    onClick={() => setOrderBy('relevance')}
                    type="button"
                    title="ORDER_BY_RELEVANCE"
                  >
                    Rel
                  </button>
                  <button
                    className={`btn btn-xs join-item border-base-content/10 font-mono uppercase tracking-widest text-[8px] h-7 min-h-0 px-2 ${orderBy === 'size' ? 'btn-neutral' : 'btn-ghost'}`}
                    onClick={() => setOrderBy('size')}
                    type="button"
                    title="ORDER_BY_SIZE"
                  >
                    Size
                  </button>
                  <button
                    className={`btn btn-xs join-item border-base-content/10 font-mono uppercase tracking-widest text-[8px] h-7 min-h-0 px-2 ${orderBy === 'seeds' ? 'btn-neutral' : 'btn-ghost'}`}
                    onClick={() => setOrderBy('seeds')}
                    type="button"
                    title="ORDER_BY_SEEDS"
                  >
                    Seeds
                  </button>
                </div>

                <button 
                  className={`text-[9px] font-mono uppercase tracking-widest transition-opacity ${showAdvanced ? 'opacity-100 text-primary' : 'opacity-30 hover:opacity-100'}`}
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  type="button"
                >
                  {showAdvanced ? '[-] CONFIG' : '[+] CONFIG'}
                </button>
              </div>
            </div>

            {showAdvanced && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-base-content/5 animate-rise">
                <ConfigCard 
                  title="STRICT_CACHE"
                  desc="Uncached lock."
                  checked={strictCached}
                  onChange={(v) => setStrictCached(v)}
                />
                <ConfigCard 
                  title="ZIP_PACKAGE"
                  desc="ZIP archive."
                  checked={zipLink}
                  onChange={(v) => setZipLink(v)}
                />
                <div className="p-3 bg-base-300/30 border border-base-content/5 rounded-sm">
                  <div className="text-[9px] font-mono uppercase tracking-[0.2em] opacity-40 mb-2">VIEW_MODE</div>
                  <div className="join flex">
                    <button 
                      className={`btn btn-xs join-item flex-1 font-mono uppercase text-[9px] ${view === 'cached' ? 'btn-neutral' : 'btn-ghost'}`}
                      onClick={() => setView('cached')}
                      type="button"
                    >
                      Cached
                    </button>
                    <button 
                      className={`btn btn-xs join-item flex-1 font-mono uppercase text-[9px] ${view === 'all' ? 'btn-neutral' : 'btn-ghost'}`}
                      onClick={() => setView('all')}
                      type="button"
                    >
                      All
                    </button>
                  </div>
                </div>
                <div className="p-3 bg-base-300/30 border border-base-content/5 rounded-sm">
                  <div className="text-[9px] font-mono uppercase tracking-[0.2em] opacity-40 mb-2">LIMIT</div>
                  <div className="join flex">
                    {[10, 20, 50, 100].map(sz => (
                      <button 
                        key={sz}
                        className={`btn btn-xs join-item flex-1 font-mono uppercase text-[8px] ${pageSize === sz ? 'btn-neutral' : 'btn-ghost'}`}
                        onClick={() => setPageSize(sz)}
                      >
                        {sz}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Results Stream */}
        <section className="flex-1 min-h-0 flex flex-col gap-4">
          {!data && !loading && (
            <div className="empty-state border-dashed opacity-50 flex-1 flex flex-col justify-center">
              <h2 className="font-display text-xl font-bold uppercase tracking-tight">ENGINE_IDLE</h2>
              <p className="mt-1 text-xs opacity-60">System ready.</p>
            </div>
          )}

          {loading && (
            <div className="flex-1 grid grid-cols-1 gap-3 overflow-hidden">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="machined-card h-16 shimmer opacity-10 rounded-sm" />
              ))}
            </div>
          )}

          {data && !loading && (
            results.length ? (
              <div className="flex-1 min-h-0 flex flex-col gap-4">
                <div ref={resultsContainerRef} className="flex-1 min-h-0 overflow-y-auto pr-2 custom-scrollbar">
                  <div className="grid grid-cols-1 gap-2">
                    {paginatedResults.map((r, idx) => (
                      <ResultCard
                        key={`${r.infoHash || r.magnet || r.title}-${idx}`}
                        r={r}
                        strictCached={strictCached}
                        onInspect={() => openDetails(r)}
                        onAdd={() => void addToTorbox(r.magnet)}
                        onDownload={() => void downloadFromTorbox(r.magnet, r.infoHash)}
                      />
                    ))}
                  </div>
                </div>
                
                {totalPages > 1 && (
                  <div className="shrink-0 py-2 flex items-center justify-center gap-4">
                    <div className="join">
                      <button 
                        className="btn btn-xs join-item border-base-content/10 font-mono text-[9px] uppercase tracking-widest disabled:opacity-20 h-8"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                      >
                        Prev
                      </button>
                      <div className="btn btn-xs join-item border-base-content/10 font-mono text-[9px] uppercase tracking-widest no-animation cursor-default h-8">
                        P{page}/{totalPages}
                      </div>
                      <button 
                        className="btn btn-xs join-item border-base-content/10 font-mono text-[9px] uppercase tracking-widest disabled:opacity-20 h-8"
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="empty-state flex-1 flex flex-col justify-center">
                <h2 className="font-display text-xl font-bold uppercase tracking-tight text-error/80">NO_MATCH</h2>
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
              <h3 className="font-display text-2xl font-black uppercase tracking-tighter leading-tight wrap-break-word">
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
              <button className="btn btn-ghost px-8 rounded-sm font-mono text-[11px] uppercase tracking-widest border border-base-content/5 hover:border-base-content/20 transition-all h-12" onClick={() => void copyMagnet(selected?.magnet)}>
                Copy_Magnet
              </button>
              <button 
                className="btn btn-ghost border border-secondary/20 hover:border-secondary/60 hover:bg-secondary/5 text-secondary px-8 rounded-sm font-mono text-[11px] uppercase tracking-widest transition-all h-12 flex items-center gap-3 group/btn"
                onClick={() => void addToTorbox(selected?.magnet)}
                disabled={!selected?.magnet || isPerformingModalAction}
              >
                {isPerformingModalAction ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-40 group-hover/btn:opacity-100 transition-opacity"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                )}
                Add_To_Torbox
              </button>
              <button 
                className="btn btn-ghost border border-primary/20 hover:border-primary/60 hover:bg-primary/5 text-primary px-8 rounded-sm font-mono text-[11px] uppercase tracking-widest transition-all h-12 flex items-center gap-3 group/btn"
                onClick={() => void downloadFromTorbox(selected?.magnet, selected?.infoHash)}
                disabled={!selected?.magnet || (strictCached && selected?.cached === false) || isPerformingModalAction}
              >
                {isPerformingModalAction ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-40 group-hover/btn:opacity-100 transition-opacity"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                )}
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
    <label className="p-3 bg-base-300/30 border border-base-content/5 rounded-sm flex items-start justify-between gap-4 cursor-pointer hover:bg-base-300/50 transition-colors">
      <div className="min-w-0">
        <div className="text-[9px] font-mono uppercase tracking-[0.2em] opacity-40 mb-0.5">{title}</div>
        <div className="text-[10px] opacity-70 leading-tight font-body">{desc}</div>
      </div>
      <input 
        type="checkbox" 
        className="toggle toggle-primary toggle-xs mt-0.5" 
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
