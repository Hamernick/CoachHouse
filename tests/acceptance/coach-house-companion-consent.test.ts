import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { OAuthAuthorizationDetails } from "@supabase/supabase-js"
import { loadCompanionConsent, handleCompanionAuthorization } from "@/features/coach-house-companion/server/live/consent"

const mocks = vi.hoisted(() => ({ factory: vi.fn(), user: vi.fn(), details: vi.fn(), approve: vi.fn(), deny: vi.fn(), config: vi.fn(), upstreamRedirect: vi.fn() }))
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.factory }))
vi.mock("@/features/coach-house-companion/server/live/config", async importOriginal => ({ ...await importOriginal<typeof import("@/features/coach-house-companion/server/live/config")>(), getCompanionLiveConfig: mocks.config }))
vi.mock("@/features/coach-house-companion/server/live/oauth-broker", () => ({ validateCompanionUpstreamRedirect: mocks.upstreamRedirect }))

const publicOrigin = "https://coachhouse.test"
const callback = `${publicOrigin}/api/companion/oauth/callback`
const id = "authorization-test-123"
const userId = "87654321-1234-4234-8234-123456789abc"
const clientId = "client-approved-123"
let details: OAuthAuthorizationDetails

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv("COMPANION_LIVE_ENABLED", "1")
  vi.stubEnv("COMPANION_CONSENT_SECRET", "test-only-consent-secret-longer-than-32-characters")
  mocks.config.mockReturnValue({ publicOrigin, clientId, upstreamRedirectUri: callback, allowedUserIds: [userId] })
  mocks.upstreamRedirect.mockResolvedValue(true)
  mocks.user.mockResolvedValue({ data: { user: { id: userId, email: "member@example.test" } }, error: null })
  details = {
    authorization_id: id, redirect_uri: callback, scope: "openid email profile",
    client: { id: clientId, name: "Test Companion", uri: "https://client.example", logo_uri: "" },
    user: { id: userId, email: "member@example.test" },
  }
  mocks.details.mockImplementation(async () => ({ data: structuredClone(details), error: null }))
  mocks.approve.mockResolvedValue({ data: { redirect_url: `${callback}?code=provider-code&state=provider-state` }, error: null })
  mocks.deny.mockResolvedValue({ data: { redirect_url: `${callback}?error=access_denied&state=provider-state` }, error: null })
  mocks.factory.mockResolvedValue({ auth: { getUser: mocks.user, oauth: { getAuthorizationDetails: mocks.details, approveAuthorization: mocks.approve, denyAuthorization: mocks.deny } } })
})

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs() })

async function reviewed() {
  const state = await loadCompanionConsent(id)
  expect(state.status).toBe("ready")
  if (state.status !== "ready") throw new Error("Consent review unavailable")
  return state
}

function decide(body: unknown, options: { origin?: string | null; type?: string; method?: string; url?: string; raw?: string; fetchSite?: string } = {}) {
  const headers = new Headers({ "content-type": options.type ?? "application/json" })
  if (options.origin !== null) headers.set("origin", options.origin ?? publicOrigin)
  if (options.fetchSite) headers.set("sec-fetch-site", options.fetchSite)
  const method = options.method ?? "POST"
  return handleCompanionAuthorization(new Request(options.url ?? `${publicOrigin}/api/companion/authorization`, {
    method, headers, ...(method === "POST" ? { body: options.raw ?? JSON.stringify(body) } : {}),
  }))
}

