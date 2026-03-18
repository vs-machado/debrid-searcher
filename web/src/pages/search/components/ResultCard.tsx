import type { SearchResult } from '../types'
import { fmtBytes, shortHash } from '../lib/format'

export default function ResultCard({
  r,
  strictCached,
  onCopyMagnet,
  onAdd,
  onDownload,
  onInspect,
}: {
  r: SearchResult
  strictCached: boolean
  onCopyMagnet: () => void
  onAdd: () => void
  onDownload: () => void
  onInspect: () => void
}) {
  const hasMagnet = !!r.magnet
  const isCached = r.cached === true
  const canAttempt = hasMagnet && (!strictCached || r.cached !== false)

  const addDisabled = !hasMagnet || (strictCached && r.cached === false)
  const dlDisabled = !hasMagnet || (strictCached && r.cached === false)

  return (
    <div className="machined-card group relative p-1 rounded-sm overflow-hidden animate-rise hover:border-primary/40 transition-colors">
      <div className="bg-base-200/50 p-6 flex flex-col md:flex-row gap-8 items-start md:items-center">
        
        {/* Status indicator module */}
        <div className="shrink-0 flex flex-col items-center gap-3 mt-8">
          <div className={`w-3 h-3 rounded-full ${isCached ? 'bg-success shadow-[0_0_12px_var(--color-success)]' : r.cached === false ? 'bg-error opacity-40' : 'bg-warning opacity-30 animate-pulse'} transition-all`} />
          <div className="text-[9px] font-mono uppercase tracking-[0.2em] vertical-rl h-16 opacity-30 select-none">
            {isCached ? 'CACHED' : r.cached === false ? 'UNCACHED' : 'SCANNING'}
          </div>
        </div>

        {/* Content module */}
        <div className="flex-1 min-w-0">
          <button 
            className="text-left w-full hover:opacity-80 transition-opacity"
            onClick={onInspect}
            type="button"
          >
            <h3 className="font-display text-lg md:text-xl font-bold uppercase tracking-tight leading-tight line-clamp-2">
              {r.title}
            </h3>
            
            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[10px] tracking-widest uppercase opacity-40">
              <span className="text-primary font-bold">{r.indexer}</span>
              {Number.isFinite(r.seeders) && <span>S: {r.seeders}</span>}
              {Number.isFinite(r.leechers) && <span>L: {r.leechers}</span>}
              {r.size && <span>{fmtBytes(r.size)}</span>}
              {r.infoHash && <span className="hidden sm:block">{shortHash(r.infoHash)}</span>}
            </div>
          </button>
        </div>

        {/* Actions module */}
        <div className="shrink-0 flex flex-col md:flex-row gap-3 w-full md:w-auto">
          <div className="join flex flex-1 md:flex-none">
            <button 
              className="btn btn-sm join-item flex-1 font-mono uppercase text-[10px] opacity-40 hover:opacity-100 hover:bg-base-100 border-base-content/10 transition-all"
              onClick={onCopyMagnet} 
              disabled={!hasMagnet}
              type="button"
            >
              Copy
            </button>
            <button 
              className="btn btn-sm join-item flex-1 font-mono uppercase text-[10px] opacity-40 hover:opacity-100 hover:bg-base-100 border-base-content/10 transition-all"
              onClick={onInspect}
              type="button"
            >
              Info
            </button>
          </div>

          <div className="flex flex-1 md:flex-none gap-2">
            <button 
              className="btn btn-sm btn-ghost border border-secondary/20 hover:border-secondary/60 hover:bg-secondary/5 text-secondary flex-1 font-mono uppercase text-[10px] px-4 min-h-0 h-9 transition-all flex items-center gap-2 group/btn"
              onClick={onAdd}
              disabled={addDisabled}
              type="button"
              title={!canAttempt ? 'UNSAFE_OPERATION' : 'ADD_TORRENT'}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-40 group-hover/btn:opacity-100 transition-opacity"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              Add
            </button>
            <button 
              className="btn btn-sm btn-ghost border border-primary/20 hover:border-primary/60 hover:bg-primary/5 text-primary flex-1 font-mono uppercase text-[10px] px-4 min-h-0 h-9 transition-all flex items-center gap-2 group/btn"
              onClick={onDownload}
              disabled={dlDisabled}
              type="button"
              title={!canAttempt ? 'UNSAFE_OPERATION' : 'EXEC_DOWNLOAD'}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-40 group-hover/btn:opacity-100 transition-opacity"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              Dl
            </button>
          </div>
        </div>
      </div>
      
      {/* Decorative accent for that machined physical feel */}
      <div className="absolute top-0 right-0 p-1 opacity-10 font-mono text-[8px] tracking-[0.4em] select-none pointer-events-none">
        MOD-X.0{Math.floor(Math.random() * 9)}
      </div>
    </div>
  )
}
