import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { authenticateCompanionConnection, handleCompanionOAuth, validateCompanionUpstreamRedirect } from "@/features/coach-house-companion/server/live/oauth-broker"
import { decryptOAuth, encryptOAuth, oauthChallenge, oauthHash } from "@/features/coach-house-companion/server/live/oauth-crypto"
import type { OAuthGrant, OAuthTransaction } from "@/features/coach-house-companion/server/live/oauth-store"

const state = vi.hoisted(() => ({
  store: vi.fn(), rpc: vi.fn(), getUser: vi.fn(), cookie: "", signOut: vi.fn(),
  transactions: new Map<string, OAuthTransaction>(),
  grants: new Map<string, OAuthGrant & { revoked?: boolean }>(),
  codes: new Map<string, { grantId: string; challenge: string; used?: boolean }>(),
  tokens: new Map<string, { grantId: string; kind: string; used?: boolean; expired?: boolean }>(),
}))
vi.mock("@/features/coach-house-companion/server/live/oauth-store", () => ({ oauthStore: (...args: unknown[]) => state.store(...args) }))
vi.mock("@/lib/supabase", () => ({ createSupabaseAdminClient: () => ({
  context: "admin-client",
  rpc(this: { context: string }, ...args: unknown[]) {
    if (this.context !== "admin-client") throw new Error("Lost Supabase client context")
    return state.rpc(...args)
  },
  auth: { admin: { signOut: state.signOut } },
}) }))
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ auth: { getUser: state.getUser } }) }))
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => state.cookie ? { value: state.cookie } : undefined }) }))

const origin = "https://companion.example.org"
const resource = `${origin}/api/companion/mcp`
const callbackUri = `${origin}/api/companion/oauth/callback`
const redirectUri = "https://chatgpt.com/connector/oauth/coach-house-test"
const issuer = "https://project.example.org/auth/v1"
const clientId = "12345678-1234-4234-8234-123456789abc"
const userId = "87654321-1234-4234-8234-123456789abc"
const verifier = "z".repeat(43)
const encryptionKey = Buffer.alloc(32, 13).toString("base64")

function jwt(overrides: Record<string, unknown> = {}) {
  return `header.${Buffer.from(JSON.stringify({ iss: issuer, sub: userId, client_id: clientId,
    role: "authenticated", session_id: "independent-upstream-session", exp: Math.floor(Date.now() / 1000) + 3600, ...overrides })).toString("base64url")}.signature`
}

function authorizeParams(overrides: Record<string, string> = {}) {
  return new URLSearchParams({ response_type: "code", client_id: "coach-house-chatgpt", redirect_uri: redirectUri,
    resource, scope: "accelerator:read accelerator:write", state: "chatgpt-client-state", code_challenge_method: "S256",
    code_challenge: oauthChallenge(verifier), ...overrides })
}

function post(endpoint: "token" | "revoke", values: Record<string, string>) {
  return handleCompanionOAuth(new NextRequest(`${origin}/api/companion/oauth/${endpoint}`, {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(values),
  }), endpoint)
}

async function start() {
  const response = await handleCompanionOAuth(new NextRequest(`${origin}/api/companion/oauth/authorize?${authorizeParams()}`), "authorize")
  expect(response.status).toBe(302)
  const url = new URL(response.headers.get("location")!)
  const cookie = response.headers.get("set-cookie")!.split(";")[0]
  state.cookie = cookie.slice(cookie.indexOf("=") + 1)
  return { state: url.searchParams.get("state")!, cookie, url }
}

async function approvedCode() {
  const pending = await start()
  const response = await handleCompanionOAuth(new NextRequest(`${callbackUri}?code=upstream-code&state=${pending.state}`, {
    headers: { cookie: pending.cookie },
  }), "callback")
  expect(response.status).toBe(302)
  const redirect = new URL(response.headers.get("location")!)
  expect(redirect.origin + redirect.pathname).toBe(redirectUri)
  expect(redirect.searchParams.get("state")).toBe("chatgpt-client-state")
  expect(redirect.searchParams.get("iss")).toBe(origin)
  return redirect.searchParams.get("code")!
}

