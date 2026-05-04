import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import type { SearchResult, TorboxTrackedTorrent } from './types'
import ToastHost from './components/ToastHost'
import ResultCard from './components/ResultCard'
import { fmtBytes } from './lib/format'
import { useToasts } from './hooks/useToasts'
import { useClipboard } from './hooks/useClipboard'
import { useSearch } from './hooks/useSearch'
import { useTorbox } from './hooks/useTorbox'
import { useAuthSession } from '../login/hooks/useAuth'

type ViewMode = 'cached' | 'all'
const TORRENT_HISTORY_KEY = 'debrid_downloader.torbox.tracked'

export default function SearchPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { logout, session, loading: authLoading } = useAuthSession()
  const [view, setView] = useState<ViewMode>('cached')
  const currentPage = location.pathname === '/history' ? 'history' : 'search'

  if (!authLoading && !session) {
    return <Navigate to="/login" />
  }

  const [strictCached, setStrictCached] = useState(true)
  const [zipLink, setZipLink] = useState(true)

  const { q, setQ, loading, data, setData, cachedCount, run: runSearch } = useSearch()
  const [selected, setSelected] = useState<SearchResult | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [isModalAdding, setIsModalAdding] = useState(false)
  const [isModalDownloading, setIsModalDownloading] = useState(false)
  const [trackedTorrents, setTrackedTorrents] = useState<Record<string, TorboxTrackedTorrent>>(() => {
    try {
      const raw = window.localStorage.getItem(TORRENT_HISTORY_KEY)
      if (!raw) return {}
      const parsed = JSON.parse(raw) as Record<string, TorboxTrackedTorrent>
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
      window.localStorage.removeItem(TORRENT_HISTORY_KEY)
      return {}
    }
  })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [orderBy, setOrderBy] = useState<'relevance' | 'size' | 'seeds'>('relevance')
  const resultsContainerRef = useRef<HTMLDivElement>(null)
  const pollTimersRef = useRef<Record<string, number>>({})

  useEffect(() => {
    resultsContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [page])

  const { toasts, push, dismiss } = useToasts()
  const { copyText } = useClipboard()
  const dialogRef = useRef<HTMLDialogElement | null>(null)

  const { add: torboxAdd, download: torboxDownload, status: torboxStatus } = useTorbox({
    strictCached,
    zipLink,
    onLinkReady: (url) => window.open(url, '_blank', 'noopener,noreferrer'),
  })

  useEffect(() => {
    window.localStorage.setItem(TORRENT_HISTORY_KEY, JSON.stringify(trackedTorrents))
  }, [trackedTorrents])

  useEffect(() => {
    return () => {
      for (const id of Object.values(pollTimersRef.current)) window.clearTimeout(id)
      pollTimersRef.current = {}
    }
  }, [])

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

  const trackedList = useMemo(() => {
    return Object.values(trackedTorrents).sort((a, b) => b.updatedAt - a.updatedAt)
  }, [trackedTorrents])

  const activeTrackCount = trackedList.filter((t) => t.phase === 'added' || t.phase === 'checking').length
  const readyTrackCount = trackedList.filter((t) => t.phase === 'ready').length

  function formatProgress(progress?: number) {
    if (progress === undefined) return undefined
    if (!Number.isFinite(progress)) return undefined
    return `${Math.round(Math.max(0, Math.min(100, progress)))}%`
  }

  function formatTrackedTime(ts: number) {
    if (!Number.isFinite(ts)) return 'N/A'
    return new Date(ts).toLocaleString(undefined, {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

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

  function resultKey(input: Pick<SearchResult, 'infoHash' | 'magnet'>) {
    return (input.infoHash?.trim().toLowerCase() || input.magnet || '').trim()
  }

  function setResultCached(target: { infoHash?: string; magnet?: string }) {
    const key = resultKey(target)
    if (!key) return

    setData((prev) => {
      if (!prev) return prev
      const results = prev.results.map((r) => (resultKey(r) === key ? { ...r, cached: true } : r))
      return { ...prev, results, cachedResults: results.filter((r) => r.cached) }
    })
    setSelected((prev) => (prev && resultKey(prev) === key ? { ...prev, cached: true } : prev))
  }

  function updateTracked(key: string, patch: Partial<TorboxTrackedTorrent>) {
    setTrackedTorrents((prev) => {
      const existing = prev[key]
      if (!existing) return prev
      return {
        ...prev,
        [key]: {
          ...existing,
          ...patch,
          key,
          updatedAt: Date.now(),
        },
      }
    })
  }

  function removeTracked(key: string) {
    if (pollTimersRef.current[key]) {
      window.clearTimeout(pollTimersRef.current[key])
      delete pollTimersRef.current[key]
    }
    setTrackedTorrents((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  function scheduleReadyPoll(target: { key: string; torrentId?: number; infoHash?: string; magnet?: string }, attempt = 1) {
    if (!target.key || (!target.torrentId && !target.infoHash)) return

    const delayMs = attempt === 1 ? 800 : attempt <= 8 ? 2500 : attempt <= 24 ? 5000 : 10000
    if (pollTimersRef.current[target.key]) window.clearTimeout(pollTimersRef.current[target.key])

    pollTimersRef.current[target.key] = window.setTimeout(async () => {
      try {
        const res = await torboxStatus({ torrentId: target.torrentId, infoHash: target.infoHash })
        const nextTorrentId = res.torrentId ?? target.torrentId
        const message = res.label || res.status || (res.found ? 'Waiting for TorBox' : 'Waiting for torrent record')

        if (res.ready) {
          delete pollTimersRef.current[target.key]
          updateTracked(target.key, { phase: 'ready', torrentId: nextTorrentId, infoHash: target.infoHash || res.infoHash, status: res.status, label: res.label, progress: res.progress ?? 100, message: 'Ready in TorBox' })
          setResultCached({ infoHash: target.infoHash || res.infoHash, magnet: target.magnet })
          push('success', 'Torrent ready in TorBox', message)
          return
        }

        updateTracked(target.key, { phase: 'checking', torrentId: nextTorrentId, status: res.status, label: res.label, progress: res.progress, message })

        if (attempt >= 60) {
          delete pollTimersRef.current[target.key]
          updateTracked(target.key, { phase: 'failed', torrentId: nextTorrentId, status: res.status, label: res.label, progress: res.progress, message: 'Timed out waiting for TorBox readiness' })
          push('warning', 'TorBox still processing', 'The torrent was added, but is not ready yet.')
          return
        }

        scheduleReadyPoll({ ...target, torrentId: nextTorrentId }, attempt + 1)
      } catch (e) {
        delete pollTimersRef.current[target.key]
        const message = e instanceof Error ? e.message : String(e)
        updateTracked(target.key, { phase: 'failed', torrentId: target.torrentId, message })
        push('warning', 'TorBox status check failed', message)
      }
    }, delayMs)
  }

  useEffect(() => {
    for (const tracked of Object.values(trackedTorrents)) {
      if ((tracked.phase === 'added' || tracked.phase === 'checking') && !pollTimersRef.current[tracked.key]) {
        scheduleReadyPoll({ key: tracked.key, torrentId: tracked.torrentId, infoHash: tracked.infoHash, magnet: tracked.magnet })
      }
      if (tracked.phase === 'ready') {
        setResultCached({ infoHash: tracked.infoHash, magnet: tracked.magnet })
      }
    }
  }, [trackedTorrents])

  async function addToTorbox(result?: SearchResult | null) {
    if (!result?.magnet) return
    const key = resultKey(result)
    setIsModalAdding(true)
    try {
      const res = await torboxAdd(result.magnet)
      setTrackedTorrents((prev) => ({
        ...prev,
        [key]: {
          key,
          title: result.title,
          magnet: result.magnet,
          infoHash: result.infoHash,
          phase: 'added',
          torrentId: res.torrentId,
          progress: 0,
          message: 'Adding in TorBox',
          addedAt: prev[key]?.addedAt ?? Date.now(),
          updatedAt: Date.now(),
        },
      }))
      push('success', 'Torrent added to TorBox', 'Checking readiness now.')
      if (res.torrentId || result.infoHash) {
        scheduleReadyPoll({ key, torrentId: res.torrentId, infoHash: result.infoHash, magnet: result.magnet })
      } else {
        updateTracked(key, { phase: 'failed', message: 'TorBox did not return an id and this result has no info hash' })
        push('warning', 'TorBox polling unavailable', 'The torrent was added, but no status identifier was returned.')
      }
      dialogRef.current?.close()
    } catch (e) {
      push('error', 'TorBox add failed', e instanceof Error ? e.message : String(e))
    } finally {
      setIsModalAdding(false)
    }
  }

  async function downloadFromTorbox(magnet?: string, infoHash?: string) {
    if (!magnet) return
    setIsModalDownloading(true)
    try {
      const res = await torboxDownload({ magnet, infoHash })
      if (!res.url) {
        push('error', 'No URL returned')
        return
      }
      push('success', 'Download link ready', `Torrent ${res.torrentId ?? ''}`.trim())
      dialogRef.current?.close()
    } catch (e) {
      push('error', 'TorBox download failed', e instanceof Error ? e.message : String(e))
    } finally {
      setIsModalDownloading(false)
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
      <nav className="shrink-0 max-w-6xl w-full mx-auto px-4 md:px-6 py-3 md:py-6 flex flex-row gap-3 items-center justify-between border-b border-base-content/5">
        <div className="flex gap-3 items-center">
          <img
            src="/website_logo.png"
            className="brand-logo shrink-0 w-8 h-8 md:w-11 md:h-11 translate-y-[1px]"
            alt=""
            decoding="async"
            loading="eager"
          />
          <div className="min-w-0">
            <h1 className="font-display text-lg sm:text-2xl md:text-3xl font-extrabold tracking-tight leading-none uppercase">
              DEBRID <span className="text-primary/80">SEARCHER</span>
            </h1>
          </div>
        </div>

        <div className="md:hidden flex items-center gap-2">
          <button
            className={`relative w-9 h-9 grid place-items-center border transition-all ${activeTrackCount ? 'border-warning/50 text-warning bg-warning/10 animate-tracker-pulse' : readyTrackCount ? 'border-success/40 text-success bg-success/10' : 'border-base-content/10 text-base-content/60 hover:text-primary hover:border-primary/40'}`}
            onClick={() => navigate(currentPage === 'history' ? '/' : '/history')}
            type="button"
            title="TORRENT_HISTORY"
          >
            <ListIcon className="w-4 h-4" />
            {trackedList.length > 0 && (
              <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 grid place-items-center rounded-sm bg-primary text-primary-content text-[8px] leading-none">
                {trackedList.length}
              </span>
            )}
          </button>
          <button
            onClick={async () => {
              await logout()
              navigate('/login')
            }}
            className="h-9 px-2 border border-primary/30 text-primary/80 font-mono text-[8px] uppercase tracking-widest"
            type="button"
          >
            Logout
          </button>
        </div>

        <div className="hidden md:flex flex-col md:items-end gap-2 text-right">
          <div className="flex items-center gap-3 font-mono text-[9px] uppercase tracking-[0.2em] leading-none">
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

      <main className="flex-1 min-h-0 max-w-6xl w-full mx-auto px-4 md:px-6 py-4 md:py-6 flex flex-col gap-4 md:gap-6 overflow-hidden">
        {currentPage === 'history' && (
          <section className="machined-card p-0.5 rounded-sm flex-1 min-h-0 animate-rise">
            <div className="bg-base-200/50 p-4 md:p-5 h-full min-h-0 flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-base-content/5 pb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${activeTrackCount ? 'bg-warning animate-pulse' : 'bg-success'}`} />
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.2em] opacity-70">Torrent_History</div>
                    <div className="mt-1 font-mono text-[9px] uppercase tracking-widest opacity-40">
                      ACTIVE: {activeTrackCount} / READY: {readyTrackCount} / SAVED: {trackedList.length}
                    </div>
                  </div>
                </div>
                <button
                  className="btn btn-sm btn-ghost border border-base-content/10 rounded-sm font-mono uppercase tracking-widest text-[10px]"
                  onClick={() => navigate('/')}
                  type="button"
                >
                  Back_To_Search
                </button>
              </div>

              {trackedList.length ? (
                <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-1">
                  <div className="grid grid-cols-1 gap-2">
                    {trackedList.map((t) => (
                      <div key={t.key} className={`tracker-row ${t.phase === 'ready' ? 'tracker-row-ready' : t.phase === 'failed' ? 'tracker-row-failed' : 'tracker-row-active'}`}>
                        <div className="min-w-0">
                          <div className="font-display text-sm font-bold uppercase tracking-tight leading-tight line-clamp-1">{t.title}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <span className={`badge badge-sm h-5 px-2 font-mono text-[8px] uppercase ${t.phase === 'ready' ? 'bg-success/10 text-success border-success/30' : t.phase === 'failed' ? 'bg-error/10 text-error border-error/30' : 'bg-warning/10 text-warning border-warning/30'}`}>
                              {t.phase}
                            </span>
                            <span className="font-mono text-[9px] uppercase tracking-widest opacity-50">
                              {t.message || t.label || t.status || t.phase}
                            </span>
                          </div>
                          <div className="mt-1 font-mono text-[8px] uppercase tracking-widest opacity-35">
                            ADDED {formatTrackedTime(t.addedAt)} / UPDATED {formatTrackedTime(t.updatedAt)}
                          </div>
                          {t.progress !== undefined && (
                            <div className="mt-2 flex items-center gap-2">
                              <div className="torrent-progress-track">
                                <div className={`torrent-progress-fill ${t.phase === 'ready' ? 'torrent-progress-ready' : ''}`} style={{ width: `${Math.max(0, Math.min(100, t.progress))}%` }} />
                              </div>
                              <span className="font-mono text-[9px] text-base-content/50 w-9 text-right">{formatProgress(t.progress)}</span>
                            </div>
                          )}
                        </div>
                        <div className="shrink-0 flex items-center gap-2">
                          {t.phase === 'ready' && (
                            <button
                              className="btn btn-sm h-9 min-h-0 px-3 font-mono text-[9px] border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 flex items-center gap-2"
                              onClick={() => void downloadFromTorbox(t.magnet, t.infoHash)}
                              disabled={!t.magnet || isModalDownloading}
                              type="button"
                              title="DOWNLOAD_FROM_HISTORY"
                            >
                              <DownloadIcon className="w-3.5 h-3.5" />
                              DOWNLOAD
                            </button>
                          )}
                          <button className="btn btn-xs btn-ghost h-7 min-h-0 px-2 font-mono text-[9px]" onClick={() => removeTracked(t.key)} type="button">
                            X
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="empty-state flex-1 flex flex-col justify-center">
                  <h2 className="font-display text-xl font-bold uppercase tracking-tight">HISTORY_EMPTY</h2>
                  <p className="mt-1 text-xs opacity-60">Added torrents will appear here.</p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Control Center */}
        {currentPage === 'search' && <section className="machined-card p-0.5 rounded-sm shrink-0">
          <div className="bg-base-200/40 p-3 md:p-6 flex flex-col gap-3 md:gap-4">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-12 gap-2 md:gap-4 items-end">
              <div className="min-w-0 md:col-span-8 flex flex-col gap-2">
                <span className="hidden md:inline text-[9px] font-mono uppercase tracking-[0.2em] opacity-50">Main_Search_Input</span>
                <input
                  className="input w-full bg-base-300/40 border border-primary/40 font-mono text-sm md:text-base focus:border-primary focus:ring-2 focus:ring-primary/10 focus:outline-none placeholder:opacity-20 h-10 md:h-12 rounded-sm transition-all"
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

              <div className="md:col-span-4 flex gap-2 md:gap-3">
                <label className="hidden md:flex btn btn-outline border-base-content/10 flex-1 hover:bg-base-100 hover:text-primary rounded-sm h-10 md:h-12 min-h-0">
                  <input
                    type="checkbox"
                    className="toggle toggle-primary toggle-xs mr-2"
                    checked={view === 'cached'}
                    onChange={(e) => setView(e.target.checked ? 'cached' : 'all')}
                  />
                  <span className="text-[10px] font-mono uppercase tracking-widest">Cached</span>
                </label>

                <button 
                  className="btn btn-primary h-10 md:h-12 min-h-0 px-4 md:px-8 rounded-sm font-mono uppercase tracking-widest group" 
                  onClick={() => void doSearch()} 
                  disabled={loading}
                >
                  {loading ? (
                    <span className="loading loading-spinner loading-xs" />
                  ) : (
                    <span className="flex items-center gap-2 text-[11px] md:text-xs">
                      Run
                      <span className="animate-blink">_</span>
                    </span>                    
                  )}
                </button>
              </div>
            </div>

            <div className="md:hidden grid grid-cols-[minmax(0,1fr)_auto] gap-2 items-center">
              <label className="btn btn-outline border-base-content/10 hover:bg-base-100 hover:text-primary rounded-sm h-9 min-h-0 justify-start">
                <input
                  type="checkbox"
                  className="toggle toggle-primary toggle-xs mr-2"
                  checked={view === 'cached'}
                  onChange={(e) => setView(e.target.checked ? 'cached' : 'all')}
                />
                <span className="text-[9px] font-mono uppercase tracking-widest">Cached</span>
              </label>
              <details className="dropdown dropdown-end">
                <summary className="list-none flex items-center gap-2 h-9 px-2 border border-base-content/10 bg-base-300/30 rounded-sm cursor-pointer">
                  <span className="font-mono text-[7px] uppercase tracking-widest opacity-45">Filter</span>
                  <span className="font-mono text-[8px] uppercase tracking-widest min-w-8">
                    {orderBy === 'relevance' ? 'Rel' : orderBy === 'size' ? 'Size' : 'Seeds'}
                  </span>
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </summary>
                <ul className="dropdown-content z-30 mt-1 menu p-1 bg-base-200 border border-primary/30 shadow-2xl w-32 rounded-sm">
                  {[
                    ['relevance', 'Relevance'],
                    ['size', 'Size'],
                    ['seeds', 'Seeds'],
                  ].map(([value, label]) => (
                    <li key={value}>
                      <button
                        className={`rounded-sm font-mono text-[10px] uppercase tracking-widest ${orderBy === value ? 'active' : ''}`}
                        onClick={(e) => {
                          setOrderBy(value as typeof orderBy)
                          e.currentTarget.closest('details')?.removeAttribute('open')
                        }}
                        type="button"
                      >
                        {label}
                      </button>
                    </li>
                  ))}
                </ul>
              </details>
            </div>

            <div className="hidden md:flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 md:gap-3 py-1.5 border-t border-base-content/5">
              <div className="text-[10px] font-mono opacity-50 flex flex-wrap items-center gap-2 md:gap-4">
                {data ? (
                  <>
                    <div>CACHE: <span className="text-success">{cachedCount}</span></div>
                    <div>TOTAL: {data.results.length}</div>
                  </>
                ) : (
                  <div>READY: WAITING_FOR_COMMAND</div>
                )}
                <button
                  className={`relative h-8 px-2 grid place-items-center border transition-all ${activeTrackCount ? 'border-warning/50 text-warning bg-warning/10 animate-tracker-pulse' : readyTrackCount ? 'border-success/40 text-success bg-success/10' : 'border-base-content/10 text-base-content/50 hover:text-primary hover:border-primary/40'}`}
                  onClick={() => navigate('/history')}
                  type="button"
                  title="TORRENT_HISTORY"
                >
                  <span className="flex items-center gap-2">
                    <ListIcon className="w-[15px] h-[15px]" />
                    <span className="hidden sm:inline text-[9px] uppercase tracking-widest">HISTORY</span>
                  </span>
                  {trackedList.length > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 grid place-items-center rounded-sm bg-primary text-primary-content text-[8px] leading-none">
                      {trackedList.length}
                    </span>
                  )}
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 md:gap-3 min-w-0">
                <span className="hidden sm:inline text-[9px] font-mono uppercase tracking-widest opacity-40">ORDER_BY</span>
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
                  className={`hidden md:inline shrink-0 text-[9px] font-mono uppercase tracking-widest transition-opacity ${showAdvanced ? 'opacity-100 text-primary' : 'opacity-30 hover:opacity-100'}`}
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  type="button"
                >
                  {showAdvanced ? '[-] CONFIG' : '[+] CONFIG'}
                </button>
              </div>
            </div>

            {showAdvanced && (
              <div className="hidden md:grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-base-content/5 animate-rise">
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
        </section>}

        {/* Results Stream */}
        {currentPage === 'search' && <section className="flex-1 min-h-0 flex flex-col gap-4">
          {!data && !loading && (
            <div className="empty-state border-dashed opacity-50 flex-1 flex flex-col justify-center">
              <h2 className="font-display text-xl font-bold uppercase tracking-tight">ENGINE_IDLE</h2>
              <p className="mt-1 text-xs opacity-60">System ready.</p>
            </div>
          )}

          {loading && (
            <div className="flex-1 grid grid-cols-1 gap-2 overflow-hidden px-0.5">
              {[...Array(pageSize)].map((_, i) => (
                <div key={i} className="machined-card rounded-sm opacity-20 p-0.5 pointer-events-none">
                  <div className="bg-base-200/50 p-4 flex flex-col md:flex-row gap-5 items-start md:items-center">
                    <div className="shrink-0 w-2.5 h-2.5 rounded-full bg-base-content/40 shimmer" />
                    <div className="flex-1 w-full">
                      <div className="h-6 bg-base-content/20 rounded-sm w-2/3 shimmer" />
                      <div className="mt-2 flex gap-x-8">
                        <div className="h-4 bg-base-content/20 rounded-sm w-20 shimmer" />
                        <div className="h-4 bg-base-content/20 rounded-sm w-28 shimmer" />
                        <div className="h-4 bg-base-content/20 rounded-sm w-24 shimmer" />
                      </div>
                    </div>
                    <div className="shrink-0 flex flex-row gap-3 w-full md:w-auto">
                      <div className="h-9 flex-1 md:w-20 bg-base-content/10 rounded-sm shimmer" />
                      <div className="h-9 flex-1 md:w-20 bg-base-content/10 rounded-sm shimmer" />
                    </div>
                  </div>
                </div>
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
                        torboxState={trackedTorrents[resultKey(r)]}
                        onInspect={() => openDetails(r)}
                        onAdd={() => addToTorbox(r)}
                        onDownload={() => downloadFromTorbox(r.magnet, r.infoHash)}
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
        </section>}
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
                onClick={() => void addToTorbox(selected)}
                disabled={!selected?.magnet || isModalAdding || isModalDownloading}
              >
                {isModalAdding ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-40 group-hover/btn:opacity-100 transition-opacity"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                )}
                Add_To_Torbox
              </button>
              <button 
                className="btn btn-ghost border border-primary/20 hover:border-primary/60 hover:bg-primary/5 text-primary px-8 rounded-sm font-mono text-[11px] uppercase tracking-widest transition-all h-12 flex items-center gap-3 group/btn"
                onClick={() => void downloadFromTorbox(selected?.magnet, selected?.infoHash)}
                disabled={!selected?.magnet || (strictCached && selected?.cached === false) || isModalAdding || isModalDownloading}
              >
                {isModalDownloading ? (
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

function ListIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 6h13" />
      <path d="M8 12h13" />
      <path d="M8 18h13" />
      <path d="M3 6h.01" />
      <path d="M3 12h.01" />
      <path d="M3 18h.01" />
    </svg>
  )
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M7 10l5 5 5-5" />
      <path d="M12 15V3" />
    </svg>
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
