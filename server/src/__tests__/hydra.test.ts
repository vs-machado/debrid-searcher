import { afterEach, describe, expect, it, vi } from 'vitest'
import { searchHydraSource } from '../clients/hydra.js'

describe('Hydra source client', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('filters Hydra downloads and maps magnet metadata', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        name: 'FitGirl',
        downloads: [
          {
            title: 'Example Game',
            uris: ['magnet:?xt=urn:btih:0123456789012345678901234567890123456789'],
            fileSize: '5 GB',
            uploadDate: '2026-01-02T03:04:05Z',
          },
          { title: 'Different Game', uris: ['magnet:?xt=urn:btih:abcdefabcdefabcdefabcdefabcdefabcdefabcd'] },
        ],
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ),
    )

    const results = await searchHydraSource('https://example.test/source.json', 'example game')

    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({
      title: 'Example Game',
      indexer: 'FitGirl',
      infoHash: '0123456789012345678901234567890123456789',
      size: 5 * 1024 ** 3,
      publishDate: '2026-01-02T03:04:05Z',
    })
  })

  it('accepts a direct URI when a source has no magnet', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify([{ title: 'Example Game', uris: ['https://example.test/game.torrent'] }]), { status: 200 }),
    )

    const results = await searchHydraSource('https://example.test/source.json', 'example')

    expect(results[0]?.downloadUrl).toBe('https://example.test/game.torrent')
    expect(results[0]?.magnet).toBeUndefined()
  })
})
