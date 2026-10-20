import { readFileSync } from "node:fs"
import { join } from "node:path"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server"

import { config, proxy } from "@/proxy"
import { DEFAULT_POST_AUTH_REDIRECT } from "@/lib/auth/redirects"

const { getUserMock, createServerClientMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  createServerClientMock: vi.fn(),
}))

vi.mock("@supabase/ssr", () => ({ createServerClient: createServerClientMock }))
vi.mock("@/lib/env", () => ({ env: {
  NEXT_PUBLIC_SUPABASE_URL: "https://supabase.test",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
} }))

const ROOT = process.cwd()

describe("proxy auth route redirects", () => {
  beforeEach(() => {
    getUserMock.mockReset().mockResolvedValue({ data: { user: null } })
    createServerClientMock.mockReset().mockImplementation((_url, _key, options) => {
      options.cookies.set("sb-test-auth-token", "refreshed", { httpOnly: true })
      return { auth: { getUser: getUserMock } }
    })
  })

  it.each(["/documentation", "/documentation/quickstart", "/documentation/search?q=grants"])("keeps documentation public with session cookies at %s", async (path) => {
    const response = await proxy(new NextRequest(`https://coachhouse.test${path}`, { headers: { cookie: "sb-test-auth-token=session" } }))
    expect(response.headers.get("location")).toBeNull()
    expect(createServerClientMock).not.toHaveBeenCalled()
  })

  it("keeps documentation mutations and similarly named session routes verified", async () => {
    await proxy(new NextRequest("https://coachhouse.test/documentation", { method: "POST" }))
    await proxy(new NextRequest("https://coachhouse.test/documentation-private", { headers: { cookie: "sb-test-auth-token=session" } }))
    expect(getUserMock).toHaveBeenCalledTimes(2)
  })

  it.each(["workspace-support-presence", "document-presence", "document-collaboration"])("delegates POST %s authentication to its guarded handler", async (route) => {
    const response = await proxy(new NextRequest(`https://coachhouse.test/api/account/${route}`, {
      method: "POST", headers: { cookie: "sb-test-auth-token=session" },
    }))
    expect(response.headers.get("x-middleware-next")).toBe("1")
    expect(createServerClientMock).not.toHaveBeenCalled()
  })

  it.each([
    ["/api/account/document-collaboration", "GET"],
    ["/api/account/document-presence", "DELETE"],
    ["/api/account/workspace-support-presence/other", "POST"],
    ["/api/account/document-presence-extra", "POST"],
    ["/api/account/org-media", "POST"],
  ])("retains proxy authentication for %s %s", async (path, method) => {
    await proxy(new NextRequest(`https://coachhouse.test${path}`, { method }))
    expect(getUserMock).toHaveBeenCalledOnce()
  })

  it.each([
    ["/api/internal/cron/coaching-calendar", false],
    ["/api/internal/cron/coaching-calendar/", false],
    ["/api/internal/cron/coaching-calendar?check=1", false],
    ["/api/internal/cron/coaching-calendar-extra", true],
    ["/api/internal/cron/coaching-calendar/other", true],
    ["/api/internal/cron/other", true],
    ["/api/integrations/google-calendar/sync", true],
    ["/api/account/org-documents", true],
    ["/api/public/resource-map/index", true],
    ["/", true],
    ["/documentation", true],
    ["/login", true],
    ["/sign-up", true],
    ["/forgot-password", true],
    ["/workspace", true],
    ["/organizations", true],
    ["/internal", true],
    ["/_next/static/app.js", false],
    ["/favicon.ico", false],
    ["/api/auth/signout", false],
  ])("preserves Proxy coverage for %s", (url, expected) => {
    expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url })).toBe(expected)
  })

  it("preserves anonymous protected redirects and refreshed cookies", async () => {
    const response = await proxy(new NextRequest("https://coachhouse.test/workspace?drawer=tools"))
    const location = new URL(response.headers.get("location")!)
    expect(location.pathname).toBe("/login")
    expect(location.searchParams.get("redirect")).toBe("/workspace?drawer=tools")
    expect(response.cookies.get("sb-test-auth-token")?.value).toBe("refreshed")
    expect(getUserMock).toHaveBeenCalledOnce()
  })

  it.each(["/login", "/sign-up"])("preserves an invite for an existing session at %s", async (path) => {
    getUserMock.mockResolvedValue({ data: { user: { id: "invited-member" } } })
    const destination = "/join-organization?token=invite_123"
    const response = await proxy(new NextRequest(`https://coachhouse.test${path}?redirect=${encodeURIComponent(destination)}`))
    expect(response.headers.get("location")).toBe(`https://coachhouse.test${destination}`)
    expect(response.cookies.get("sb-test-auth-token")?.value).toBe("refreshed")
  })

  it("preserves signed-in auth redirects", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "member" } } })
    const response = await proxy(new NextRequest("https://coachhouse.test/login"))
    expect(response.headers.get("location")).toBe(new URL(DEFAULT_POST_AUTH_REDIRECT, "https://coachhouse.test").href)
    expect(response.cookies.get("sb-test-auth-token")?.value).toBe("refreshed")
  })

  it.each(["/forgot-password", "/update-password", "/update-password?recovery_error=invalid_or_expired"])("keeps password recovery accessible with an existing session at %s", async (path) => {
    getUserMock.mockResolvedValue({ data: { user: { id: "member" } } })
    const response = await proxy(new NextRequest(`https://coachhouse.test${path}`, {
      headers: { cookie: "sb-test-auth-token=session" },
    }))
    expect(response.headers.get("location")).toBeNull()
    expect(response.cookies.get("sb-test-auth-token")?.value).toBe("refreshed")
    expect(getUserMock).toHaveBeenCalledOnce()
  })

  it("still refreshes browser sessions on public pages", async () => {
    const response = await proxy(new NextRequest("https://coachhouse.test/", {
      headers: { cookie: "sb-test-auth-token=session" },
    }))
    expect(response.headers.get("location")).toBeNull()
    expect(response.cookies.get("sb-test-auth-token")?.value).toBe("refreshed")
    expect(getUserMock).toHaveBeenCalledOnce()
  })

  it.each(["/", "/documentation", "/pricing", "/privacy", "/public-org"])("avoids session work for cookie-free public reads at %s", async (path) => {
    const response = await proxy(new NextRequest(`https://coachhouse.test${path}`))
    expect(response.headers.get("location")).toBeNull()
    expect(response.headers.get("x-middleware-next")).toBe("1")
    expect(createServerClientMock).not.toHaveBeenCalled()
  })

  it.each([
    ["/", "POST", ""],
    ["/", "GET", "coach_locale=fr-FR"],
    ["/", "GET", "sb-test-auth-token.0=chunked-session"],
    ["/", "GET", "sb-test-auth-token=malformed"],
    ["/api/public/resource-map/index", "GET", ""],
    ["/api/account/org-documents", "GET", ""],
    ["/login", "GET", ""],
    ["/workspace", "GET", ""],
    ["/coaching", "GET", ""],
  ])("retains session verification for %s %s with cookies %s", async (path, method, cookie) => {
    await proxy(new NextRequest(`https://coachhouse.test${path}`, { method, headers: cookie ? { cookie } : {} }))
    expect(getUserMock).toHaveBeenCalledOnce()
  })

  it.each([
    ["/coaching", { coaching_access: true }, {}, null],
    ["/coaching/booking", { coaching_access: true }, {}, null],
    ["/coaching", {}, {}, "/organizations"],
    ["/coaching", {}, { coaching_access: true }, "/organizations"],
    ["/coaching", { coaching_access: false }, {}, "/organizations"],
    ["/coaching", { coaching_access: "true" }, {}, "/organizations"],
    ["/admin/platform", { coaching_access: true }, {}, "/organizations"],
    ["/billing", { coaching_access: true }, {}, "/organizations"],
  ])("applies verified coach grants at %s with app metadata %j and user metadata %j", async (path, appMetadata, userMetadata, expectedRedirect) => {
    getUserMock.mockResolvedValue({ data: { user: {
      id: "coach-user", app_metadata: appMetadata, user_metadata: userMetadata,
    } } })
    createServerClientMock.mockImplementation(() => ({
      auth: { getUser: getUserMock },
      from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({
          data: { access_level: "coach" }, error: null,
        }) }),
      }) }),
    }))
    const response = await proxy(new NextRequest(`https://coachhouse.test${path}`))
    expect(response.headers.get("location")).toBe(expectedRedirect ? `https://coachhouse.test${expectedRedirect}` : null)
    expect(getUserMock).toHaveBeenCalledOnce()
  })

  it("sends already-authenticated auth routes through the post-auth landing guard", () => {
    const source = readFileSync(join(ROOT, "src/proxy.ts"), "utf8")

    expect(source).toContain("DEFAULT_POST_AUTH_REDIRECT")
    expect(source).not.toContain('new URL("/projects"')
  })
})
