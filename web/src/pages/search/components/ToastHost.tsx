export type ToastKind = 'success' | 'info' | 'warning' | 'error'

export type Toast = {
  id: string
  kind: ToastKind
  title: string
  detail?: string
}

export default function ToastHost({ toasts, onClose }: { toasts: Toast[]; onClose: (id: string) => void }) {
  return (
    <div className="toast toast-end toast-top z-50 p-6">
      {toasts.map((t) => (
        <div key={t.id} className={`alert rounded-sm shadow-2xl border-l-4 ${alertStyle(t.kind)} machined-card transition-all`}>
          <div className="flex-1 min-w-0">
            <div className="font-mono text-[10px] tracking-widest uppercase opacity-40 mb-1">Alert_{t.kind}</div>
            <div className="font-display font-bold uppercase tracking-tight">{t.title}</div>
            {t.detail ? <div className="text-[11px] opacity-70 mt-1 break-words font-mono">{t.detail}</div> : null}
          </div>
          <button className="btn btn-ghost btn-xs font-mono opacity-50 hover:opacity-100" onClick={() => onClose(t.id)} aria-label="Dismiss">
            [X]
          </button>
        </div>
      ))}
    </div>
  )
}

function alertStyle(kind: ToastKind) {
  switch (kind) {
    case 'success': return 'border-success bg-success/5'
    case 'info':    return 'border-info bg-info/5'
    case 'warning': return 'border-warning bg-warning/5'
    case 'error':   return 'border-error bg-error/5'
    default:        return 'border-info bg-info/5'
  }
}
