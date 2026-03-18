import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from '../app.js'
import type { AppEnv } from '../config/env.js'

function makeEnv(partial?: Partial<AppEnv>): AppEnv {
  return {
    port: 5174,
    torboxBaseUrl: 'https://api.torbox.app',
    torboxApiKey: undefined,
    indexerUrls: [],
    logHttp: false,
    logHttpBody: false,
    ...partial,
  }
}

describe('api', () => {
  it('GET /api/health', async () => {
    const app = createApp(makeEnv())
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true })
  })

  it('GET /api/search validates query', async () => {
    const app = createApp(makeEnv())
    const res = await request(app).get('/api/search?q=a')
    expect(res.status).toBe(400)
    expect(res.body?.ok).toBe(false)
    expect(res.body?.detail).toBe('Invalid request')
    expect(Array.isArray(res.body?.issues)).toBe(true)
  })

  it('GET /api/search returns config error when no indexers', async () => {
    const app = createApp(makeEnv({ indexerUrls: [] }))
    const res = await request(app).get('/api/search?q=matrix')
    expect(res.status).toBe(200)
    expect(res.body?.query).toBe('matrix')
    expect(Array.isArray(res.body?.results)).toBe(true)
    expect(res.body.results.length).toBe(0)
    expect(Array.isArray(res.body?.errors)).toBe(true)
    expect(res.body.errors[0]?.indexer).toBe('config')
  })

  it('POST /api/torbox/add errors when API key missing', async () => {
    const app = createApp(makeEnv({ torboxApiKey: undefined }))
    const res = await request(app).post('/api/torbox/add').send({ magnet: 'magnet:?xt=urn:btih:abc' })
    expect(res.status).toBe(400)
    expect(res.body?.ok).toBe(false)
    expect(res.body?.detail).toBe('TORBOX_API_KEY is not set')
  })

  it('POST /api/torbox/download errors when API key missing', async () => {
    const app = createApp(makeEnv({ torboxApiKey: undefined }))
    const res = await request(app)
      .post('/api/torbox/download')
      .send({ magnet: 'magnet:?xt=urn:btih:abc', zipLink: true })
    expect(res.status).toBe(400)
    expect(res.body?.ok).toBe(false)
    expect(res.body?.detail).toBe('TORBOX_API_KEY is not set')
  })
})
