export function fmtBytes(n?: number) {
  if (!Number.isFinite(n)) return ''
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let v = n as number
  let u = 0
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024
    u++
  }
  return `${v.toFixed(v >= 10 || u === 0 ? 0 : 1)} ${units[u]}`
}

export function shortHash(h?: string) {
  if (!h) return ''
  const s = h.trim()
  if (s.length <= 12) return s
  return `${s.slice(0, 10)}...`
}
