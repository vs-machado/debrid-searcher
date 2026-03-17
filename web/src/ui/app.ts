type SearchResult = {
  title: string
  indexer: string
  seeders?: number
  leechers?: number
  size?: number
  publishDate?: string
  infoHash?: string
  magnet?: string
  downloadUrl?: string
  cached?: boolean
}

type SearchResponse = {
  query: string
  elapsedMs: number
  results: SearchResult[]
  cachedResults?: SearchResult[]
  errors: Array<{ indexer: string; message: string }>
}

type AddResponse = {
  ok: boolean
  detail?: string
  torbox?: unknown
}

function esc(s: string) {
  return s.replace(/[&<>"]/g, (ch) => {
    switch (ch) {
      case '&':
        return '&amp;'
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '"':
        return '&quot;'
      default:
        return ch
    }
  })
}

function fmtBytes(n?: number) {
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

function badge(label: string, variant: 'good' | 'bad' | 'neutral') {
  return `<span class="badge badge--${variant}">${esc(label)}</span>`
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return (await res.json()) as T
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = (await res.json().catch(() => ({}))) as T
  if (!res.ok) {
    const maybe = json as { detail?: string }
    throw new Error(maybe.detail || `${res.status} ${res.statusText}`)
  }
  return json
}

export function mountApp(root: HTMLDivElement) {
  root.innerHTML = `
    <div class="bg"></div>
    <header class="top">
      <div class="brand">
        <div class="brand__mark" aria-hidden="true"></div>
        <div class="brand__text">
          <h1>Debrid Downloader</h1>
          <p>Search torrents via indexers, then keep only what TorBox already has cached.</p>
        </div>
      </div>
    </header>

    <main class="shell">
      <section class="panel" aria-label="Search">
        <form id="searchForm" class="search">
          <label class="field">
            <span class="field__label">Query</span>
            <input id="q" class="field__input" type="search" placeholder="e.g. Dune 2021 1080p" autocomplete="off" />
          </label>

          <label class="toggle">
            <input id="onlyCached" type="checkbox" checked />
            <span>Only cached</span>
          </label>

          <button class="btn" type="submit">Search</button>
        </form>

        <div class="meta">
          <div id="status" class="status">Ready.</div>
          <div class="hint">Indexer config lives in <code>server/.env</code> (Torznab URLs).</div>
        </div>
      </section>

      <section class="panel" aria-label="Results">
        <div class="results__head">
          <h2>Results</h2>
          <div id="counts" class="counts"></div>
        </div>
        <div id="results" class="results"></div>
      </section>
    </main>

    <footer class="foot">
      <span>API: <code>/api/search</code>, <code>/api/torbox/add</code></span>
    </footer>
  `

  const form = root.querySelector<HTMLFormElement>('#searchForm')!
  const qInput = root.querySelector<HTMLInputElement>('#q')!
  const onlyCachedInput = root.querySelector<HTMLInputElement>('#onlyCached')!
  const status = root.querySelector<HTMLDivElement>('#status')!
  const counts = root.querySelector<HTMLDivElement>('#counts')!
  const resultsEl = root.querySelector<HTMLDivElement>('#results')!

  let last: SearchResponse | null = null
  let busy = false

  function setBusy(next: boolean) {
    busy = next
    ;(form.querySelector('button[type="submit"]') as HTMLButtonElement).disabled = busy
    qInput.disabled = busy
    onlyCachedInput.disabled = busy
  }

  function viewResults() {
    if (!last) return []
    if (!onlyCachedInput.checked) return last.results
    return last.cachedResults || last.results.filter((r) => r.cached)
  }

  function render() {
    const all = last?.results || []
    const filtered = viewResults()
    const cachedCount = all.filter((r) => r.cached).length

    counts.innerHTML = all.length
      ? `${cachedCount} cached / ${all.length} total${last?.errors?.length ? ` - ${last.errors.length} indexer error(s)` : ''}`
      : ''

    if (!filtered.length) {
      resultsEl.innerHTML = `<div class="empty">No results${onlyCachedInput.checked ? ' cached on TorBox' : ''}.</div>`
      return
    }

    resultsEl.innerHTML = filtered
      .map((r) => {
        const seed = Number.isFinite(r.seeders) ? `<span class="pill">S ${r.seeders}</span>` : ''
        const leech = Number.isFinite(r.leechers) ? `<span class="pill">L ${r.leechers}</span>` : ''
        const size = r.size ? `<span class="pill">${esc(fmtBytes(r.size))}</span>` : ''
        const cached = r.cached ? badge('Cached', 'good') : badge('Not cached', 'bad')
        const addDisabled = !r.magnet
        const addLabel = addDisabled ? 'No magnet' : 'Add to TorBox'

        return `
          <article class="card">
            <div class="card__top">
              <div class="card__title">${esc(r.title)}</div>
              <div class="card__badges">${cached}</div>
            </div>

            <div class="card__meta">
              <span class="source">${esc(r.indexer)}</span>
              ${seed}${leech}${size}
              ${r.infoHash ? `<span class="hash" title="Info hash">${esc(r.infoHash.slice(0, 10))}...</span>` : ''}
            </div>

            <div class="card__actions">
              <button class="btn btn--ghost" type="button" data-action="copy" ${r.magnet ? '' : 'disabled'}>Copy magnet</button>
              <button class="btn" type="button" data-action="add" ${addDisabled ? 'disabled' : ''}>${esc(addLabel)}</button>
            </div>
          </article>
        `
      })
      .join('')
  }

  async function doSearch(q: string) {
    setBusy(true)
    status.textContent = 'Searching...'
    resultsEl.innerHTML = `<div class="skeleton">
      <div class="sk"></div><div class="sk"></div><div class="sk"></div>
    </div>`
    counts.textContent = ''

    try {
      const started = performance.now()
      last = await apiGet<SearchResponse>(`/api/search?q=${encodeURIComponent(q)}`)
      const elapsed = Math.round(performance.now() - started)
      status.textContent = `Done in ${elapsed}ms. ${last.results.length} result(s).`
      render()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      status.textContent = `Error: ${msg}`
      last = { query: q, elapsedMs: 0, results: [], errors: [{ indexer: 'server', message: msg }] }
      render()
    } finally {
      setBusy(false)
    }
  }

  async function addToTorbox(magnet: string) {
    return await apiPost<AddResponse>('/api/torbox/add', {
      magnet,
      addOnlyIfCached: true,
    })
  }

  form.addEventListener('submit', (ev) => {
    ev.preventDefault()
    const q = qInput.value.trim()
    if (!q || busy) return
    void doSearch(q)
  })

  onlyCachedInput.addEventListener('change', () => render())

  resultsEl.addEventListener('click', async (ev) => {
    const t = ev.target as HTMLElement
    const btn = t.closest<HTMLButtonElement>('button[data-action]')
    if (!btn || busy) return

    const items = viewResults()
    const card = btn.closest<HTMLElement>('.card')
    if (!card) return
    const idx = Array.from(resultsEl.querySelectorAll('.card')).indexOf(card)
    const item = items[idx]
    if (!item) return

    const action = btn.dataset.action
    if (action === 'copy') {
      if (!item.magnet) return
      await navigator.clipboard.writeText(item.magnet)
      status.textContent = 'Magnet copied.'
      return
    }

    if (action === 'add') {
      if (!item.magnet) return
      btn.disabled = true
      btn.textContent = 'Adding...'
      try {
        const r = await addToTorbox(item.magnet)
        status.textContent = r.detail || 'Sent to TorBox.'
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        status.textContent = `TorBox add failed: ${msg}`
      } finally {
        btn.textContent = 'Add to TorBox'
        btn.disabled = false
      }
    }
  })

  // Nice default for quick testing
  qInput.value = 'ubuntu'
}