async function credentials() {
  const code = await approvedCode()
  const response = await post("token", { grant_type: "authorization_code", client_id: "coach-house-chatgpt",
    redirect_uri: redirectUri, resource, code, code_verifier: verifier })
  expect(response.status).toBe(200)
  return { code, ...await response.json() as { access_token: string; refresh_token: string } }
}

function mcpRequest(token: string) {
  return new NextRequest(resource, { headers: { authorization: `Bearer ${token}` } })
}

beforeEach(() => {
  state.transactions.clear(); state.grants.clear(); state.codes.clear(); state.tokens.clear(); state.cookie = ""
  state.getUser.mockReset().mockResolvedValue({ data: { user: { id: userId } }, error: null })
  state.signOut.mockReset().mockResolvedValue({ error: null })
  state.rpc.mockReset().mockResolvedValue({ data: { ok: true }, error: null })
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ access_token: jwt(), refresh_token: "upstream-secret-refresh" })))
  for (const [name, value] of Object.entries({ COMPANION_LIVE_ENABLED: "1", COMPANION_SANDBOX_ENABLED: "0", COMPANION_ALLOWED_USER_IDS: userId,
    COMPANION_PUBLIC_ORIGIN: origin, NEXT_PUBLIC_SUPABASE_URL: "https://project.example.org",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-test-key", COMPANION_OAUTH_CLIENT_ID: clientId,
    COMPANION_TOKEN_ENCRYPTION_KEY: encryptionKey, COMPANION_SUPABASE_CLIENT_SECRET: "server-client-secret",
    COMPANION_CHATGPT_CLIENT_ID: "coach-house-chatgpt", COMPANION_CHATGPT_REDIRECT_URI: redirectUri })) vi.stubEnv(name, value)
  // This fake exercises orchestration and secret boundaries. Atomic SQL/RLS is
  // a separate database gate; these tests do not claim provider interoperability.
  state.store.mockReset().mockImplementation(async (action: string, key: string, payload: Record<string, unknown> = {}) => {
    if (action === "create_transaction") { state.transactions.set(key, payload.request as OAuthTransaction); return { ok: true } }
    if (action === "read_transaction") return state.transactions.get(key) ?? null
    if (action === "consume_transaction") { const result = state.transactions.get(key) ?? null; state.transactions.delete(key); return result }
    if (action === "create_grant") {
      const grant = { id: "connection-id", userId: payload.userId, clientId: payload.clientId,
        resource: payload.resource, scopes: payload.scopes, upstream: payload.upstream, rotation: 0 } as OAuthGrant
      state.grants.set(grant.id, grant); state.codes.set(key, { grantId: grant.id, challenge: payload.challenge as string }); return grant
    }
    let grant: (OAuthGrant & { revoked?: boolean }) | undefined
    if (action === "exchange_code") {
      const code = state.codes.get(key)
      if (!code) return null
      grant = state.grants.get(code.grantId)!
      if (code.used) { grant.revoked = true; throw { code: "invalid_grant", status: 400 } }
      if (code.challenge !== payload.challenge || grant.clientId !== payload.clientId || grant.resource !== payload.resource) return null
      code.used = true
    } else if (action === "save_upstream") {
      grant = state.grants.get(key)
      if (!grant || grant.revoked || grant.rotation !== payload.rotation) return null
      grant.upstream = payload.upstream as string; return grant
    } else {
      const token = state.tokens.get(key)
      if (!token) return null
      grant = state.grants.get(token.grantId)!
      if (action === "revoke") { grant.revoked = true; return grant }
      if (action === "rotate_refresh" && token.used) { grant.revoked = true; throw { code: "invalid_grant", status: 400 } }
      if (grant.revoked || token.expired || (action === "access" && token.kind !== "access")) return null
      if (action === "access") return grant
      token.used = true; grant.rotation++
    }
    if (!grant || grant.revoked) return null
    state.tokens.set(payload.accessHash as string, { grantId: grant.id, kind: "access" })
    state.tokens.set(payload.refreshHash as string, { grantId: grant.id, kind: "refresh" })
    return { ...grant }
  })
})

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe("Companion OAuth broker", () => {
  it("preserves the Supabase client binding in the real store adapter", async () => {
    const actual = await vi.importActual<typeof import("@/features/coach-house-companion/server/live/oauth-store")>("@/features/coach-house-companion/server/live/oauth-store")
    expect(await actual.oauthStore("create_transaction", "test-key", {})).toEqual({ ok: true })
    expect(state.rpc).toHaveBeenCalledWith("companion_oauth_store", { p_action: "create_transaction", p_key: "test-key", p_payload: {} })
  })

  it("completes authorize, separate upstream callback, opaque credentials, MCP, refresh and revoke", async () => {
    const tokens = await credentials()
    expect(tokens.access_token).toMatch(/^chc_at_/)
    expect(tokens.refresh_token).toMatch(/^chc_rt_/)
    expect(JSON.stringify(tokens)).not.toContain("upstream-secret")
    expect(JSON.stringify(tokens)).not.toContain("server-client-secret")
    expect([...state.grants.values()][0].upstream).not.toContain("upstream-secret-refresh")
    const identity = await authenticateCompanionConnection(mcpRequest(tokens.access_token))
    expect(identity).toMatchObject({ userId, clientId, scopes: ["accelerator:read", "accelerator:write"] })
    const refreshed = await post("token", { grant_type: "refresh_token", client_id: "coach-house-chatgpt", resource, refresh_token: tokens.refresh_token })
    expect(refreshed.status).toBe(200)
    const next = await refreshed.json()
    expect(next.refresh_token).not.toBe(tokens.refresh_token)
    expect((await post("revoke", { client_id: "coach-house-chatgpt", token: next.access_token })).status).toBe(200)
    await expect(authenticateCompanionConnection(mcpRequest(next.access_token))).rejects.toMatchObject({ code: "invalid_token" })
    expect(state.signOut).toHaveBeenCalledWith(expect.any(String), "local")
    const upstreamRequest = vi.mocked(fetch).mock.calls[0][1]!
    expect((upstreamRequest.body as URLSearchParams).get("code_verifier")).not.toBe(verifier)
    expect((upstreamRequest.body as URLSearchParams).get("redirect_uri")).toBe(callbackUri)
  })

  it.each([
    { client_id: "different-client" }, { redirect_uri: "https://evil.example/callback" },
    { resource: "https://other.example/mcp" }, { code_challenge_method: "plain" },
    { scope: "accelerator:read billing:write" }, { state: "" },
  ] as Record<string, string>[])("rejects invalid authorization before persisting: %j", async overrides => {
    const response = await handleCompanionOAuth(new NextRequest(`${origin}/api/companion/oauth/authorize?${authorizeParams(overrides)}`), "authorize")
    expect(response.status).toBeGreaterThanOrEqual(400)
    expect(state.store).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })

  it("rejects duplicate OAuth parameters", async () => {
    const params = authorizeParams(); params.append("resource", resource)
    const response = await handleCompanionOAuth(new NextRequest(`${origin}/api/companion/oauth/authorize?${params}`), "authorize")
    expect(response.status).toBe(400)
    expect(state.store).not.toHaveBeenCalled()
  })

  it("rejects a forged request origin and duplicate form parameters", async () => {
    const response = await handleCompanionOAuth(new NextRequest(`https://evil.example/api/companion/oauth/authorize?${authorizeParams()}`), "authorize")
    expect(response.status).toBe(403)
    expect(state.store).not.toHaveBeenCalled()
    const body = new URLSearchParams({ client_id: "coach-house-chatgpt", resource, grant_type: "refresh_token" })
    body.append("client_id", "attacker")
    expect((await handleCompanionOAuth(new NextRequest(`${origin}/api/companion/oauth/token`, {
      method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body,
    }), "token")).status).toBe(400)
    expect(state.store).not.toHaveBeenCalled()
  })

  it("binds callback state to the initiating browser and consumes it once", async () => {
    const pending = await start()
    const url = `${callbackUri}?code=upstream-code&state=${pending.state}`
    expect((await handleCompanionOAuth(new NextRequest(url), "callback")).status).toBe(400)
    expect(fetch).not.toHaveBeenCalled()
    expect(await validateCompanionUpstreamRedirect(url)).toBe(true)
    state.cookie = "other-browser"
    expect(await validateCompanionUpstreamRedirect(url)).toBe(false)
    state.cookie = pending.cookie.split("=")[1]
    expect(await validateCompanionUpstreamRedirect(url.replace(origin, "https://evil.example"))).toBe(false)
    expect((await handleCompanionOAuth(new NextRequest(url, { headers: { cookie: pending.cookie } }), "callback")).status).toBe(302)
    expect((await handleCompanionOAuth(new NextRequest(url, { headers: { cookie: pending.cookie } }), "callback")).status).toBe(400)
  })

  it("does not consume the authorization code on wrong PKCE; reuse revokes issued credentials", async () => {
    const code = await approvedCode()
    const base = { grant_type: "authorization_code", client_id: "coach-house-chatgpt", redirect_uri: redirectUri, resource, code }
    expect((await post("token", { ...base, code_verifier: "q".repeat(43) })).status).toBe(400)
    const response = await post("token", { ...base, code_verifier: verifier })
    expect(response.status).toBe(200)
    const tokens = await response.json()
    expect((await post("token", { ...base, code_verifier: verifier })).status).toBe(400)
    await expect(authenticateCompanionConnection(mcpRequest(tokens.access_token))).rejects.toMatchObject({ code: "invalid_token" })
  })

  it("revokes the token family after refresh replay", async () => {
    const tokens = await credentials()
    const values = { grant_type: "refresh_token", client_id: "coach-house-chatgpt", resource, refresh_token: tokens.refresh_token }
    const first = await post("token", values)
    expect(first.status).toBe(200)
    const current = await first.json()
    expect((await post("token", values)).status).toBe(400)
    await expect(authenticateCompanionConnection(mcpRequest(current.access_token))).rejects.toMatchObject({ code: "invalid_token" })
  })

  it("rejects a normal browser token returned for a different upstream client", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ access_token: jwt({ client_id: undefined }), refresh_token: "browser-session" }))
    const pending = await start()
    const response = await handleCompanionOAuth(new NextRequest(`${callbackUri}?code=code&state=${pending.state}`, { headers: { cookie: pending.cookie } }), "callback")
    expect(response.status).toBe(401)
    expect(state.grants.size).toBe(0)
  })

  it("rejects expired or revoked access and rechecks upstream session validity", async () => {
    const tokens = await credentials()
    state.tokens.get(oauthHash(tokens.access_token))!.expired = true
    await expect(authenticateCompanionConnection(mcpRequest(tokens.access_token))).rejects.toMatchObject({ code: "invalid_token" })
    state.tokens.get(oauthHash(tokens.access_token))!.expired = false
    state.getUser.mockResolvedValueOnce({ data: { user: null }, error: { message: "session revoked" } })
    await expect(authenticateCompanionConnection(mcpRequest(tokens.access_token))).rejects.toMatchObject({ code: "invalid_token" })
  })

  it("rejects a non-allowlisted verified callback even after upstream consent", async () => {
    const pending = await start()
    vi.stubEnv("COMPANION_ALLOWED_USER_IDS", "11111111-1111-4111-8111-111111111111")
    const response = await handleCompanionOAuth(new NextRequest(`${callbackUri}?code=approved-upstream-code&state=${pending.state}`, { headers: { cookie: pending.cookie } }), "callback")
    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({ error: "access_denied" })
    expect(state.grants.size).toBe(0)
    expect(state.store.mock.calls.some(([action]) => action === "create_grant")).toBe(false)
  })

  it("blocks code exchange after pilot access is removed and revokes the unreturned token family", async () => {
    const code = await approvedCode()
    vi.stubEnv("COMPANION_ALLOWED_USER_IDS", "11111111-1111-4111-8111-111111111111")
    const response = await post("token", { grant_type: "authorization_code", client_id: "coach-house-chatgpt", redirect_uri: redirectUri, resource, code, code_verifier: verifier })
    expect(response.status).toBe(403)
    expect(await response.json()).not.toHaveProperty("access_token")
    expect([...state.grants.values()][0].revoked).toBe(true)
  })

  it("rechecks pilot policy for every MCP authentication and revokes removed users", async () => {
    const tokens = await credentials()
    await expect(authenticateCompanionConnection(mcpRequest(tokens.access_token))).resolves.toMatchObject({ userId })
    vi.stubEnv("COMPANION_ALLOWED_USER_IDS", "11111111-1111-4111-8111-111111111111")
    state.getUser.mockClear()
    await expect(authenticateCompanionConnection(mcpRequest(tokens.access_token))).rejects.toMatchObject({ code: "access_denied", status: 403 })
    expect(state.getUser).not.toHaveBeenCalled()
    expect([...state.grants.values()][0].revoked).toBe(true)
    vi.stubEnv("COMPANION_ALLOWED_USER_IDS", userId)
    await expect(authenticateCompanionConnection(mcpRequest(tokens.access_token))).rejects.toMatchObject({ code: "invalid_token" })
  })

  it("denies removed users before refreshing the upstream token", async () => {
    const tokens = await credentials()
    vi.stubEnv("COMPANION_ALLOWED_USER_IDS", "11111111-1111-4111-8111-111111111111")
    vi.mocked(fetch).mockClear()
    const response = await post("token", { grant_type: "refresh_token", client_id: "coach-house-chatgpt", resource, refresh_token: tokens.refresh_token })
    expect(response.status).toBe(401)
    expect(await response.json()).not.toHaveProperty("access_token")
    expect(fetch).not.toHaveBeenCalled()
    expect([...state.grants.values()][0].revoked).toBe(true)
  })

  it("rechecks the current allowlist after upstream refresh verification", async () => {
    const tokens = await credentials()
    vi.mocked(fetch).mockImplementationOnce(async () => {
      vi.stubEnv("COMPANION_ALLOWED_USER_IDS", "11111111-1111-4111-8111-111111111111")
      return Response.json({ access_token: jwt(), refresh_token: "upstream-refreshed" })
    })
    const response = await post("token", { grant_type: "refresh_token", client_id: "coach-house-chatgpt", resource, refresh_token: tokens.refresh_token })
    expect(response.status).toBe(401)
    expect(await response.json()).not.toHaveProperty("access_token")
    expect([...state.grants.values()][0].revoked).toBe(true)
  })

  it("binds ciphertext to its context and fails closed when disabled", async () => {
    const encrypted = encryptOAuth({ refresh_token: "secret" }, encryptionKey, "user:one")
    expect(decryptOAuth(encrypted, encryptionKey, "user:one")).toEqual({ refresh_token: "secret" })
    expect(() => decryptOAuth(encrypted, encryptionKey, "user:two")).toThrow()
    vi.stubEnv("COMPANION_LIVE_ENABLED", "0")
    const response = await handleCompanionOAuth(new NextRequest(`${origin}/api/companion/oauth/authorize?${authorizeParams()}`), "authorize")
    expect(response.status).toBe(404)
    expect(state.store).not.toHaveBeenCalled()
  })
})
