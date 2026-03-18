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
        <div className="shrink-0 flex flex-col items-center gap-3">
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

          <div className="join flex flex-1 md:flex-none">
            <button 
              className="btn btn-sm btn-secondary join-item flex-1 font-mono uppercase text-[10px] border-none px-6"
              onClick={onAdd}
              disabled={addDisabled}
              type="button"
              title={!canAttempt ? 'UNSAFE_OPERATION' : 'ADD_TORRENT'}
            >
              Add
            </button>
            <button 
              className="btn btn-sm btn-primary join-item flex-1 font-mono uppercase text-[10px] border-none px-6"
              onClick={onDownload}
              disabled={dlDisabled}
              type="button"
              title={!canAttempt ? 'UNSAFE_OPERATION' : 'EXEC_DOWNLOAD'}
            >
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
