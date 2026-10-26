import { link, readFile, rm, writeFile, mkdir } from "node:fs/promises"
import { createHash, randomBytes } from "node:crypto"
import path from "node:path"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import type { CompanionPrincipal, CompanionToolArguments, CompanionToolName } from "../types"
import { createCompanionSession, executeCompanionTool, revokeCompanionSession } from "./actions"
import { assertCompanionEnabled, companionDirectory, companionRequestOrigin, COMPANION_COOKIE, decodePrincipal, encodePrincipal, hasMcpSandboxToken } from "./auth"
import { createCompanionMcp } from "./mcp"
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"

const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" }

function errorResponse(error: unknown) {
  const value = error as { status?: number; code?: string; message?: string }
  return NextResponse.json({ error: value.message ?? "Companion request failed", code: value.code ?? "UNAVAILABLE" },
    { status: value.status ?? 503, headers })
}

async function readBody(request: Request) {
  const reader = request.body?.getReader()
  if (!reader) throw Object.assign(new Error("A JSON request body is required"), { status: 400 })
  let size = 0
  const chunks: Uint8Array[] = []
  while (true) {
    const result = await reader.read()
    if (result.done) break
    size += result.value.length
    if (size > 65536) { await reader.cancel(); throw Object.assign(new Error("Request is too large"), { status: 413 }) }
    chunks.push(result.value)
  }
  try { return JSON.parse(Buffer.concat(chunks).toString()) }
  catch { throw Object.assign(new Error("Request must contain valid JSON"), { status: 400 }) }
}

export async function handleCompanionSandbox(request: NextRequest) {
  try {
    assertCompanionEnabled(request)
    const origin = request.headers.get("origin")
    if (request.method !== "GET" && origin !== companionRequestOrigin(request).origin) {
      return NextResponse.json({ error: "Use the Companion page to change this sandbox" }, { status: 403, headers })
    }
    const cookie = request.cookies.get(COMPANION_COOKIE)?.value
    let principal = cookie ? await decodePrincipal(cookie) : null
    let newCookie: string | null = null
    if (request.method === "DELETE") {
      if (principal) {
        try { await revokeCompanionSession(principal) }
        catch (error) { if (![401, 404].includes((error as { status?: number }).status ?? 0)) throw error }
      }
      const response = NextResponse.json({ message: "Sandbox session disconnected" }, { headers })
      response.cookies.set(COMPANION_COOKIE, "", { httpOnly: true, sameSite: "strict", path: "/", maxAge: 0 })
      return response
    }
    if (!principal) {
      if (cookie || request.method !== "GET") return NextResponse.json({ error: "Sandbox session expired. Start a new session." }, { status: 401, headers })
      const created = await createCompanionSession()
      principal = created.principal
      newCookie = await encodePrincipal(principal)
    }
    const body = request.method === "GET" ? { name: "companion_get_session", arguments: { organizationId: principal.organizationId } } : await readBody(request)
    if (!body || typeof body !== "object" || typeof body.name !== "string") {
      return NextResponse.json({ error: "A tool name and arguments are required" }, { status: 400, headers })
    }
    const result = await executeCompanionTool(principal, body.name as CompanionToolName, body.arguments as CompanionToolArguments)
    const response = NextResponse.json(result, { headers })
    if (newCookie) response.cookies.set(COMPANION_COOKIE, newCookie, { httpOnly: true, sameSite: "strict", path: "/", secure: new URL(request.url).protocol === "https:", maxAge: 86400 })
    return response
  } catch (error) { return errorResponse(error) }
}

async function mcpPrincipal(): Promise<CompanionPrincipal> {
  const directory = companionDirectory()
  await mkdir(directory, { recursive: true, mode: 0o700 })
  // Rotating the operator credential deliberately creates a new sandbox grant.
  // A revoked grant is never silently renewed under its original credential.
  const identity = createHash("sha256").update(process.env.COMPANION_SANDBOX_TOKEN ?? "").digest("hex").slice(0, 24)
  const file = path.join(directory, `mcp-principal-${identity}.json`)
  try { return JSON.parse(await readFile(file, "utf8")) }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error }
  const { principal } = await createCompanionSession()
  const temporary = `${file}.${randomBytes(12).toString("hex")}`
  await writeFile(temporary, JSON.stringify(principal), { flag: "wx", mode: 0o600 })
  try { await link(temporary, file); return principal }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error
    return JSON.parse(await readFile(file, "utf8"))
  }
  finally { await rm(temporary, { force: true }) }
}

export async function handleCompanionMcp(request: NextRequest) {
  if (process.env.COMPANION_LIVE_ENABLED === "1") {
    const { handleLiveCompanionMcp } = await import("./live/http")
    return handleLiveCompanionMcp(request)
  }
  try {
    assertCompanionEnabled(request)
    if (!hasMcpSandboxToken(request)) return new Response("Sandbox bearer credential required. Coach House account OAuth is not configured.",
      { status: 401, headers: { ...headers, "WWW-Authenticate": 'Bearer realm="coach-house-companion-sandbox"' } })
    const origin = request.headers.get("origin")
    if (origin && origin !== companionRequestOrigin(request).origin) return new Response("Origin denied", { status: 403, headers })
    if (request.method !== "POST") return new Response("Use stateless MCP POST", { status: 405, headers: { ...headers, Allow: "POST" } })
    const body = await readBody(request)
    const principal = await mcpPrincipal()
    // Readback reauthorizes even discovery/resource calls after expiry or revocation.
    await executeCompanionTool(principal, "companion_get_session", { organizationId: principal.organizationId })
    const server = await createCompanionMcp(principal)
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
    await server.connect(transport)
    try {
      const response = await transport.handleRequest(request, { parsedBody: body })
      for (const [key, value] of Object.entries(headers)) response.headers.set(key, value)
      return response
    } finally { await transport.close(); await server.close() }
  } catch (error) { return errorResponse(error) }
}
