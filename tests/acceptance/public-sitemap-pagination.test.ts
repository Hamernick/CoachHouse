import { beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
  sharing: true, resources: "true", error: false,
  records: [] as Record<string, unknown>[],
  batches: [] as Record<string, unknown>[][],
  counts: { public_handles: 1001, nonprofit_directory_public: 501, resource_map_public_items: 1, organizations: 1 } as Record<string, number>,
  calls: [] as unknown[][],
  profiles: vi.fn(),
}))
vi.mock("@/lib/feature-flags", () => ({ get publicSharingEnabled() { return state.sharing } }))
vi.mock("@/lib/env", () => ({ env: { get RESOURCE_MAP_PUBLIC_DB_ENABLED() { return state.resources } } }))
vi.mock("@/lib/public-site-origin", () => ({ getPublicSiteOrigin: () => "https://coachhouse.app" }))
vi.mock("@/lib/queries/public-profile-sitemap", () => ({ fetchPublishedPublicHandles: state.profiles }))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({
  from: (table: string) => {
    state.calls.push(["from", table])
    const query = {
      select: (columns: string, options?: unknown) => { state.calls.push(["select", columns, options]); return query },
      eq: (key: string, value: unknown) => { state.calls.push(["eq", key, value]); return query },
      not: (key: string, operator: string, value: unknown) => { state.calls.push(["not", key, operator, value]); return query },
      order: (key: string) => { state.calls.push(["order", key]); return query },
      range: (start: number, end: number) => { state.calls.push(["range", start, end]); return query },
      gte: (key: string, value: unknown) => { state.calls.push(["gte", key, value]); return query },
      lte: (key: string, value: unknown) => { state.calls.push(["lte", key, value]); return query },
      gt: (key: string, value: unknown) => { state.calls.push(["gt", key, value]); return query },
      limit: (value: number) => { state.calls.push(["limit", value]); return query },
      abortSignal: (signal: AbortSignal) => {
        state.calls.push(["signal", signal])
        return query
      },
      then: (resolve: (value: unknown) => unknown) => {
        return Promise.resolve({ data: state.batches.shift() ?? state.records, count: state.counts[table], error: state.error ? { message: "unavailable" } : null }).then(resolve)
      },
    }
    return query
  },
}) }))

import { publicSitemapIndexGET } from "@/lib/queries/public-sitemap"
import { GET as publicSitemapPageGET } from "@/app/public-sitemap.xml/route"
const page = (kind: string, page = "0") => publicSitemapPageGET(new Request(`https://coachhouse.app/public-sitemap.xml?${new URLSearchParams({ kind, page })}`))
const locations = (xml: string) => [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => new URL(match[1].replaceAll("&amp;", "&")))

beforeEach(() => {
  state.sharing = true; state.resources = "true"; state.error = false; state.records = []; state.batches = []; state.calls = []
  state.profiles.mockReset().mockResolvedValue([{ handle: "published-person" }])
})

