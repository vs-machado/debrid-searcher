export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path, { credentials: 'include' })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return (await res.json()) as T
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    credentials: 'include',
  })

  const json = (await res.json().catch(() => ({}))) as T
  if (!res.ok) {
    const maybe = json as { detail?: string }
    throw new Error(maybe.detail || `${res.status} ${res.statusText}`)
  }
  return json
}

export async function apiPostJson(path: string, body: unknown): Promise<{ ok: boolean; status: number; json: any }> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    credentials: 'include',
  })

  const json = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, json }
}