describe("Companion OAuth consent review", () => {
  it.each(["disabled", "missing-secret", "missing-config"])("fails closed before account/provider access when %s", async (state) => {
    if (state === "disabled") vi.stubEnv("COMPANION_LIVE_ENABLED", "0")
    if (state === "missing-secret") vi.stubEnv("COMPANION_CONSENT_SECRET", "")
    if (state === "missing-config") mocks.config.mockImplementation(() => { throw new Error("Missing deployment configuration") })
    expect((await loadCompanionConsent(id)).status).toBe("unavailable")
    expect((await decide({})).status).toBe(503)
    expect(mocks.factory).not.toHaveBeenCalled()
  })

  it("preserves a validated authorization ID through the existing login redirect parameter", async () => {
    mocks.user.mockResolvedValue({ data: { user: null }, error: null })
    const state = await loadCompanionConsent(id)
    expect(state.status).toBe("login")
    if (state.status !== "login") throw new Error("Expected login")
    const login = new URL(state.href, publicOrigin)
    expect(login.pathname).toBe("/login")
    expect(login.searchParams.get("redirect")).toBe(`/oauth/consent?authorization_id=${id}`)
    expect(mocks.details).not.toHaveBeenCalled()
  })

  it.each([undefined, [id, "other"], "//attacker.example", "valid-id?redirect=https://attacker.example", "bad\nrequest"])("rejects malformed authorization IDs before login/provider use (%j)", async (value) => {
    expect((await loadCompanionConsent(value)).status).toBe("unavailable")
    expect(mocks.factory).not.toHaveBeenCalled()
  })

  it("blocks non-pilot accounts before loading or resuming upstream consent", async () => {
    mocks.config.mockReturnValue({ publicOrigin, clientId, upstreamRedirectUri: callback, allowedUserIds: ["11111111-1111-4111-8111-111111111111"] })
    mocks.details.mockResolvedValue({ data: { redirect_url: `${callback}?code=approved&state=state` }, error: null })
    const state = await loadCompanionConsent(id)
    expect(state).toMatchObject({ status: "unavailable", message: expect.stringContaining("private Coach House Companion pilot") })
    expect(mocks.details).not.toHaveBeenCalled()
    expect(mocks.approve).not.toHaveBeenCalled()
    expect(mocks.upstreamRedirect).not.toHaveBeenCalled()
  })

  it("renders only verified client/account/scopes and does not authorize during GET", async () => {
    const state = await reviewed()
    expect(state.clientName).toBe("Test Companion")
    expect(state.clientWebsite).toBe("https://client.example/")
    expect(state.accountEmail).toBe("member@example.test")
    expect(state.scopes).toEqual(["openid", "email", "profile"])
    expect(state.csrfToken).not.toContain(process.env.COMPANION_CONSENT_SECRET)
    expect(mocks.approve).not.toHaveBeenCalled()
    expect(mocks.deny).not.toHaveBeenCalled()
  })

  it.each(["client", "user", "authorization", "scope", "redirect"])("rejects unapproved request details (%s)", async (field) => {
    if (field === "client") details.client.id = "another-client"
    if (field === "user") details.user.id = "another-user"
    if (field === "authorization") details.authorization_id = "another-request"
    if (field === "scope") details.scope = "openid admin"
    if (field === "redirect") details.redirect_uri = "javascript:alert(1)"
    expect((await loadCompanionConsent(id)).status).toBe("unavailable")
    expect(mocks.approve).not.toHaveBeenCalled()
  })

  it("omits an unsafe optional client website", async () => {
    details.client.uri = "javascript:alert(1)"
    expect((await reviewed()).clientWebsite).toBeNull()
  })

  it("does not follow an unverified redirect-only response", async () => {
    mocks.details.mockResolvedValue({ data: { redirect_url: "https://attacker.example?code=hidden" }, error: null })
    expect((await loadCompanionConsent(id)).status).toBe("unavailable")
  })

  it("resumes prior consent only through a broker-verified callback transaction", async () => {
    const redirectUrl = `${callback}?code=provider-code&state=provider-state`
    mocks.details.mockResolvedValue({ data: { redirect_url: redirectUrl }, error: null })
    expect(await loadCompanionConsent(id)).toEqual({ status: "redirect", href: redirectUrl })
    expect(mocks.upstreamRedirect).toHaveBeenCalledWith(redirectUrl)
    expect(mocks.approve).not.toHaveBeenCalled()
    mocks.upstreamRedirect.mockResolvedValue(false)
    expect((await loadCompanionConsent(id)).status).toBe("unavailable")
  })

  it("rejects a different HTTPS callback even for the approved client", async () => {
    details.redirect_uri = "https://client.example/unexpected-callback"
    expect((await loadCompanionConsent(id)).status).toBe("unavailable")
  })
})

