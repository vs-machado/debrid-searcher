export type AppEnv = {
  port: number
  torboxBaseUrl: string
  torboxRelayBaseUrl: string
  torboxApiKey?: string
  indexerUrls: string[]
  hydraSourceUrls: string[]
  logHttp: boolean
  logHttpBody: boolean
  authUsername?: string
  authPassword?: string
  authCookieSecret?: string
  authCookieSecure?: boolean
}

function parseBool(raw: string | undefined, defaultValue: boolean) {
  if (raw == null) return defaultValue
  const s = raw.trim().toLowerCase()
  if (!s) return defaultValue
  if (s === '1' || s === 'true' || s === 'yes' || s === 'y' || s === 'on') return true
  if (s === '0' || s === 'false' || s === 'no' || s === 'n' || s === 'off') return false
  return defaultValue
}

function parseOptionalBool(raw: string | undefined): boolean | undefined {
  if (raw == null) return undefined
  const s = raw.trim().toLowerCase()
  if (!s) return undefined
  if (s === '1' || s === 'true' || s === 'yes' || s === 'y' || s === 'on') return true
  if (s === '0' || s === 'false' || s === 'no' || s === 'n' || s === 'off') return false
  throw new Error('AUTH_COOKIE_SECURE must be a boolean (true/false)')
}

function parseUrls(raw: string | undefined, variableName: string) {
  if (!raw) return []
  const s = raw.trim()
  if (!s) return []

  if (s.startsWith('[')) {
    const arr = JSON.parse(s) as unknown
    if (!Array.isArray(arr)) throw new Error(`${variableName} must be a JSON array`)
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
  const torboxRelayBaseUrl = (process.env.TORBOX_RELAY_BASE_URL || 'https://relay.torbox.app').replace(/\/+$/, '')
  const torboxApiKey = process.env.TORBOX_API_KEY?.trim() || undefined
  const indexerUrls = parseUrls(process.env.INDEXERS_TORZNAB_URLS, 'INDEXERS_TORZNAB_URLS')
  const hydraSourceUrls = parseUrls(process.env.INDEXERS_HYDRA_URLS, 'INDEXERS_HYDRA_URLS')

  const logHttp = parseBool(process.env.LOG_HTTP, true)
  const logHttpBody = parseBool(process.env.LOG_HTTP_BODY, false)

  const authUsername = process.env.AUTH_USERNAME?.trim() || undefined
  const authPassword = process.env.AUTH_PASSWORD?.trim() || undefined
  const authCookieSecret = process.env.AUTH_COOKIE_SECRET?.trim() || undefined
  const authCookieSecure = parseOptionalBool(process.env.AUTH_COOKIE_SECURE)

  return {
    port,
    torboxBaseUrl,
    torboxRelayBaseUrl,
    torboxApiKey,
    indexerUrls,
    hydraSourceUrls,
    logHttp,
    logHttpBody,
    authUsername,
    authPassword,
    authCookieSecret,
    authCookieSecure,
  }
}
