import { mkdtemp, readFile, rm } from "node:fs/promises"
import { createHash } from "node:crypto"
import { tmpdir } from "node:os"
import path from "node:path"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import { RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server"
import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { revokeCompanionSession } from "@/features/coach-house-companion/server/actions"
import { COMPANION_COOKIE, decodePrincipal } from "@/features/coach-house-companion/server/auth"
import { handleCompanionMcp, handleCompanionSandbox } from "@/features/coach-house-companion/server/http"
import { COMPANION_RESOURCE } from "@/features/coach-house-companion/server/mcp"
import type { CompanionPrincipal, CompanionToolResult } from "@/features/coach-house-companion/types"

// Resource transport is real; only the generated UI bundle is replaced. This is
// protocol evidence, not browser rendering or ChatGPT host acceptance.
vi.mock("@/features/coach-house-companion/server/widget", () => ({
  getCompanionWidgetHtml: vi.fn(async () => "<main>Companion protocol fixture</main>"),
}))

const origin = "http://localhost:3150"
const bearer = "test-only-companion-credential-with-more-than-32-characters"
let directory: string
let clients: Client[]

beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "companion-http-test-"))
  clients = []
  vi.stubEnv("COMPANION_SANDBOX_DIR", directory)
  vi.stubEnv("COMPANION_SANDBOX_ENABLED", "1")
  vi.stubEnv("COMPANION_SANDBOX_TOKEN", bearer)
  vi.stubEnv("COMPANION_PUBLIC_ORIGIN", "")
})

afterEach(async () => {
  await Promise.all(clients.map((client) => client.close()))
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  await rm(directory, { recursive: true, force: true })
})

function sandbox(method = "GET", options: { cookie?: string; body?: string; origin?: string | null; base?: string } = {}) {
  const headers = new Headers()
  if (options.cookie) headers.set("cookie", options.cookie)
  if (options.origin !== null) headers.set("origin", options.origin ?? origin)
  if (options.body !== undefined) headers.set("content-type", "application/json")
  return handleCompanionSandbox(new NextRequest(`${options.base ?? origin}/api/companion/sandbox`, {
    method, headers, ...(options.body !== undefined ? { body: options.body } : {}),
  }))
}

async function session() {
  const response = await sandbox()
  expect(response.status).toBe(200)
  const cookie = response.headers.get("set-cookie")!.split(";")[0]
  const result = await response.json() as CompanionToolResult
  return { cookie, result, response }
}

function rpc(method: string, params: Record<string, unknown> = {}, options: { token?: string | null; origin?: string; body?: string; httpMethod?: string } = {}) {
  const headers = new Headers({ "content-type": "application/json", accept: "application/json, text/event-stream", "mcp-protocol-version": "2025-03-26" })
  if (options.token !== null) headers.set("authorization", `Bearer ${options.token ?? bearer}`)
  if (options.origin) headers.set("origin", options.origin)
  const httpMethod = options.httpMethod ?? "POST"
  return handleCompanionMcp(new NextRequest(`${origin}/api/companion/mcp`, {
    method: httpMethod, headers,
    ...(httpMethod === "POST" ? { body: options.body ?? JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) } : {}),
  }))
}

async function connectClient() {
  const client = new Client({ name: "companion-acceptance", version: "1.0.0" })
  clients.push(client)
  const transport = new StreamableHTTPClientTransport(new URL(`${origin}/api/companion/mcp`), {
    requestInit: { headers: { authorization: `Bearer ${bearer}` } },
    fetch: async (input, init) => handleCompanionMcp(new NextRequest(input instanceof Request ? input : input.toString(), {
      ...init, signal: init?.signal ?? undefined,
    })),
  })
  await client.connect(transport)
  return client
}

