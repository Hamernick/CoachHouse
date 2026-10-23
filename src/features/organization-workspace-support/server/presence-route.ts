import { syncWorkspaceSupportPresence, leaveWorkspaceSupportPresence } from "./actions"

export async function handleWorkspaceSupportPresencePost(request: Request) {
  const respond = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } })
  if (request.headers.get("origin") !== new URL(request.url).origin) return respond({ error: "Invalid request origin." }, 403)
  if (!request.headers.get("content-type")?.startsWith("application/json")) return respond({ error: "Expected JSON." }, 415)
  try {
    const text = await request.text()
    if (text.length > 2000) return respond({ error: "Request too large." }, 413)
    const input = JSON.parse(text)
    if (!/^[0-9a-f-]{36}$/i.test(input?.organizationId) || !/^[0-9a-f-]{36}$/i.test(input?.sessionId)
      || typeof input.path !== "string" || input.path.length > 200 || !input.path.startsWith("/") || typeof input.editing !== "boolean"
      || (input.position !== null && (!Number.isFinite(input.position?.x) || !Number.isFinite(input.position?.y)
        || input.position.x < 0 || input.position.x > 1 || input.position.y < 0 || input.position.y > 1))) {
      return respond({ error: "Invalid presence request." }, 400)
    }
    if (input.leave === true) { await leaveWorkspaceSupportPresence(input.organizationId, input.sessionId); return respond({ participants: [] }) }
    return respond(await syncWorkspaceSupportPresence(input))
  } catch { return respond({ error: "Live presence is temporarily unavailable." }, 503) }
}
