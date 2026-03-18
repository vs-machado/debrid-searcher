export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return (await res.json()) as T
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
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