describe("public sitemap pagination", () => {
  it("discovers every catalog page beyond provider row limits", async () => {
    const result = await publicSitemapIndexGET()
    const body = await result.text()
    expect(result.status).toBe(200)
    expect(body).toContain("/sitemap.xml")
    expect(body).toContain("/public-sitemap.xml?kind=profiles&amp;page=2")
    expect(body).not.toContain("kind=profiles&amp;page=3")
    expect(body).toContain("kind=nonprofits&amp;page=1")
    expect(body.match(/<sitemap>/g)).toHaveLength(20_006)
  })
  it("serves every catalog at a location authorized to describe its public URLs", async () => {
    const shards = locations(await (await publicSitemapIndexGET()).text()).filter((url) => url.searchParams.get("page") === "0")
    expect(shards).toHaveLength(4)
    state.records = [{ ein: "000000001", item_id: "00000000-0000-4000-8000-000000000001", title: "Food Pantry", public_slug: "published-org" }]
    for (const shard of shards) {
      expect(shard.pathname).toBe("/public-sitemap.xml")
      const result = await publicSitemapPageGET(new Request(shard))
      expect(result.status).toBe(200)
      const urls = locations(await result.text())
      expect(urls.length).toBeGreaterThan(0)
      const scope = new URL("./", shard)
      for (const url of urls) {
        expect(url.origin).toBe(scope.origin)
        expect(url.pathname.startsWith(scope.pathname)).toBe(true)
      }
    }
  })
  it("uses the publication-filtered nonprofit view and deterministic page boundaries", async () => {
    state.records = [{ ein: "000123456" }]
    const result = await page("nonprofits", "2")
    expect(await result.text()).toContain("/find/resources/000123456")
    expect(state.calls).toContainEqual(["from", "nonprofit_directory_public"])
    expect(state.calls).toContainEqual(["order", "ein"])
    expect(state.calls).toContainEqual(["gte", "ein", "000100000"])
    expect(state.calls).toContainEqual(["lte", "ein", "000149999"])
    expect(state.calls).toContainEqual(["limit", 500])
    expect(state.calls).not.toContainEqual(["from", "nonprofit_directory"])
  })
  it("continues a dense EIN range past the provider row limit without offsets", async () => {
    state.batches = [Array.from({ length: 500 }, (_, index) => ({ ein: String(index + 1).padStart(9, "0") })), [{ ein: "000000501" }]]
    const body = await (await page("nonprofits")).text()
    expect(body.match(/<url>/g)).toHaveLength(501)
    expect(state.calls).toContainEqual(["gt", "ein", "000000500"])
  })
  it("rejects out-of-range or repeated EIN results instead of emitting an invalid catalog", async () => {
    state.records = [{ ein: "123456789" }]
    expect((await page("nonprofits")).status).toBe(503)
    expect((await page("nonprofits", "20000")).status).toBe(404)
  })
  it("excludes discovery entities and historical RLS fixtures from resource URLs", async () => {
    const id = "00000000-0000-4000-8000-000000000001"
    state.records = [
      { item_id: id, title: "Food Pantry", organization_name: "Neighborhood", source_label: "Provider", source_url: "https://provider.org" },
      { item_id: "00000000-0000-4000-8000-000000000002", title: "Entity", source_label: "Wikidata" },
      { item_id: "00000000-0000-4000-8000-000000000003", title: "RLS Resource Service", organization_name: "RLS Resource Org", source_url: "https://example.org/service" },
    ]
    const body = await (await page("resources")).text()
    expect(body.match(/<url>/g)).toHaveLength(1)
    expect(body).toContain(id)
  })
  it("requires the same explicit roadmap publication flag as the public page", async () => {
    state.records = [{ public_slug: "published-org" }]
    expect(await (await page("roadmaps")).text()).toContain("/published-org/roadmap")
    expect(state.calls).not.toContainEqual(["eq", "is_public", true])
    expect(state.calls).toContainEqual(["eq", "is_public_roadmap", true])
  })
  it("uses strict published-profile checks for the requested shard", async () => {
    expect(await (await page("profiles", "3")).text()).toContain("/published-person")
    expect(state.profiles).toHaveBeenCalledWith({ page: 3, strict: true })
    state.profiles.mockRejectedValueOnce(new Error("publication unavailable"))
    expect((await page("profiles")).status).toBe(503)
  })
  it("does not advertise disabled resource or roadmap pages", async () => {
    state.sharing = false; state.resources = "false"
    const body = await (await publicSitemapIndexGET()).text()
    expect(body).not.toContain("kind=roadmaps")
    expect(body).not.toContain("kind=resources")
    expect((await page("roadmaps")).status).toBe(404)
    expect((await page("resources")).status).toBe(404)
  })
  it.each(["-1", "1.5", "01", "Infinity", "10000000"])("rejects invalid page %s before querying", async (value) => {
    expect((await page("nonprofits", value)).status).toBe(404)
    expect(state.calls).toEqual([])
  })
  it.each(["", "kind=profiles", "page=0", "kind=unknown&page=0", "kind=profiles&page=", "kind=profiles&kind=nonprofits&page=0", "kind=profiles&page=0&page=1"])("rejects incomplete or ambiguous query %s before querying", async (query) => {
    const response = await publicSitemapPageGET(new Request(`https://coachhouse.app/public-sitemap.xml?${query}`))
    expect(response.status).toBe(404)
    expect(state.calls).toEqual([])
    expect(state.profiles).not.toHaveBeenCalled()
  })
  it("returns an uncached failure instead of publishing an empty sitemap on database errors", async () => {
    state.error = true
    for (const result of [await publicSitemapIndexGET(), await page("nonprofits")]) {
      expect(result.status).toBe(503)
      expect(result.headers.get("cache-control")).toBe("no-store")
      expect(await result.text()).not.toContain("<urlset")
    }
  })
})
