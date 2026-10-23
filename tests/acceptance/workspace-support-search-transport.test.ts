import { afterEach, describe, expect, it, vi } from "vitest"
import { searchSupportOrganizationsOverHttp } from "@/features/organization-workspace-support/lib/search-transport"
import { handleWorkspaceSupportSearchPost } from "@/features/organization-workspace-support/routes"
import { searchSupportOrganizations } from "@/features/organization-workspace-support/actions"
import type { WorkspaceSupportSearchResult } from "@/features/organization-workspace-support/types"

vi.mock("@/features/organization-workspace-support/actions", () => ({ searchSupportOrganizations: vi.fn() }))
const result: WorkspaceSupportSearchResult = { organizations: [{ orgId: "org", name: "Organization", role: "admin", publicSlug: null, imageUrl: null }], total: 21, hasMore: true }
const request = (body: unknown = { query: "organization", offset: 20 }, origin = "https://coachhouse.app") => new Request("https://coachhouse.app/api/account/workspace-support-search", {
  method: "POST", headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify(body),
})
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); vi.resetAllMocks() })

describe("workspace directory HTTP search", () => {
  it("fetches a paged result without invoking the browser server-action queue", async () => {
    vi.mocked(searchSupportOrganizations).mockImplementation(() => new Promise(() => {}))
    const fetcher = vi.fn().mockResolvedValue(Response.json(result))
    vi.stubGlobal("fetch", fetcher)
    expect(await searchSupportOrganizationsOverHttp("organization", 20)).toEqual(result)
    expect(searchSupportOrganizations).not.toHaveBeenCalled()
    expect(fetcher).toHaveBeenCalledWith("/api/account/workspace-support-search", expect.objectContaining({
      method: "POST", credentials: "same-origin", cache: "no-store", body: JSON.stringify({ query: "organization", offset: 20 }),
    }))
  })
  it("ends a hung search and permits a successful retry", async () => {
    vi.useFakeTimers()
    let aborted = false
    const fetcher = vi.fn((_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init.signal?.addEventListener("abort", () => { aborted = true; reject(new Error("aborted")) })
    }))
    vi.stubGlobal("fetch", fetcher)
    const pending = searchSupportOrganizationsOverHttp("organization", 0)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(await pending).toMatchObject({ organizations: [], error: "Search took too long. Try again." })
    expect(aborted).toBe(true)
    fetcher.mockResolvedValueOnce(Response.json(result))
    expect(await searchSupportOrganizationsOverHttp("organization", 0)).toEqual(result)
    expect(vi.getTimerCount()).toBe(0)
  })
  it("cancels an obsolete search immediately without aborting its replacement", async () => {
    vi.useFakeTimers()
    const signals: AbortSignal[] = []
    const fetcher = vi.fn((_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
      signals.push(init.signal as AbortSignal)
      init.signal?.addEventListener("abort", () => reject(new Error("aborted")))
    }))
    vi.stubGlobal("fetch", fetcher)
    const old = new AbortController()
    const pending = searchSupportOrganizationsOverHttp("old", 0, old.signal)
    old.abort()
    expect(await pending).toHaveProperty("error")
    expect(signals[0].aborted).toBe(true)
    fetcher.mockResolvedValueOnce(Response.json(result))
    expect(await searchSupportOrganizationsOverHttp("new", 0, new AbortController().signal)).toEqual(result)
    expect(vi.getTimerCount()).toBe(0)
  })
  it("returns retryable errors for network, HTTP and invalid response failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(new Response("down", { status: 503 }))
      .mockResolvedValueOnce(new Response("<html>Sign in</html>"))
      .mockResolvedValueOnce(Response.json({})))
    for (let attempt = 0; attempt < 4; attempt++) {
      expect(await searchSupportOrganizationsOverHttp("org", 0)).toMatchObject({ organizations: [], error: "Search unavailable. Try again." })
    }
  })
  it("keeps authorization errors visible and empty results successful", async () => {
    const denied = { organizations: [], total: 0, hasMore: false, error: "Workspace support access is unavailable." }
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json(denied))
      .mockResolvedValueOnce(Response.json({ organizations: [], total: 0, hasMore: false })))
    expect(await searchSupportOrganizationsOverHttp("org", 0)).toEqual(denied)
    expect(await searchSupportOrganizationsOverHttp("no match", 0)).toEqual({ organizations: [], total: 0, hasMore: false })
  })
})

describe("workspace directory route", () => {
  it("delegates search and paging to existing authorization without caching identities", async () => {
    vi.mocked(searchSupportOrganizations).mockResolvedValue(result)
    const response = await handleWorkspaceSupportSearchPost(request())
    expect(await response.json()).toEqual(result)
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(searchSupportOrganizations).toHaveBeenCalledExactlyOnceWith("organization", 20)
  })
  it("preserves a denied authorization response without identities", async () => {
    const denied = { organizations: [], total: 0, hasMore: false, error: "Denied" }
    vi.mocked(searchSupportOrganizations).mockResolvedValue(denied)
    expect(await (await handleWorkspaceSupportSearchPost(request())).json()).toEqual(denied)
  })
  it("rejects untrusted origins and malformed input before accessing the directory", async () => {
    expect((await handleWorkspaceSupportSearchPost(request({}, "https://other.example"))).status).toBe(403)
    expect((await handleWorkspaceSupportSearchPost(request({}, ""))).status).toBe(403)
    for (const body of [null, {}, { query: 1, offset: 0 }, { query: "org", offset: -1 }, { query: "org", offset: 0.5 }, { query: "org", offset: 100001 }]) {
      expect((await handleWorkspaceSupportSearchPost(request(body))).status).toBe(400)
    }
    expect((await handleWorkspaceSupportSearchPost(request({ query: "x".repeat(1001), offset: 0 }))).status).toBe(413)
    expect(searchSupportOrganizations).not.toHaveBeenCalled()
  })
})
