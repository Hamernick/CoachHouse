import { searchSupportOrganizations } from "./actions"

export async function handleWorkspaceSupportSearchPost(request: Request) {
  const respond = (body: unknown, status = 200) => Response.json(body, {
    status, headers: { "Cache-Control": "no-store" },
  })
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return respond({ error: "Invalid request origin." }, 403)
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return respond({ error: "Expected JSON." }, 415)
  }
  try {
    const body = await request.text()
    if (body.length > 1000) return respond({ error: "Search request is too large." }, 413)
    const input = JSON.parse(body)
    if (typeof input?.query !== "string" || !Number.isSafeInteger(input.offset)
      || input.offset < 0 || input.offset > 100000) {
      return respond({ error: "Invalid search request." }, 400)
    }
    // Reuse authenticated search and its live support-grant-enforcing RPC.
    return respond(await searchSupportOrganizations(input.query, input.offset))
  } catch {
    return respond({ error: "Search unavailable. Try again." }, 400)
  }
}

export { handleWorkspaceSupportPresencePost } from "./server/presence-route"
