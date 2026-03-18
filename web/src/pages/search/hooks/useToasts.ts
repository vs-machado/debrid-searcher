import { useCallback, useState } from 'react'
import type { Toast, ToastKind } from '../components/ToastHost'

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id))
  }, [])

  const push = useCallback((kind: ToastKind, title: string, detail?: string) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`
    setToasts((t) => [{ id, kind, title, detail }, ...t].slice(0, 4))
    window.setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id))
    }, 4500)
  }, [])

  return { toasts, push, dismiss }
}