describe("Companion browser HTTP sessions", () => {
  it("publishes a complete signing key under concurrent first sessions", async () => {
    const sessions = await Promise.all(Array.from({ length: 12 }, () => session()))
    for (const value of sessions) {
      const principal = await decodePrincipal(value.cookie.slice(COMPANION_COOKIE.length + 1))
      expect(principal?.organizationId).toBe(value.result.snapshot.organization.id)
    }
    expect((await readFile(path.join(directory, "cookie-key"))).length).toBe(32)
  })

  it("accepts the actual loopback Host when Next uses an internal localhost URL", async () => {
    const first = await session()
    const response = await handleCompanionSandbox(new NextRequest(`${origin}/api/companion/sandbox`, {
      method: "POST", headers: { host: "127.0.0.1:3150", origin: "http://127.0.0.1:3150", cookie: first.cookie, "content-type": "application/json" },
      body: JSON.stringify({ name: "companion_get_session", arguments: { organizationId: first.result.snapshot.organization.id } }),
    }))
    expect(response.status).toBe(200)
    const denied = await handleCompanionSandbox(new NextRequest(`${origin}/api/companion/sandbox`, { headers: { host: "attacker.example" } }))
    expect(denied.status).toBe(503)
  })

  it("clears an orphaned session cookie so the browser can start again", async () => {
    const first = await session()
    const principal = (await decodePrincipal(first.cookie.slice(COMPANION_COOKIE.length + 1)))!
    await rm(path.join(directory, `${principal.sessionId}.json`))
    expect((await sandbox("DELETE", { cookie: first.cookie })).status).toBe(200)
    expect((await sandbox()).status).toBe(200)
  })
  it("requires explicit environment enablement", async () => {
    vi.stubEnv("COMPANION_SANDBOX_ENABLED", "0")
    expect((await sandbox()).status).toBe(503)
    expect((await rpc("tools/list")).status).toBe(503)
  })

  it("restricts nonlocal hosts unless their exact origin is configured", async () => {
    expect((await sandbox("GET", { base: "https://unapproved.example" })).status).toBe(503)
    vi.stubEnv("COMPANION_PUBLIC_ORIGIN", "https://preview.example")
    const response = await sandbox("GET", { base: "https://preview.example" })
    expect(response.status).toBe(200)
    expect(response.headers.get("set-cookie")).toContain("Secure")
    expect((await sandbox("GET", { base: "https://other.preview.example" })).status).toBe(503)
  })

  it("sets a signed private cookie and resumes the same persisted session", async () => {
    const first = await session()
    const header = first.response.headers.get("set-cookie")!
    expect(header).toContain("HttpOnly")
    expect(header).toContain("SameSite=strict")
    expect(header).toContain("Max-Age=86400")
    const principal = await decodePrincipal(decodeURIComponent(first.cookie.slice(COMPANION_COOKIE.length + 1)))
    expect(principal?.organizationId).toBe(first.result.snapshot.organization.id)
    expect(first.response.headers.get("cache-control")).toBe("no-store")
    const resumed = await sandbox("GET", { cookie: first.cookie })
    expect(resumed.status).toBe(200)
    expect((await resumed.json()).snapshot).toEqual(first.result.snapshot)
    expect(resumed.headers.get("set-cookie")).toBeNull()
  })

  it("rejects a tampered cookie and allows explicit reset to recover", async () => {
    const { cookie } = await session()
    const invalidCookie = `${cookie.slice(0, -2)}xx`
    expect((await sandbox("GET", { cookie: invalidCookie })).status).toBe(401)
    const reset = await sandbox("DELETE", { cookie: invalidCookie })
    expect(reset.status).toBe(200)
    expect(reset.headers.get("set-cookie")).toContain("Max-Age=0")
    expect((await sandbox()).status).toBe(200)
  })

  it("allows an expired cookie to be reset without reviving its session", async () => {
    const { cookie } = await session()
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 25 * 60 * 60 * 1000)
    expect((await sandbox("GET", { cookie })).status).toBe(401)
    expect((await sandbox("DELETE", { cookie })).status).toBe(200)
    expect((await sandbox()).status).toBe(200)
  })

  it.each([null, "https://attacker.example"])("denies mutation Origin %s", async (untrustedOrigin) => {
    const { cookie, result } = await session()
    const body = JSON.stringify({ name: "companion_save_draft", arguments: { organizationId: result.snapshot.organization.id, requestId: "draft-request", expectedRevision: 0, answers: {} } })
    expect((await sandbox("POST", { cookie, body, origin: untrustedOrigin })).status).toBe(403)
    expect((await sandbox("DELETE", { cookie, origin: untrustedOrigin })).status).toBe(403)
  })

  it("requires a valid cookie for writes and rejects a different organization", async () => {
    const { cookie } = await session()
    const body = JSON.stringify({ name: "companion_save_draft", arguments: { organizationId: "other-organization", requestId: "draft-request", expectedRevision: 0, answers: {} } })
    expect((await sandbox("POST", { body })).status).toBe(401)
    const denied = await sandbox("POST", { cookie, body })
    expect(denied.status).toBe(403)
    expect((await denied.json()).code).toBe("forbidden")
  })

  it("persists an HTTP draft and reads it back without submission", async () => {
    const { cookie, result } = await session()
    const field = result.snapshot.lesson.fields[0].name
    const response = await sandbox("POST", { cookie, body: JSON.stringify({
      name: "companion_save_draft", arguments: { organizationId: result.snapshot.organization.id, requestId: "draft-request", expectedRevision: 0, answers: { [field]: "Local families" } },
    }) })
    expect(response.status).toBe(200)
    const readback = await (await sandbox("GET", { cookie })).json()
    expect(readback.snapshot.draft.answers[field]).toBe("Local families")
    expect(readback.snapshot.submission.status).toBe("not_submitted")
  })

  it.each([{ body: "{", status: 400 }, { body: "null", status: 400 }, { body: "x".repeat(65537), status: 413 }])("bounds and validates JSON bodies ($status)", async ({ body, status }) => {
    const { cookie } = await session()
    expect((await sandbox("POST", { cookie, body })).status).toBe(status)
  })

  it("revokes the old cookie on reset and creates an isolated replacement", async () => {
    const first = await session()
    expect((await sandbox("DELETE", { cookie: first.cookie })).status).toBe(200)
    expect((await sandbox("GET", { cookie: first.cookie })).status).toBe(401)
    const next = await session()
    expect(next.result.snapshot.organization.id).not.toBe(first.result.snapshot.organization.id)
    expect(next.result.snapshot.draft.answers).toEqual({})
  })
})

