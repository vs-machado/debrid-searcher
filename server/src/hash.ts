const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const BASE32_LOOKUP = new Map(BASE32_ALPHABET.split('').map((c, i) => [c, i]))

function isHex40(s: string) {
  return /^[a-fA-F0-9]{40}$/.test(s)
}

function base32ToBytes(base32: string) {
  const clean = base32.toUpperCase().replace(/=+$/g, '')
  let bits = 0
  let value = 0
  const out: number[] = []

  for (const ch of clean) {
    const v = BASE32_LOOKUP.get(ch)
    if (v == null) throw new Error('Invalid base32')
    value = (value << 5) | v
    bits += 5
    if (bits >= 8) {
      bits -= 8
      out.push((value >>> bits) & 0xff)
    }
  }

  return new Uint8Array(out)
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function magnetToInfoHashHex(magnet: string): string | undefined {
  const m = magnet.match(/(?:\?|&)xt=urn:btih:([^&]+)/i)
  if (!m) return undefined
  const raw = decodeURIComponent(m[1]).trim()
  if (isHex40(raw)) return raw.toLowerCase()
  if (/^[A-Z2-7]{32}$/i.test(raw)) {
    try {
      const bytes = base32ToBytes(raw)
      if (bytes.length !== 20) return undefined
      return bytesToHex(bytes)
    } catch {
      return undefined
    }
  }
  return undefined
}
