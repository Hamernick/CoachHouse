import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { companionOAuthMetadata, companionResourceMetadata, getCompanionLiveConfig } from "@/features/coach-house-companion/server/live/config"
import { handleCompanionResourceMetadata, handleLiveCompanionMcp } from "@/features/coach-house-companion/server/live/http"

const auth = vi.hoisted(() => ({ authenticate: vi.fn() }))
vi.mock("@/features/coach-house-companion/server/live/oauth-broker", () => ({
  authenticateCompanionConnection: auth.authenticate,
  handleCompanionOAuth: vi.fn(),
}))
vi.mock("@/features/coach-house-companion/server/live/mcp", async () => {
  const { McpServer } = await import("@modelcontextprotocol/sdk/server/mcp.js")
  return { createLiveCompanionMcp: async () => {
    const server = new McpServer({ name: "connected-http-test", version: "1" })
    server.registerTool("read_test", { description: "Read protocol fixture", inputSchema: {}, _meta: { securitySchemes: [{ type: "oauth2", scopes: ["accelerator:read"] }] } }, async () => ({ content: [{ type: "text" as const, text: "verified fixture" }] }))
    return server
  } }
})

const origin = "https://companion.example.org"
beforeEach(() => {
  for (const [name, value] of Object.entries({
    COMPANION_LIVE_ENABLED: "1", COMPANION_SANDBOX_ENABLED: "0", COMPANION_ALLOWED_USER_IDS: "87654321-1234-4234-8234-123456789abc", COMPANION_PUBLIC_ORIGIN: origin,
    NEXT_PUBLIC_SUPABASE_URL: "https://project.example.org", NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-test-key",
    COMPANION_OAUTH_CLIENT_ID: "11111111-1111-4111-8111-111111111111", COMPANION_SUPABASE_CLIENT_SECRET: "private-upstream-test-secret",
    COMPANION_CHATGPT_CLIENT_ID: "coach-house-chatgpt-test", COMPANION_CHATGPT_REDIRECT_URI: "https://chatgpt.com/connector/oauth/test-callback",
    COMPANION_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
  })) vi.stubEnv(name, value)
  auth.authenticate.mockReset().mockResolvedValue({ userId: "verified-user", clientId: "verified-client", scopes: ["accelerator:read", "accelerator:write"] })
})
afterEach(() => { vi.unstubAllEnvs() })

function request(options: { body?: string; method?: string; origin?: string; base?: string; type?: string } = {}) {
  const method = options.method ?? "POST"
  return new NextRequest(`${options.base ?? origin}/api/companion/mcp`, {
    method,
    headers: { "content-type": options.type ?? "application/json", accept: "application/json, text/event-stream", ...(options.origin ? { origin: options.origin } : {}) },
    ...(method === "POST" ? { body: options.body ?? JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "test", version: "1" } } }) } : {}),
  })
}

