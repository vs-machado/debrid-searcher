import { useState } from 'react'
import type { SearchResult } from '../types'
import { fmtBytes } from '../lib/format'

export default function ResultCard({
  r,
  strictCached,
  onAdd,
  onDownload,
  onInspect,
}: {
  r: SearchResult
  strictCached: boolean
  onAdd: () => void
  onDownload: () => void
  onInspect: () => void
}) {
  const [isAdding, setIsAdding] = useState(false)
  const hasMagnet = !!r.magnet
  const isCached = r.cached === true
  const canAttempt = hasMagnet && (!strictCached || r.cached !== false)

  const addDisabled = !hasMagnet || isAdding
  const dlDisabled = !hasMagnet || (strictCached && r.cached === false)

  const handleAdd = async () => {
    if (addDisabled) return
    setIsAdding(true)
    try {
      await onAdd()
    } finally {
      setIsAdding(false)
    }
  }

  return (
    <div className="machined-card group relative p-0.5 rounded-sm overflow-hidden animate-rise hover:border-primary/40 transition-colors">
      <div className="bg-base-200/50 p-4 flex flex-col md:flex-row gap-5 items-start md:items-center">
        
        {/* Status indicator module */}
        <div className="shrink-0 flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full ${isCached ? 'bg-success shadow-[0_0_8px_var(--color-success)]' : r.cached === false ? 'bg-error opacity-40' : 'bg-base-content/20 opacity-40'} transition-all`} />
        </div>

        {/* Content module */}
        <div className="flex-1 min-w-0">
          <button 
            className="text-left w-full hover:opacity-80 transition-opacity"
            onClick={onInspect}
            type="button"
          >
            <h3 className="font-display text-base md:text-lg font-bold uppercase tracking-tight leading-tight line-clamp-1">
              {r.title}
            </h3>
            
            <div className="mt-2 flex flex-wrap items-center gap-x-8 gap-y-1.5 font-mono text-[10px] tracking-widest uppercase">
              <div className="w-28 shrink-0 opacity-40">
                {Number.isFinite(r.seeders) && <span>SEEDS: {r.seeders}</span>}
              </div>
              <div className="w-36 shrink-0 opacity-40">
                {r.size && <span>SIZE: {fmtBytes(r.size)}</span>}
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`badge badge-sm h-5 px-2 font-mono text-[9px] tracking-widest uppercase border ${
                    isCached
                      ? 'bg-success/10 text-success border-success/30'
                      : r.cached === false
                        ? 'bg-error/10 text-error border-error/30'
                        : 'bg-base-content/5 text-base-content/40 border-base-content/10'
                  }`}
                >
                  {isCached ? 'CACHED' : r.cached === false ? 'UNCACHED' : 'UNKNOWN'}
                </span>
              </div>
            </div>
          </button>
        </div>

        {/* Actions module */}
        <div className="shrink-0 flex flex-row gap-3 w-full md:w-auto">
          <button 
            className="btn btn-sm btn-ghost border border-secondary/20 hover:border-secondary/60 hover:bg-secondary/5 text-secondary flex-1 md:flex-none font-mono uppercase text-[10px] px-4 h-9 min-h-0 transition-all flex items-center justify-center gap-2 group/btn"
            onClick={handleAdd}
            disabled={addDisabled}
            type="button"
            title="ADD_TO_TORBOX"
          >
            {isAdding ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-40 group-hover/btn:opacity-100 transition-opacity"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            )}
            Add
          </button>
          <button 
            className="btn btn-sm btn-ghost border border-primary/20 hover:border-primary/60 hover:bg-primary/5 text-primary flex-1 md:flex-none font-mono uppercase text-[10px] px-4 h-9 min-h-0 transition-all flex items-center justify-center gap-2 group/btn"
            onClick={onDownload}
            disabled={dlDisabled}
            type="button"
            title={!canAttempt ? 'UNSAFE_OPERATION' : 'EXEC_DOWNLOAD'}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-40 group-hover/btn:opacity-100 transition-opacity"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            Dl
          </button>
        </div>
      </div>
      
      {/* Decorative accent for that machined physical feel */}
      <div className="absolute top-0 right-0 p-1 opacity-10 font-mono text-[8px] tracking-[0.4em] select-none pointer-events-none">
        MOD-X.0{Math.floor(Math.random() * 9)}
      </div>
    </div>
  )
}
