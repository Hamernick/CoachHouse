import "server-only"

import { assertPrivateOrganizationReadWindow, createPrivateOrganizationLink } from "./private-storage-link"

export const PRIVATE_FILE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Referrer-Policy": "no-referrer",
  "Content-Security-Policy": "sandbox; default-src 'none'; frame-ancestors 'self'",
  Vary: "Cookie, Authorization",
}

/** A reusable app URL is an address, never a bearer credential. Each request
 * must enter the source owner's existing authentication/authorization path. */
export function privateFileContentUrl(path: string, params: Record<string, string>) {
  return `${path}?${new URLSearchParams({ ...params, content: "1" })}`
}

function disposition(name: string, mime: string, download: boolean) {
  const safeInline = /^(application\/pdf|image\/(png|jpeg|gif|webp|avif)|text\/plain|audio\/(mpeg|mp4|ogg|wav)|video\/(mp4|webm))$/.test(mime)
  const filename = name.replace(/[\r\n\u0000-\u001f\u007f]/g, "").slice(0, 180) || "document"
  const fallback = filename.replace(/[^a-zA-Z0-9._ -]/g, "_")
  const encoded = encodeURIComponent(filename.toWellFormed()).replace(/['()*]/g, character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)
  return `${download || !safeInline ? "attachment" : "inline"}; filename="${fallback}"; filename*=UTF-8''${encoded}`
}

/** Storage/CDN capabilities stay server-side. Recheck source authority and the
 * fixed organization read window after upstream headers, before sending bytes.
 * Already delivered bytes cannot be recalled; subsequent app requests recheck.
 */
export async function privateStorageResponse({ request, orgId, name, mime, maxBytes, download, sign, revalidate }: {
  request: Request
  orgId: string
  name: string
  mime: string
  maxBytes: number
  download: boolean
  sign: Parameters<typeof createPrivateOrganizationLink>[0]["sign"]
  revalidate: () => Promise<boolean>
}) {
  let upstream: Response | undefined
  try {
    const range = request.headers.get("range")
    if (range && !/^bytes=(?:\d{1,15}-\d{0,15}|-\d{1,15})$/.test(range))
      return new Response(null, { status: 416, headers: PRIVATE_FILE_HEADERS })
    const signed = await createPrivateOrganizationLink({ orgId, ttl: 60, sign, revalidate })
    if (!signed.data?.signedUrl || signed.error) throw new Error("Unavailable")
    upstream = await fetch(signed.data.signedUrl, {
      cache: "no-store", redirect: "error",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(15_000)]),
      ...(range ? { headers: { Range: range } } : {}),
    })
    if (upstream.status === 416) {
      await upstream.body?.cancel()
      return new Response(null, { status: 416, headers: PRIVATE_FILE_HEADERS })
    }
    if (![200, 206].includes(upstream.status) || !upstream.body) throw new Error("Unavailable")
    const size = upstream.headers.get("content-length")
    if (size && (!/^\d+$/.test(size) || Number(size) > maxBytes)) throw new Error("Unavailable")
    const contentRange = upstream.headers.get("content-range")
    if (upstream.status === 206 && (!range || !contentRange || !/^bytes \d+-\d+\/\d+$/.test(contentRange))) throw new Error("Unavailable")
    if (!await revalidate()) throw new Error("Unavailable")
    await assertPrivateOrganizationReadWindow(orgId)
    const headers = new Headers(PRIVATE_FILE_HEADERS)
    headers.set("Content-Type", mime)
    headers.set("Content-Disposition", disposition(name, mime, download))
    if (size) headers.set("Content-Length", size)
    if (upstream.status === 206) headers.set("Content-Range", contentRange!)
    headers.set("Accept-Ranges", "bytes")
    let received = 0
    const bounded = upstream.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        received += chunk.byteLength
        if (received > maxBytes) throw new Error("File exceeds the download limit.")
        controller.enqueue(chunk)
      },
      flush() {
        if (size && received !== Number(size)) throw new Error("File response is incomplete.")
      },
    }))
    return new Response(bounded, { status: upstream.status, headers })
  } catch {
    await upstream?.body?.cancel().catch(() => undefined)
    return Response.json({ error: "This file is no longer available." }, { status: 404, headers: PRIVATE_FILE_HEADERS })
  }
}