describe("connected Companion configuration and discovery", () => {
  it("publishes only canonical broker discovery, supported scopes and S256", async () => {
    const metadata = companionOAuthMetadata()
    expect(metadata.issuer).toBe(origin)
    expect(metadata.code_challenge_methods_supported).toEqual(["S256"])
    expect(metadata.token_endpoint_auth_methods_supported).toEqual(["none"])
    expect(metadata.authorization_response_iss_parameter_supported).toBe(true)
    expect(companionResourceMetadata()).toMatchObject({ resource: `${origin}/api/companion/mcp`, authorization_servers: [origin] })
    const response = handleCompanionResourceMetadata()
    expect(response.headers.get("cache-control")).toBe("no-store")
    const text = await response.text()
    expect(text).not.toContain("private-upstream-test-secret")
    expect(text).not.toContain("project.example.org")
  })
  it("normalizes the explicit UUID pilot list without publishing account IDs", async () => {
    const user = "87654321-1234-4234-8234-123456789ABC"
    vi.stubEnv("COMPANION_ALLOWED_USER_IDS", ` ${user} , 11111111-1111-4111-8111-111111111111, ${user.toLowerCase()} `)
    expect(getCompanionLiveConfig().allowedUserIds).toEqual([user.toLowerCase(), "11111111-1111-4111-8111-111111111111"])
    expect(await handleCompanionResourceMetadata().text()).not.toContain(user.toLowerCase())
  })
  it("does not require pilot configuration while connected mode is disabled", () => {
    vi.stubEnv("COMPANION_LIVE_ENABLED", "0")
    vi.stubEnv("COMPANION_ALLOWED_USER_IDS", "")
    expect(handleCompanionResourceMetadata().status).toBe(404)
  })
  it.each([
    ["COMPANION_LIVE_ENABLED", "0"], ["COMPANION_SANDBOX_ENABLED", "1"],
    ["COMPANION_PUBLIC_ORIGIN", "http://companion.example.org"], ["COMPANION_PUBLIC_ORIGIN", `${origin}/other`],
    ["COMPANION_PUBLIC_ORIGIN", "https://user:password@companion.example.org"],
    ["COMPANION_OAUTH_CLIENT_ID", "wrong-client"], ["COMPANION_SUPABASE_CLIENT_SECRET", ""],
    ["COMPANION_TOKEN_ENCRYPTION_KEY", "invalid-key"],
    ["COMPANION_ALLOWED_USER_IDS", ""], ["COMPANION_ALLOWED_USER_IDS", "not-a-uuid"],
    ["COMPANION_ALLOWED_USER_IDS", "87654321-1234-4234-8234-123456789abc,"],
    ["COMPANION_CHATGPT_REDIRECT_URI", "https://chatgpt.com.attacker.example/connector/oauth/test"],
    ["COMPANION_CHATGPT_REDIRECT_URI", "https://chatgpt.com/connector/oauth/*"],
  ])("fails closed for invalid %s", (name, value) => {
    vi.stubEnv(name, value)
    expect(() => getCompanionLiveConfig()).toThrow()
    expect(handleCompanionResourceMetadata().status).toBe(name === "COMPANION_LIVE_ENABLED" ? 404 : 503)
  })
})

describe("connected MCP HTTP boundary", () => {
  it("challenges invalid/revoked credentials with resource discovery", async () => {
    auth.authenticate.mockRejectedValue(new Error("private token must never be returned"))
    const response = await handleLiveCompanionMcp(request())
    expect(response.status).toBe(401)
    expect(response.headers.get("www-authenticate")).toContain(`${origin}/.well-known/oauth-protected-resource`)
    expect(await response.text()).not.toContain("private token")
  })
  it("initializes the real stateless MCP transport after connection authentication", async () => {
    const response = await handleLiveCompanionMcp(request())
    expect(response.status).toBe(200)
    expect(auth.authenticate).toHaveBeenCalledOnce()
    expect(await response.json()).toMatchObject({ result: { serverInfo: { name: "connected-http-test" } } })
    expect(response.headers.get("cache-control")).toBe("no-store")
  })
  it("publishes canonical OAuth tool declarations alongside the SDK compatibility mirror", async () => {
    const response = await handleLiveCompanionMcp(request({ body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }) }))
    expect(response.status).toBe(200)
    const value = await response.json()
    expect(value.result.tools[0].securitySchemes).toEqual([{ type: "oauth2", scopes: ["accelerator:read"] }])
    expect(value.result.tools[0]._meta.securitySchemes).toEqual(value.result.tools[0].securitySchemes)
  })
  it.each([{ origin: "https://attacker.example" }, { base: "https://attacker.example" }])("rejects an untrusted request origin before authentication", async options => {
    expect((await handleLiveCompanionMcp(request(options))).status).toBe(403)
    expect(auth.authenticate).not.toHaveBeenCalled()
  })
  it.each([origin, "https://chatgpt.com"])("allows the configured host origin %s", async allowed => {
    expect((await handleLiveCompanionMcp(request({ origin: allowed }))).status).toBe(200)
  })
  it.each([
    [{ body: "{" }, 400], [{ body: "x".repeat(65537) }, 413], [{ type: "text/plain" }, 415], [{ method: "GET" }, 405],
  ] as const)("rejects malformed, oversized or unsupported authenticated requests", async (options, status) => {
    expect((await handleLiveCompanionMcp(request(options))).status).toBe(status)
  })
})
