function normalizeForSearch(s: string): string {
  return s
    .toLowerCase()
    .replace(/['`’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function toRoman(n: number): string {
  // Simple roman numerals up to 39 (enough for sequel numbers).
  if (!Number.isFinite(n) || n <= 0 || n >= 40) return ''
  const tens = ['', 'x', 'xx', 'xxx']
  const ones = ['', 'i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix']
  return (tens[Math.floor(n / 10)] + ones[n % 10]).toUpperCase()
}

function queryTokens(q: string): string[] {
  return normalizeForSearch(q)
    .split(' ')
    .map((t) => t.trim())
    .filter(Boolean)
}

export function computeRelevanceScore(query: string, title: string): number {
  // Rank titles that match the user's query terms (esp. numbers).
  const qn = normalizeForSearch(query)
  const tn = normalizeForSearch(title)
  if (!qn || !tn) return 0

  let score = 0

  // Phrase signals.
  if (tn === qn) score += 200
  if (tn.startsWith(qn)) score += 120
  const phraseIdx = tn.indexOf(qn)
  if (phraseIdx >= 0) score += 80 + Math.max(0, 30 - phraseIdx)

  // Token signals.
  const qt = queryTokens(query)
  for (const tok of qt) {
    if (tok.length === 1 && !/^[0-9]$/.test(tok)) continue

    const variants = new Set<string>([tok])
    if (/^[0-9]{1,2}$/.test(tok)) {
      const roman = toRoman(Number(tok))
      if (roman) variants.add(roman.toLowerCase())
    } else if (/^[ivxlcdm]{1,6}$/i.test(tok)) {
      const roman = tok.toUpperCase()
      const map: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10 }
      const n = map[roman]
      if (n) variants.add(String(n))
    }

    let matched = false
    let bestIdx = Number.POSITIVE_INFINITY
    for (const v of variants) {
      const re = new RegExp(`\\b${escapeRegExp(v)}\\b`, 'i')
      const m = tn.match(re)
      if (m && typeof m.index === 'number') {
        matched = true
        bestIdx = Math.min(bestIdx, m.index)
      }
    }

    if (matched) {
      score += 12
      if (Number.isFinite(bestIdx)) score += Math.max(0, 18 - bestIdx)
      // Make sequel/year tokens matter a lot.
      if (/^[0-9]{1,4}$/.test(tok)) score += 30
    } else {
      score -= 35
    }
  }

  return score
}
