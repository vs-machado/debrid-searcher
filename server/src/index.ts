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
  if (env.torboxApiKey) {
    const hashes = results.map((r) => r.infoHash).filter(Boolean) as string[]
    const unique = Array.from(new Set(hashes))

    try {
      const client = torboxClient({ baseUrl: env.torboxBaseUrl, apiKey: env.torboxApiKey })
      const map = await client.checkCached(unique)
      for (const r of results) {
        if (r.infoHash) r.cached = !!map[r.infoHash]
      }
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

  res.json({ query: q, elapsedMs: Date.now() - started, results, errors })
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
