import request from 'supertest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../app.js'
import type { AppEnv } from '../config/env.js'

function makeEnv(partial?: Partial<AppEnv>): AppEnv {
  return {
    port: 5174,
    torboxBaseUrl: 'https://api.torbox.app',
    torboxRelayBaseUrl: 'https://relay.torbox.app',
    torboxApiKey: undefined,
    indexerUrls: [],
    hydraSourceUrls: [],
    logHttp: false,
    logHttpBody: false,
    authUsername: 'admin',
    authPassword: 'pw',
    authCookieSecret: 'test-secret-please-change',
    ...partial,
  }
}

describe('api', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('GET /api/health', async () => {
    const app = createApp(makeEnv())
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true })
  })

  it('GET /api/search validates query', async () => {
    const app = createApp(makeEnv())
    const agent = request.agent(app)
    await agent.post('/api/auth/login').send({ username: 'admin', password: 'pw' }).expect(200)
    const res = await agent.get('/api/search?q=a')
    expect(res.status).toBe(400)
    expect(res.body?.ok).toBe(false)
    expect(res.body?.detail).toBe('Invalid request')
    expect(Array.isArray(res.body?.issues)).toBe(true)
  })

  it('GET /api/search returns config error when no indexers', async () => {
    const app = createApp(makeEnv({ indexerUrls: [] }))
    const agent = request.agent(app)
    await agent.post('/api/auth/login').send({ username: 'admin', password: 'pw' }).expect(200)
    const res = await agent.get('/api/search?q=matrix')
    expect(res.status).toBe(200)
    expect(res.body?.query).toBe('matrix')
    expect(Array.isArray(res.body?.results)).toBe(true)
    expect(res.body.results.length).toBe(0)
    expect(Array.isArray(res.body?.errors)).toBe(true)
    expect(res.body.errors[0]?.indexer).toBe('config')
  })

  it('POST /api/torbox/add errors when API key missing', async () => {
    const app = createApp(makeEnv({ torboxApiKey: undefined }))
    const agent = request.agent(app)
    await agent.post('/api/auth/login').send({ username: 'admin', password: 'pw' }).expect(200)
    const res = await agent.post('/api/torbox/add').send({ magnet: 'magnet:?xt=urn:btih:abc' })
    expect(res.status).toBe(400)
    expect(res.body?.ok).toBe(false)
    expect(res.body?.detail).toBe('TORBOX_API_KEY is not set')
  })

  it('POST /api/torbox/download errors when API key missing', async () => {
    const app = createApp(makeEnv({ torboxApiKey: undefined }))
    const agent = request.agent(app)
    await agent.post('/api/auth/login').send({ username: 'admin', password: 'pw' }).expect(200)
    const res = await agent
      .post('/api/torbox/download')
      .send({ magnet: 'magnet:?xt=urn:btih:abc', zipLink: true })
    expect(res.status).toBe(400)
    expect(res.body?.ok).toBe(false)
    expect(res.body?.detail).toBe('TORBOX_API_KEY is not set')
  })

  it('GET /api/torbox/status errors when API key missing', async () => {
    const app = createApp(makeEnv({ torboxApiKey: undefined }))
    const agent = request.agent(app)
    await agent.post('/api/auth/login').send({ username: 'admin', password: 'pw' }).expect(200)
    const res = await agent.get('/api/torbox/status?torrentId=123')
    expect(res.status).toBe(400)
    expect(res.body?.ok).toBe(false)
    expect(res.body?.detail).toBe('TORBOX_API_KEY is not set')
  })

  it('POST /api/torbox/add returns the TorBox torrent id when available', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: { torrent_id: 321 } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )

    const app = createApp(makeEnv({ torboxApiKey: 'tb-key' }))
    const agent = request.agent(app)
    await agent.post('/api/auth/login').send({ username: 'admin', password: 'pw' }).expect(200)

    const res = await agent.post('/api/torbox/add').send({ magnet: 'magnet:?xt=urn:btih:abc' })

    expect(res.status).toBe(200)
    expect(res.body?.ok).toBe(true)
    expect(res.body?.torrentId).toBe(321)
  })

  it('POST /api/torbox/download returns a direct link for JDownloader', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: { torrent_id: 321 } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: 'https://cdn.example.test/file.zip' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }))

    const app = createApp(makeEnv({ torboxApiKey: 'tb-key' }))
    const agent = request.agent(app)
    await agent.post('/api/auth/login').send({ username: 'admin', password: 'pw' }).expect(200)

    const res = await agent.post('/api/torbox/download').send({
      magnet: 'magnet:?xt=urn:btih:abc',
      zipLink: true,
    })

    expect(res.status).toBe(200)
    expect(res.body?.ok).toBe(true)
    expect(res.body?.torrentId).toBe(321)
    expect(res.body?.url).toBe('https://cdn.example.test/file.zip')
    expect(String(vi.mocked(globalThis.fetch).mock.calls[1]?.[0])).toContain('/v1/api/torrents/requestdl')
  })

  it('GET /api/torbox/status reports ready with progress for a cached TorBox torrent', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: { id: 321, hash: 'ABCDEF123456', download_state: 'cached', progress: 100 } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )

    const app = createApp(makeEnv({ torboxApiKey: 'tb-key' }))
    const agent = request.agent(app)
    await agent.post('/api/auth/login').send({ username: 'admin', password: 'pw' }).expect(200)

    const res = await agent.get('/api/torbox/status?torrentId=321')

    expect(res.status).toBe(200)
    expect(res.body?.ok).toBe(true)
    expect(res.body?.found).toBe(true)
    expect(res.body?.ready).toBe(true)
    expect(res.body?.cached).toBe(true)
    expect(res.body?.progress).toBe(100)
    expect(res.body?.torrentId).toBe(321)
  })

  it('GET /api/torbox/status reports in-progress torrent percentage', async () => {
    const torrentPayload = { success: true, data: { id: 321, auth_id: 'user-123', hash: 'ABCDEF123456', download_state: 'downloading', progress: 0.427 } }
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(torrentPayload), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify(torrentPayload), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }))

    const app = createApp(makeEnv({ torboxApiKey: 'tb-key' }))
    const agent = request.agent(app)
    await agent.post('/api/auth/login').send({ username: 'admin', password: 'pw' }).expect(200)

    const res = await agent.get('/api/torbox/status?torrentId=321')

    expect(res.status).toBe(200)
    expect(res.body?.ok).toBe(true)
    expect(res.body?.found).toBe(true)
    expect(res.body?.ready).toBe(false)
    expect(res.body?.cached).toBe(false)
    expect(res.body?.status).toBe('downloading')
    expect(res.body?.progress).toBe(42.7)
    expect(res.body?.refreshed).toBe(true)
    expect(res.headers['cache-control']).toBe('no-store')
    expect(globalThis.fetch).toHaveBeenCalledTimes(3)
    expect(String(vi.mocked(globalThis.fetch).mock.calls[1]?.[0])).toContain('https://relay.torbox.app/v1/inactivecheck/torrent/')
  })

  it('GET /api/torbox/status reports ready for a download ready label by info hash', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: [{ id: 654, hash: 'ABCDEF123456', download_label: 'Download Ready' }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )

    const app = createApp(makeEnv({ torboxApiKey: 'tb-key' }))
    const agent = request.agent(app)
    await agent.post('/api/auth/login').send({ username: 'admin', password: 'pw' }).expect(200)

    const res = await agent.get('/api/torbox/status?infoHash=abcdef123456')

    expect(res.status).toBe(200)
    expect(res.body?.ok).toBe(true)
    expect(res.body?.found).toBe(true)
    expect(res.body?.ready).toBe(true)
    expect(res.body?.cached).toBe(true)
    expect(res.body?.torrentId).toBe(654)
  })

  it('GET /api/torbox/status treats completed TorBox torrents as ready', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: { id: 777, hash: 'ABCDEF123456', download_state: 'completed', progress: 1 } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )

    const app = createApp(makeEnv({ torboxApiKey: 'tb-key' }))
    const agent = request.agent(app)
    await agent.post('/api/auth/login').send({ username: 'admin', password: 'pw' }).expect(200)

    const res = await agent.get('/api/torbox/status?torrentId=777')

    expect(res.status).toBe(200)
    expect(res.body?.ready).toBe(true)
    expect(res.body?.cached).toBe(true)
    expect(res.body?.progress).toBe(100)
  })
})