describe("Companion real MCP SDK protocol", () => {
  it.each([null, "wrong-token"])("challenges missing or invalid bearer credentials (%s)", async (token) => {
    const response = await rpc("tools/list", {}, { token })
    expect(response.status).toBe(401)
    expect(response.headers.get("www-authenticate")).toContain("Bearer")
    expect(await response.text()).toContain("OAuth is not configured")
  })

  it("rejects short configured credentials, cross-origin requests, and non-POST methods", async () => {
    vi.stubEnv("COMPANION_SANDBOX_TOKEN", "short")
    expect((await rpc("tools/list", {}, { token: "short" })).status).toBe(401)
    vi.stubEnv("COMPANION_SANDBOX_TOKEN", bearer)
    expect((await rpc("tools/list", {}, { origin: "https://attacker.example" })).status).toBe(403)
    const response = await rpc("tools/list", {}, { httpMethod: "GET" })
    expect(response.status).toBe(405)
    expect(response.headers.get("allow")).toBe("POST")
  })

  it("bounds MCP request bodies before protocol processing", async () => {
    expect((await rpc("tools/list", {}, { body: "{broken" })).status).toBe(400)
    expect((await rpc("tools/list", {}, { body: "x".repeat(65537) })).status).toBe(413)
  })

  it("initializes, discovers tools, bootstraps organization, and persists a real tool write", async () => {
    const client = await connectClient()
    expect(client.getServerVersion()?.name).toBe("coach-house-companion-sandbox")
    const listed = await client.listTools()
    expect(listed.tools).toHaveLength(6)
    expect(listed.tools.find(tool => tool.name === "companion_review_document")?.annotations?.readOnlyHint).toBe(true)
    for (const name of ["companion_save_draft", "companion_save_document", "companion_submit_assignment"]) {
      const metadata = listed.tools.find(tool => tool.name === name)?._meta as { ui?: { resourceUri?: string; visibility?: string[] } }
      expect(metadata.ui?.resourceUri).toBeUndefined()
      expect(metadata.ui?.visibility).toEqual(["model", "app"])
    }
    for (const name of ["companion_get_session", "companion_review_document", "companion_schedule_block"]) {
      expect(listed.tools.find(tool => tool.name === name)?._meta).toMatchObject({ ui: { resourceUri: COMPANION_RESOURCE } })
    }
    expect(listed.tools.map((tool) => tool.name)).toEqual(expect.arrayContaining([
      "companion_get_session", "companion_review_document", "companion_save_draft", "companion_save_document", "companion_submit_assignment", "companion_schedule_block",
    ]))
    const read = await client.callTool({ name: "companion_get_session", arguments: {} })
    const initial = read.structuredContent as CompanionToolResult
    const field = initial.snapshot.lesson.fields[0].name
    const write = await client.callTool({ name: "companion_save_draft", arguments: {
      organizationId: initial.snapshot.organization.id, requestId: "mcp-draft-request", expectedRevision: initial.snapshot.draft.revision, answers: { [field]: "Parents & children" },
    } })
    expect(write.isError).not.toBe(true)
    const readback = await client.callTool({ name: "companion_get_session", arguments: {} })
    expect((readback.structuredContent as CompanionToolResult).snapshot.draft.answers[field]).toBe("Parents & children")
    const browser = await session()
    expect(browser.result.snapshot.organization.id).not.toBe(initial.snapshot.organization.id)
    expect(browser.result.snapshot.draft.answers).toEqual({})
  })

  it("completes one lesson journey through MCP with a read-only review before saving", async () => {
    const client = await connectClient()
    async function call(name: string, args: Record<string, unknown>) {
      const result = await client.callTool({ name, arguments: args })
      expect(result.isError).not.toBe(true)
      return result.structuredContent as CompanionToolResult
    }
    const start = await call("companion_get_session", {})
    const organizationId = start.snapshot.organization.id
    const answers = Object.fromEntries(start.snapshot.lesson.fields.map(field => [field.name, "We connect young people with local mentors and opportunities."]))
    const draft = await call("companion_save_draft", { organizationId, requestId: "journey-draft", expectedRevision: 0, answers })
    expect(draft.snapshot.submission.completed).toBe(false)
    const preview = await call("companion_review_document", { organizationId, content: "Young people build confident futures through local mentoring." })
    expect(preview.snapshot).toEqual(draft.snapshot)
    expect((await call("companion_get_session", {})).snapshot).toEqual(draft.snapshot)
    const proposal = preview.proposal!
    expect(proposal.expectedRevision).toBe(0)
    const saved = await call("companion_save_document", { organizationId, content: proposal.content, expectedRevision: proposal.expectedRevision, requestId: "journey-document", confirmed: true })
    const submitted = await call("companion_submit_assignment", { organizationId, expectedRevision: draft.snapshot.draft.revision, requestId: "journey-submit", confirmed: true })
    expect(submitted.snapshot.submission.completed).toBe(true)
    const scheduled = await call("companion_schedule_block", { organizationId, requestId: "journey-calendar", confirmed: true, title: "Continue my accelerator", startsAt: "2026-10-27T14:00:00Z", endsAt: "2026-10-27T14:25:00Z", timeZone: "America/New_York" })
    const resumed = await call("companion_get_session", {})
    expect(resumed.snapshot.document.content).toBe(saved.snapshot.document.content)
    expect(resumed.snapshot.submission.completed).toBe(true)
    expect(resumed.snapshot.calendar.event?.id).toBe(scheduled.snapshot.calendar.event?.id)
    expect(resumed.snapshot.calendar.event?.status).toBe("export_ready")
  })

  it("returns a tool error for an explicitly wrong organization", async () => {
    const client = await connectClient()
    const result = await client.callTool({ name: "companion_get_session", arguments: { organizationId: "other-organization" } })
    expect(result.isError).toBe(true)
    expect(result.structuredContent).toMatchObject({ code: "forbidden" })
  })

  it("registers the MCP Apps UI resource and serves the expected MIME and CSP", async () => {
    const client = await connectClient()
    const tools = await client.listTools()
    expect(tools.tools.find((tool) => tool.name === "companion_get_session")?._meta).toMatchObject({ ui: { resourceUri: COMPANION_RESOURCE } })
    const resources = await client.listResources()
    expect(resources.resources.some((resource) => resource.uri === COMPANION_RESOURCE)).toBe(true)
    const resource = await client.readResource({ uri: COMPANION_RESOURCE })
    expect(resource.contents[0]).toMatchObject({ uri: COMPANION_RESOURCE, mimeType: RESOURCE_MIME_TYPE, text: "<main>Companion protocol fixture</main>", _meta: { ui: { csp: { connectDomains: [], resourceDomains: [] } } } })
  })

  it.each(["expired", "revoked"] as const)("denies even discovery when the MCP session is %s", async (state) => {
    await connectClient()
    const identity = createHash("sha256").update(bearer).digest("hex").slice(0, 24)
    const principal = JSON.parse(await readFile(path.join(directory, `mcp-principal-${identity}.json`), "utf8")) as CompanionPrincipal
    if (state === "revoked") await revokeCompanionSession(principal)
    else vi.spyOn(Date, "now").mockReturnValue(principal.expiresAt + 1)
    for (const method of ["tools/list", "resources/list"]) {
      const response = await rpc(method)
      expect(response.status).toBe(401)
      expect((await response.json()).code).toBe(state === "revoked" ? "session_revoked" : "session_expired")
    }
  })
})
