import "server-only"

export const DOCUMENT_RESPONSE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Referrer-Policy": "no-referrer",
  Vary: "Cookie",
  "Content-Security-Policy": "sandbox; default-src 'none'; frame-ancestors 'none'",
}
export function documentUnavailable(status = 404) {
  return new Response(null, { status, headers: DOCUMENT_RESPONSE_HEADERS })
}
export function documentResponse(bytes: Uint8Array) {
  return new Response(new Uint8Array(bytes), { headers: {
    ...DOCUMENT_RESPONSE_HEADERS, "Content-Type": "text/plain; charset=utf-8",
    "Content-Disposition": 'inline; filename="document.txt"', "Content-Length": String(bytes.length),
  } })
}
