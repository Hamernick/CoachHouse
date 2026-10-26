import type { NextRequest } from "next/server"
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"
import { companionOAuthMetadata, companionResourceMetadata, getCompanionLiveConfig } from "./config"
import { authenticateCompanionConnection, handleCompanionOAuth } from "./oauth-broker"
import { createLiveCompanionMcp } from "./mcp"

const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow" }

function unavailable(error: unknown) {
  const status = (error as { status?: number }).status === 404 ? 404 : 503
  return Response.json({ error: "Coach House connection is unavailable." }, { status, headers })
}

export function handleCompanionResourceMetadata() {
  try { return Response.json(companionResourceMetadata(), { headers }) }
  catch (error) { return unavailable(error) }
}

export function handleCompanionOAuthMetadata() {
  try { return Response.json(companionOAuthMetadata(), { headers }) }
  catch (error) { return unavailable(error) }
}

export async function handleCompanionOAuthRoute(request: NextRequest, context: { params: Promise<{ endpoint: string }> }) {
  const { endpoint } = await context.params
  if (!["authorize", "callback", "token", "revoke"].includes(endpoint)) return new Response(null, { status: 404, headers })
  return handleCompanionOAuth(request, endpoint as "authorize" | "callback" | "token" | "revoke")
}

async function readRpc(request: Request) {
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
    throw Object.assign(new Error("JSON required"), { status: 415 })
  }
  const reader = request.body?.getReader()
  if (!reader) throw Object.assign(new Error("JSON required"), { status: 400 })
  const chunks: Uint8Array[] = []
  let size = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > 65536) { await reader.cancel(); throw Object.assign(new Error("Body too large"), { status: 413 }) }
    chunks.push(value)
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")) }
  catch { throw Object.assign(new Error("Invalid JSON"), { status: 400 }) }
}

export async function handleLiveCompanionMcp(request: NextRequest) {
  let config: ReturnType<typeof getCompanionLiveConfig>
  try { config = getCompanionLiveConfig() }
  catch (error) { return unavailable(error) }
  const incoming = new URL(request.url)
  const origin = request.headers.get("origin")
  if (incoming.origin !== config.publicOrigin || (origin && ![config.publicOrigin, "https://chatgpt.com"].includes(origin))) {
    return new Response("Origin denied", { status: 403, headers })
  }
  const challenge = `Bearer resource_metadata="${config.publicOrigin}/.well-known/oauth-protected-resource"`
  let principal: Awaited<ReturnType<typeof authenticateCompanionConnection>>
  try { principal = await authenticateCompanionConnection(request) }
  catch {
    return new Response("Connect your Coach House account to continue.", {
      status: 401, headers: { ...headers, "WWW-Authenticate": challenge },
    })
  }
  if (request.method !== "POST") return new Response("Use stateless MCP POST", { status: 405, headers: { ...headers, Allow: "POST" } })
  let body: unknown
  try { body = await readRpc(request) }
  catch (error) {
    return Response.json({ error: "Invalid MCP request." }, { status: (error as { status: number }).status, headers })
  }
  const server = await createLiveCompanionMcp(principal)
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
  try {
    await server.connect(transport)
    let response = await transport.handleRequest(request, { parsedBody: body })
    // SDK 1.x serializes extension auth declarations only in _meta. Publish
    // the canonical OpenAI descriptor too, preserving the compatibility mirror.
    if (response.ok && (body as { method?: unknown })?.method === "tools/list") {
      const result = await response.clone().json() as { result?: { tools?: Array<Record<string, unknown>> } }
      for (const tool of result.result?.tools ?? []) {
        const schemes = (tool._meta as { securitySchemes?: unknown } | undefined)?.securitySchemes
        if (Array.isArray(schemes)) tool.securitySchemes = schemes
      }
      response = Response.json(result, { status: response.status, headers: response.headers })
    }
    for (const [key, value] of Object.entries(headers)) response.headers.set(key, value)
    return response
  } catch {
    return Response.json({ error: "Coach House is unavailable. Check saved progress before retrying a change." }, { status: 503, headers })
  } finally { await transport.close(); await server.close() }
}
