import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { createAdmin } = vi.hoisted(() => ({ createAdmin: vi.fn() }))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: createAdmin }))
vi.mock("@/lib/public-site-origin", () => ({ getPublicSiteOrigin: () => "https://coachhouse.app" }))
vi.mock("@/lib/feature-flags", () => ({ publicSharingEnabled: true }))
vi.mock("@/features/nonprofit-documentation", () => ({
  documentationSitemapEntries: (origin: string) => [{ url: `${origin}/documentation` }],
}))

import sitemap from "@/app/sitemap"
import { fetchPublishedPublicHandles } from "@/lib/queries/public-profile-sitemap"

const updatedAt = "2026-10-15T12:00:00Z"
const handles = [
  { handle: "person", owner_type: "person", profile_id: "p1", organization_id: null, updated_at: updatedAt },
  { handle: "private-person", owner_type: "person", profile_id: "p2", organization_id: null, updated_at: updatedAt },
  { handle: "organization", owner_type: "organization", profile_id: null, organization_id: "o1", updated_at: updatedAt },
  { handle: "private-org", owner_type: "organization", profile_id: null, organization_id: "o2", updated_at: updatedAt },
]
type Result = { data: unknown[] | null; error: { code: string; message: string } | null }
const ok = (data: unknown[]): Result => ({ data, error: null })
const never = () => new Promise<Result>(() => {})

function database(overrides: Record<string, () => Promise<Result>> = {}) {
  const signals: AbortSignal[] = []
  const filters: Array<[string, string, unknown]> = []
  const results: Record<string, Result> = {
    public_handles: ok(handles), public_person_profiles: ok([{ profile_id: "p1" }]), organizations: ok([{ user_id: "o1" }]),
  }
  const from = vi.fn((table: string) => {
    const query = {
      select: vi.fn(() => query), order: vi.fn(() => query), limit: vi.fn(() => query),
      in: vi.fn(() => query),
      eq: vi.fn((column: string, value: unknown) => { filters.push([table, column, value]); return query }),
      abortSignal: vi.fn((signal: AbortSignal) => { signals.push(signal); return query }),
      returns: vi.fn(() => overrides[table]?.() ?? Promise.resolve(results[table])),
    }
    return query
  })
  createAdmin.mockReturnValue({ from })
  return { from, signals, filters }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  vi.spyOn(console, "error").mockImplementation(() => {})
  vi.spyOn(console, "warn").mockImplementation(() => {})
})
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

describe("bounded public profile sitemap lookup", () => {
  it("includes only confirmed public people and organizations", async () => {
    const db = database()
    expect(await fetchPublishedPublicHandles()).toEqual([
      { handle: "person", updatedAt }, { handle: "organization", updatedAt },
    ])
    expect(db.filters).toEqual([
      ["public_person_profiles", "is_public", true], ["organizations", "is_public", true],
    ])
    expect(new Set(db.signals).size).toBe(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each(["public_handles", "public_person_profiles", "organizations"])(
    "returns within 10 seconds and cancels requests when %s never settles", async (table) => {
      const db = database({ [table]: never })
      const pending = fetchPublishedPublicHandles()
      await vi.advanceTimersByTimeAsync(10_000)
      expect(await pending).toEqual([])
      expect(db.signals.every((signal) => signal.aborted)).toBe(true)
      expect(vi.getTimerCount()).toBe(0)
    }
  )

  it("shares one deadline across the initial and publication lookups", async () => {
    const db = database({
      public_handles: () => new Promise((resolve) => setTimeout(() => resolve(ok(handles)), 7_000)),
      organizations: never,
    })
    const pending = fetchPublishedPublicHandles()
    await vi.advanceTimersByTimeAsync(7_000)
    expect(db.from).toHaveBeenCalledWith("organizations")
    await vi.advanceTimersByTimeAsync(3_000)
    expect(await pending).toEqual([])
    expect(db.signals.every((signal) => signal.aborted)).toBe(true)
  })

  it.each(["public_handles", "public_person_profiles", "organizations"])(
    "fails closed when %s returns an error", async (table) => {
      database({ [table]: async () => ({ data: null, error: { code: "57014", message: "query timeout" } }) })
      expect(await fetchPublishedPublicHandles()).toEqual([])
      expect(vi.getTimerCount()).toBe(0)
    }
  )

  it("handles rejected transport requests", async () => {
    database({ public_handles: async () => { throw new Error("network unavailable") } })
    expect(await fetchPublishedPublicHandles()).toEqual([])
    expect(vi.getTimerCount()).toBe(0)
  })

  it("cancels a pending sibling when a publication request rejects", async () => {
    const db = database({
      public_person_profiles: async () => { throw new Error("network unavailable") },
      organizations: never,
    })
    expect(await fetchPublishedPublicHandles()).toEqual([])
    expect(db.signals.every((signal) => signal.aborted)).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })

  it("skips publication requests when there are no handles", async () => {
    const db = database({ public_handles: async () => ok([]) })
    expect(await fetchPublishedPublicHandles()).toEqual([])
    expect(db.from).toHaveBeenCalledTimes(1)
  })

  it("keeps static and Documentation sitemap entries when the database stalls", async () => {
    database({ public_handles: never })
    const pending = sitemap()
    await vi.advanceTimersByTimeAsync(10_000)
    const urls = (await pending).map((entry) => entry.url)
    expect(urls).toEqual([
      "https://coachhouse.app", "https://coachhouse.app/build", "https://coachhouse.app/resources", "https://coachhouse.app/community",
      "https://coachhouse.app/pricing", "https://coachhouse.app/privacy", "https://coachhouse.app/terms",
      "https://coachhouse.app/documentation",
    ])
  })

  it("keeps published profile metadata on healthy sitemap generation", async () => {
    database()
    expect(await sitemap()).toContainEqual({
      url: "https://coachhouse.app/person", lastModified: updatedAt, changeFrequency: "weekly", priority: 0.8,
    })
  })

  it("includes the canonical Build landing once without exposing previews or private profiles", async () => {
    database()
    const urls = (await sitemap()).map(({ url }) => url)

    expect(urls.filter((url) => url === "https://coachhouse.app/build")).toHaveLength(1)
    expect(urls).not.toContain("https://coachhouse.app/private-person")
    expect(urls).not.toContain("https://coachhouse.app/private-org")
    expect(urls).not.toContain("https://coachhouse.app/home-canvas")
    expect(urls.some((url) => url.includes("/visual-regression"))).toBe(false)
  })

  it("keeps the static sitemap when admin credentials are unavailable", async () => {
    createAdmin.mockImplementation(() => { throw new Error("missing admin key") })
    expect((await sitemap()).some((entry) => entry.url.endsWith("/pricing"))).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })
})
