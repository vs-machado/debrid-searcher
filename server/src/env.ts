export type AppEnv = {
  port: number
  torboxBaseUrl: string
  torboxApiKey?: string
  indexerUrls: string[]
}

function parseIndexerUrls(raw: string | undefined) {
  if (!raw) return []
  const s = raw.trim()
  if (!s) return []

  if (s.startsWith('[')) {
    const arr = JSON.parse(s) as unknown
    if (!Array.isArray(arr)) throw new Error('INDEXERS_TORZNAB_URLS must be a JSON array')
    return arr.map(String).map((v) => v.trim()).filter(Boolean)
  }

  return s
    .split(/\r?\n|\s*\|\s*|\s*,\s*/g)
    .map((v) => v.trim())
    .filter(Boolean)
}

export function readEnv(): AppEnv {
  const port = Number(process.env.PORT || 5174)
  if (!Number.isFinite(port)) throw new Error('PORT must be a number')

  const torboxBaseUrl = (process.env.TORBOX_BASE_URL || 'https://api.torbox.app').replace(/\/+$/, '')
  const torboxApiKey = process.env.TORBOX_API_KEY?.trim() || undefined
  const indexerUrls = parseIndexerUrls(process.env.INDEXERS_TORZNAB_URLS)

  return { port, torboxBaseUrl, torboxApiKey, indexerUrls }
}
