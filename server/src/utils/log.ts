export function safeJsonForLog(v: unknown, maxChars = 12000) {
  try {
    const s = JSON.stringify(v)
    if (s.length <= maxChars) return s
    return s.slice(0, maxChars) + `... (truncated, ${s.length} chars)`
  } catch (e) {
    return `[unserializable json: ${e instanceof Error ? e.message : String(e)}]`
  }
}
