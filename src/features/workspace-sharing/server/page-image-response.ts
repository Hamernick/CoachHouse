import "server-only"

export const IMAGE_RESPONSE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Referrer-Policy": "no-referrer",
  Vary: "Cookie",
}
export function imageUnavailable(status = 404) {
  return new Response(null, { status, headers: IMAGE_RESPONSE_HEADERS })
}
export function imageResponse(bytes: Uint8Array) {
  return new Response(new Uint8Array(bytes), { headers: {
    ...IMAGE_RESPONSE_HEADERS, "Content-Type": "image/webp",
    "Content-Disposition": 'inline; filename="image.webp"', "Content-Length": String(bytes.length),
  } })
}