describe("Companion explicit OAuth decisions", () => {
  it.each(["approve", "deny"] as const)("reauthorizes and sends only the verified ID for %s", async (decision) => {
    const state = await reviewed()
    const response = await decide({ authorizationId: id, csrfToken: state.csrfToken, decision })
    expect(response.status).toBe(200)
    expect(mocks.details).toHaveBeenCalledTimes(2)
    const selected = decision === "approve" ? mocks.approve : mocks.deny
    expect(selected).toHaveBeenCalledExactlyOnceWith(id, { skipBrowserRedirect: true })
    expect(decision === "approve" ? mocks.deny : mocks.approve).not.toHaveBeenCalled()
    expect((await response.json()).redirectTo).toContain(callback)
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(response.headers.get("referrer-policy")).toBe("no-referrer")
  })

  it.each([null, "https://attacker.example"])("denies missing/cross-origin decisions (%s)", async (origin) => {
    expect((await decide({}, { origin })).status).toBe(403)
    expect(mocks.factory).not.toHaveBeenCalled()
  })

  it("denies mismatched request origin and cross-site fetch metadata", async () => {
    expect((await decide({}, { url: "https://other.example/api/companion/authorization" })).status).toBe(403)
    expect((await decide({}, { fetchSite: "cross-site" })).status).toBe(403)
  })

  it.each(["clientId", "redirectTo"])("rejects submitted %s claims", async (key) => {
    const state = await reviewed()
    expect((await decide({ authorizationId: id, csrfToken: state.csrfToken, decision: "approve", [key]: "attacker" })).status).toBe(400)
    expect(mocks.approve).not.toHaveBeenCalled()
  })

  it("rejects tampered, expired, and missing consent tokens", async () => {
    const state = await reviewed()
    for (const csrfToken of [undefined, "invalid", `${state.csrfToken}.extra`]) {
      expect((await decide({ authorizationId: id, csrfToken, decision: "approve" })).status).toBe(403)
    }
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 11 * 60 * 1000)
    expect((await decide({ authorizationId: id, csrfToken: state.csrfToken, decision: "approve" })).status).toBe(403)
    expect(mocks.approve).not.toHaveBeenCalled()
  })

  it("rejects decisions after the signed-in account changes", async () => {
    const state = await reviewed()
    mocks.user.mockResolvedValue({ data: { user: { id: "different-user" } }, error: null })
    expect((await decide({ authorizationId: id, csrfToken: state.csrfToken, decision: "approve" })).status).toBe(403)
    expect(mocks.approve).not.toHaveBeenCalled()
  })

  it("rechecks pilot access between review and approval", async () => {
    const state = await reviewed()
    mocks.config.mockReturnValue({ publicOrigin, clientId, upstreamRedirectUri: callback, allowedUserIds: ["11111111-1111-4111-8111-111111111111"] })
    const response = await decide({ authorizationId: id, csrfToken: state.csrfToken, decision: "approve" })
    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({ code: "access_denied" })
    expect(mocks.approve).not.toHaveBeenCalled()
  })

  it("rechecks allowlist again immediately before the upstream grant", async () => {
    const state = await reviewed()
    mocks.details.mockImplementationOnce(async () => {
      mocks.config.mockReturnValue({ publicOrigin, clientId, upstreamRedirectUri: callback, allowedUserIds: ["11111111-1111-4111-8111-111111111111"] })
      return { data: structuredClone(details), error: null }
    })
    const response = await decide({ authorizationId: id, csrfToken: state.csrfToken, decision: "approve" })
    expect(response.status).toBe(403)
    expect(mocks.approve).not.toHaveBeenCalled()
  })

  it("rejects decisions without an authenticated user", async () => {
    const state = await reviewed()
    mocks.user.mockResolvedValue({ data: { user: null }, error: null })
    expect((await decide({ authorizationId: id, csrfToken: state.csrfToken, decision: "deny" })).status).toBe(401)
    expect(mocks.deny).not.toHaveBeenCalled()
  })

  it("requires a new review if the requested scopes change", async () => {
    const state = await reviewed()
    details.scope = "openid email"
    const response = await decide({ authorizationId: id, csrfToken: state.csrfToken, decision: "approve" })
    expect(response.status).toBe(409)
    expect((await response.json()).code).toBe("review_changed")
    expect(mocks.approve).not.toHaveBeenCalled()
  })

  it("does not approve a client switched after review", async () => {
    const state = await reviewed()
    details.client.id = "another-client"
    expect((await decide({ authorizationId: id, csrfToken: state.csrfToken, decision: "approve" })).status).toBe(403)
    expect(mocks.approve).not.toHaveBeenCalled()
  })

  it("rejects an unexpected provider return address", async () => {
    const state = await reviewed()
    mocks.approve.mockResolvedValue({ data: { redirect_url: "https://attacker.example?code=hidden" }, error: null })
    const response = await decide({ authorizationId: id, csrfToken: state.csrfToken, decision: "approve" })
    expect(response.status).toBe(502)
    expect((await response.json()).code).toBe("redirect_mismatch")
  })

  it("surfaces provider failure without reporting approval", async () => {
    const state = await reviewed()
    mocks.approve.mockResolvedValue({ data: null, error: new Error("Provider failure") })
    const response = await decide({ authorizationId: id, csrfToken: state.csrfToken, decision: "approve" })
    expect(response.status).toBe(502)
    expect(await response.json()).not.toHaveProperty("redirectTo")
  })

  it("rejects a provider callback without a valid pending broker transaction", async () => {
    const state = await reviewed()
    mocks.upstreamRedirect.mockResolvedValue(false)
    expect((await decide({ authorizationId: id, csrfToken: state.csrfToken, decision: "approve" })).status).toBe(502)
  })

  it("bounds requests and rejects malformed JSON, unsupported methods, and content types", async () => {
    expect((await decide({}, { method: "GET" })).status).toBe(405)
    expect((await decide({}, { type: "text/plain" })).status).toBe(415)
    expect((await decide({}, { raw: "{" })).status).toBe(400)
    expect((await decide({}, { raw: "x".repeat(8193) })).status).toBe(413)
    expect(mocks.approve).not.toHaveBeenCalled()
  })
})
