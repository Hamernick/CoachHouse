import "server-only"
import { nsfSolicitationUrl, parseNsfApplicationInstructions, type ApplicationInstructions } from "../lib/application-instructions"

const MAX_BYTES = 1024 * 1024

/** Public source only. No user data, cookies, credentials, arbitrary hosts or cross-host redirects. */
export async function fetchApplicationInstructions(sourceUrl: string | null | undefined, fetchImpl: typeof fetch = fetch, checkedAt = new Date().toISOString()): Promise<ApplicationInstructions> {
  const source = sourceUrl ? nsfSolicitationUrl(sourceUrl) : null
  const empty: ApplicationInstructions = { state: source ? "unavailable" : "unsupported", sourceUrl: source?.url ?? sourceUrl ?? null, checkedAt, acceptingProposals: "unknown", sections: [] }
  if (!source) return empty
  const signal = AbortSignal.timeout(10000)
  let current = source.url
  try {
    for (let redirect = 0; redirect <= 3; redirect++) {
      const response = await fetchImpl(current, { method: "GET", headers: { Accept: "text/html" }, cache: "no-store", redirect: "manual", credentials: "omit", signal })
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location")
        await response.body?.cancel()
        if (!location) return empty
        const next = nsfSolicitationUrl(new URL(location, current).href)
        if (!next || next.publication !== source.publication) return empty
        current = next.url; continue
      }
      if (!response.ok || !/^text\/html(?:;|$)/i.test(response.headers.get("content-type") ?? "") || Number(response.headers.get("content-length")) > MAX_BYTES) {
        await response.body?.cancel(); return empty
      }
      const reader = response.body?.getReader()
      if (!reader) return empty
      const decoder = new TextDecoder(), chunks: string[] = []
      let size = 0
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          size += value.byteLength
          if (size > MAX_BYTES) { await reader.cancel(); return empty }
          chunks.push(decoder.decode(value, { stream: true }))
        }
      } finally { reader.releaseLock() }
      return parseNsfApplicationInstructions(chunks.join("") + decoder.decode(), current, source.publication, checkedAt)
    }
  } catch { return empty }
  return empty
}
