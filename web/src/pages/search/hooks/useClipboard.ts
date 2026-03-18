import { useCallback } from 'react'

export function useClipboard() {
  const copyText = useCallback(async (text: string) => {
    await navigator.clipboard.writeText(text)
  }, [])

  return { copyText }
}
