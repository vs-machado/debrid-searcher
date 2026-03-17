import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import type { NextFunction, Request, Response } from 'express'
import { readEnv } from './env.js'
import { searchTorznab, type TorznabResult } from './torznab.js'
import { torboxClient } from './torbox.js'

type ApiResult = TorznabResult & { cached?: boolean }

const env = readEnv()

const app = express()
app.disable('x-powered-by')

app.use(cors())
app.use(express.json({ limit: '1mb' }))

function safeJsonForLog(v: unknown, maxChars = 12000) {
  try {
    const s = JSON.stringify(v)
    if (s.length <= maxChars) return s
    return s.slice(0, maxChars) + `... (truncated, ${s.length} chars)`
  } catch (e) {
    return `[unserializable json: ${e instanceof Error ? e.message : String(e)}]`
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

function findTorrentId(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (!v) return undefined
  if (isRecord(v)) {
    const direct = (v as any).torrent_id ?? (v as any).torrentId ?? (v as any).id
    const n = typeof direct === 'string' ? Number(direct) : direct
    if (typeof n === 'number' && Number.isFinite(n)) return n

    // Common TorBox envelope { data: { torrent_id } }
    const cands = [(v as any).data, (v as any).result, (v as any).response, (v as any).payload]
    for (const c of cands) {
      const got = findTorrentId(c)
      if (got !== undefined) return got
    }
  }
  return undefined
}

function unwrapStandardData(v: unknown): unknown {
  if (!isRecord(v)) return v
  const cands = [(v as any).data, (v as any).result, (v as any).results, (v as any).response, (v as any).payload]
  for (const c of cands) {
    if (c !== undefined) return unwrapStandardData(c)
  }
  return v
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : []
}

// Basic API logging so it's easy to see what the server returns.
if (env.logHttp) {
  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    const started = Date.now()

    const origJson = res.json.bind(res)
    ;(res as any).json = (body: unknown) => {
      ;(res as any).__jsonBody = body
      return origJson(body as any)
    }

    res.on('finish', () => {
      const ms = Date.now() - started
      const body = (res as any).__jsonBody as unknown

      let extra = ''
      if (isRecord(body)) {
        const results = asArray(body.results)
        if (results.length) {
          const cachedCount = results.filter((r) => isRecord(r) && r.cached === true).length
          const errCount = asArray(body.errors).length
          extra = ` results=${results.length} cached=${cachedCount} errors=${errCount}`
        }
      }

      console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${ms}ms)${extra}`)

      if (isRecord(body)) {
        const errors = asArray(body.errors)
        if (errors.length) {
          for (const e of errors.slice(0, 10)) {
            if (isRecord(e)) console.log(`error[${String(e.indexer ?? 'unknown')}]: ${String(e.message ?? e.detail ?? '')}`)
            else console.log(`error: ${String(e)}`)
          }
          if (errors.length > 10) console.log(`... ${errors.length - 10} more error(s)`)
        }
      }

      if (env.logHttpBody && body !== undefined) console.log(safeJsonForLog(body))
    })

    next()
  })
}

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ ok: true })
})

app.get('/api/search', async (req: Request, res: Response) => {
  const q = z.string().trim().min(2).parse(req.query.q)
  const started = Date.now()

  const indexers = env.indexerUrls
  if (!indexers.length) {
    return res.json({
      query: q,
      elapsedMs: Date.now() - started,
      results: [],
      errors: [{ indexer: 'config', message: 'No indexers configured. Set INDEXERS_TORZNAB_URLS in server/.env.' }],
    })
  }

  const settled = await Promise.allSettled(indexers.map((u) => searchTorznab(u, q)))
  const errors: Array<{ indexer: string; message: string }> = []
  const merged: ApiResult[] = []

  for (let i = 0; i < settled.length; i++) {
    const s = settled[i]
    const indexer = new URL(indexers[i]).hostname
    if (s.status === 'fulfilled') {
      for (const r of s.value) merged.push({ ...r, indexer: r.indexer || indexer })
    } else {
      errors.push({ indexer, message: s.reason instanceof Error ? s.reason.message : String(s.reason) })
    }
  }

  // Dedupe by infoHash, then magnet, then title.
  const seen = new Set<string>()
  const results: ApiResult[] = []
  for (const r of merged) {
    const key = (r.infoHash && `h:${r.infoHash}`) || (r.magnet && `m:${r.magnet}`) || `t:${r.title}`
    if (seen.has(key)) continue
    seen.add(key)
    results.push(r)
  }

  // Cache check in one batch.
  let cachedResults: ApiResult[] = []
  if (env.torboxApiKey) {
    const hashes = results
      .map((r) => r.infoHash)
      .filter((h): h is string => typeof h === 'string' && !!h.trim())
      .map((h) => h.trim().toLowerCase())
    const unique = Array.from(new Set(hashes))

    try {
      const client = torboxClient({ baseUrl: env.torboxBaseUrl, apiKey: env.torboxApiKey })
      const map = await client.checkCached(unique)
      for (const r of results) {
        if (r.infoHash) r.cached = !!map[r.infoHash.trim().toLowerCase()]
      }

      cachedResults = results.filter((r) => r.cached)
    } catch (e) {
      errors.push({ indexer: 'torbox', message: e instanceof Error ? e.message : String(e) })
    }
  } else {
    errors.push({ indexer: 'torbox', message: 'TORBOX_API_KEY is not set; cannot check cache.' })
  }

  results.sort((a, b) => {
    const ac = a.cached ? 1 : 0
    const bc = b.cached ? 1 : 0
    if (ac !== bc) return bc - ac
    const as = a.seeders ?? -1
    const bs = b.seeders ?? -1
    if (as !== bs) return bs - as
    return a.title.localeCompare(b.title)
  })

  res.json({ query: q, elapsedMs: Date.now() - started, results, cachedResults, errors })
})

app.post('/api/torbox/add', async (req: Request, res: Response) => {
  const body = z
    .object({
      magnet: z.string().min(1),
      addOnlyIfCached: z.boolean().optional().default(true),
    })
    .parse(req.body)

  if (!env.torboxApiKey) {
    return res.status(400).json({ ok: false, detail: 'TORBOX_API_KEY is not set' })
  }

  try {
    const client = torboxClient({ baseUrl: env.torboxBaseUrl, apiKey: env.torboxApiKey })
    const torbox = await client.createTorrentFromMagnet(body.magnet, body.addOnlyIfCached)
    res.json({ ok: true, detail: 'Created torrent in TorBox.', torbox })
  } catch (e) {
    res.status(502).json({ ok: false, detail: e instanceof Error ? e.message : String(e) })
  }
})

app.post('/api/torbox/download', async (req: Request, res: Response) => {
  const body = z
    .object({
      magnet: z.string().min(1),
      infoHash: z.string().trim().min(8).optional(),
      addOnlyIfCached: z.boolean().optional().default(true),
      zipLink: z.boolean().optional().default(true),
    })
    .parse(req.body)

  if (!env.torboxApiKey) {
    return res.status(400).json({ ok: false, detail: 'TORBOX_API_KEY is not set' })
  }

  const client = torboxClient({ baseUrl: env.torboxBaseUrl, apiKey: env.torboxApiKey })

  let torrentId: number | undefined
  let createErr: unknown = null
  try {
    const created = await client.createTorrentFromMagnet(body.magnet, body.addOnlyIfCached)
    torrentId = findTorrentId(created)
  } catch (e) {
    createErr = e
  }

  // If create failed (often due to duplicates), try to locate it by hash in the user's list.
  if (torrentId === undefined && body.infoHash) {
    try {
      const list = await client.getTorrentList({ bypassCache: true, limit: 200, offset: 0 })
      const items = unwrapStandardData(list)
      if (Array.isArray(items)) {
        const want = body.infoHash.trim().toLowerCase()
        for (const it of items) {
          if (!isRecord(it)) continue
          const h = typeof (it as any).hash === 'string' ? (it as any).hash.trim().toLowerCase() : ''
          if (h && h === want) {
            const id = findTorrentId(it)
            if (id !== undefined) {
              torrentId = id
              break
            }
          }
        }
      }
    } catch {
      // ignore fallback errors; surface the original create error below
    }
  }

  if (torrentId === undefined) {
    const msg = createErr instanceof Error ? createErr.message : String(createErr || 'Failed to create torrent in TorBox')
    return res.status(502).json({ ok: false, detail: msg })
  }

  try {
    const url = await client.requestTorrentDownloadLink({ torrentId, zipLink: body.zipLink, redirect: false })
    res.json({ ok: true, detail: 'Download link ready.', url, torrentId })
  } catch (e) {
    res.status(502).json({ ok: false, detail: e instanceof Error ? e.message : String(e) })
  }
})

// Serve built web app if present.
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const webDist = path.resolve(__dirname, '..', '..', 'web', 'dist')
const webIndex = path.join(webDist, 'index.html')

if (fs.existsSync(webIndex)) {
  app.use(express.static(webDist))
  // Express 5 no longer accepts `*` as a route pattern.
  app.get(/^(?!\/api\/).*/, (req: Request, res: Response, next: NextFunction) => {
    res.sendFile(webIndex, (err: unknown) => {
      if (err) next(err as any)
    })
  })
}

app.listen(env.port, () => {
  console.log(`server listening on http://localhost:${env.port}`)
})
