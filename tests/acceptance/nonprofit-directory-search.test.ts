import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { rpc, createClient, summaryFrom } = vi.hoisted(() => ({
  summaryFrom: vi.fn(),
  rpc: vi.fn(),
  createClient: vi.fn(),
}))
vi.mock("@supabase/supabase-js", () => ({ createClient }))
vi.mock("server-only", () => ({}))
vi.mock("next/cache", () => ({ unstable_cache: (callback: () => Promise<number>) => callback }))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ from: summaryFrom }) }))
vi.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_SUPABASE_URL: "https://directory.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-only",
  },
}))

import { GET as search } from "@/app/api/public/nonprofits/search/route"
import { GET as detail } from "@/app/api/public/nonprofits/[ein]/route"

import { loadNonprofitDirectoryPage } from "@/features/find-resource-index/lib/nonprofit-directory-client"

afterEach(() => vi.restoreAllMocks())

const item = (ein: string) => ({
  ein,
  name: "Community nonprofit",
  city: null,
  state: null,
  postalCode: null,
  website: null,
  phone: null,
  description: null,
  websiteBasis: null,
  phoneBasis: null,
  websiteSourcePeriod: null,
  phoneSourcePeriod: null,
  descriptionSourcePeriod: null,
  operatingStatus: "unknown",
  listingType: "nonprofit_organization",
})
beforeEach(() => {
  vi.clearAllMocks()
  createClient.mockReturnValue({ rpc })
})

describe("bounded nonprofit organization search", () => {
  it("returns source identities without coordinates, service categories or contact fields", async () => {
    rpc.mockResolvedValue({ data: [item("012345678")], error: null })
    const response = await search(
      new Request(
        "https://coachhouse.app/api/public/nonprofits/search?q=community"
      )
    )
    expect(response.status).toBe(200)
    expect((await response.json()).items[0]).toMatchObject({
      ein: "012345678",
      website: null,
      listingType: "nonprofit_organization",
    })
    expect(createClient.mock.calls[0][1]).toBe("anon-only")
    expect(rpc).toHaveBeenCalledWith(
      "search_nonprofit_directory_v2",
      expect.objectContaining({ p_limit: 51 })
    )
  })
  it("binds keyset cursors to the query and state; never calculates a national total", async () => {
    rpc.mockResolvedValue({
      data: [item("012345678"), item("012345679")],
      error: null,
    })
    const first = await search(
      new Request(
        "https://coachhouse.app/api/public/nonprofits/search?q=community&state=IL&limit=1"
      )
    )
    const data = await first.json()
    expect(data.items).toHaveLength(1)
    expect(data.page.hasMore).toBe(true)
    expect(data.page).not.toHaveProperty("totalCount")
    const cursor = encodeURIComponent(data.page.nextCursor)
    rpc.mockResolvedValue({ data: [item("012345679")], error: null })
    await search(
      new Request(
        `https://coachhouse.app/api/public/nonprofits/search?q=community&state=IL&limit=1&cursor=${cursor}`
      )
    )
    expect(rpc).toHaveBeenLastCalledWith(
      "search_nonprofit_directory_v2",
      expect.objectContaining({ p_after: "012345678" })
    )
    const mismatch = await search(
      new Request(
        `https://coachhouse.app/api/public/nonprofits/search?q=different&cursor=${cursor}`
      )
    )
    expect(mismatch.status).toBe(400)
  })
  it("rejects unbounded limits and raw/private response fields", async () => {
    expect(
      (
        await search(
          new Request(
            "https://coachhouse.app/api/public/nonprofits/search?limit=1000"
          )
        )
      ).status
    ).toBe(400)
    expect(rpc).not.toHaveBeenCalled()
    rpc.mockResolvedValue({
      data: [{ ...item("012345678"), rawEvidence: "private" }],
      error: null,
    })
    const invalid = await search(
      new Request(
        "https://coachhouse.app/api/public/nonprofits/search?q=community"
      )
    )
    expect(invalid.status).toBe(503)
    expect(await invalid.text()).not.toContain("private")
  })
  it("detail preserves leading-zero EINs and returns 404 for hidden/missing organizations", async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    expect(
      (
        await detail(new Request("https://coachhouse.app"), {
          params: Promise.resolve({ ein: "012345678" }),
        })
      ).status
    ).toBe(404)
    expect(rpc).toHaveBeenCalledWith("get_nonprofit_directory", {
      p_ein: "012345678",
    })
    expect(
      (
        await detail(new Request("https://coachhouse.app"), {
          params: Promise.resolve({ ein: "123" }),
        })
      ).status
    ).toBe(400)
  })
})

it("loads one bounded browser page and passes the cancellation signal without following next cursors", async () => {
  const controller = new AbortController()
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(
      new Response(
        JSON.stringify({
          version: 1,
          items: [item("012345678")],
          page: { hasMore: true, nextCursor: "next-page", limit: 20 },
        })
      )
    )
  const page = await loadNonprofitDirectoryPage(
    "community",
    null,
    controller.signal
  )
  expect(page.page.hasMore).toBe(true)
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/public/nonprofits/search?q=community&limit=20",
    expect.objectContaining({ signal: controller.signal })
  )
})

it("browses categories without a query and refuses cursors from another category", async () => {
  rpc.mockResolvedValue({
    data: [item("012345678"), item("012345679")],
    error: null,
  })
  const first = await search(
    new Request(
      "https://coachhouse.app/api/public/nonprofits/search?category=food&limit=1"
    )
  )
  const data = await first.json()
  expect(first.status).toBe(200)
  expect(rpc).toHaveBeenLastCalledWith(
    "search_nonprofit_directory_v2",
    expect.objectContaining({ p_query: "", p_category: "food" })
  )
  const cursor = encodeURIComponent(data.page.nextCursor)
  const mismatch = await search(
    new Request(
      `https://coachhouse.app/api/public/nonprofits/search?category=health&limit=1&cursor=${cursor}`
    )
  )
  expect(mismatch.status).toBe(400)
  const next = await search(
    new Request(
      `https://coachhouse.app/api/public/nonprofits/search?category=food&limit=1&cursor=${cursor}`
    )
  )
  expect(next.status).toBe(200)
  expect(rpc).toHaveBeenLastCalledWith(
    "search_nonprofit_directory_v2",
    expect.objectContaining({ p_after: "012345678", p_category: "food" })
  )
})

it("rejects unknown category keys and preserves exact service leaves", async () => {
  const invalid = await search(
    new Request(
      "https://coachhouse.app/api/public/nonprofits/search?category=made_up"
    )
  )
  expect(invalid.status).toBe(400)
  expect(rpc).not.toHaveBeenCalled()
  rpc.mockResolvedValue({ data: [], error: null })
  await search(
    new Request(
      "https://coachhouse.app/api/public/nonprofits/search?category=food_food_pantries"
    )
  )
  expect(rpc).toHaveBeenLastCalledWith(
    "search_nonprofit_directory_v2",
    expect.objectContaining({ p_category: "food_food_pantries" })
  )
})

it("passes category-only browser queries with bounded pagination", async () => {
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(
      new Response(
        JSON.stringify({
          version: 1,
          items: [],
          page: { hasMore: false, nextCursor: null, limit: 20 },
        })
      )
    )
  await loadNonprofitDirectoryPage(
    "",
    null,
    new AbortController().signal,
    "faith"
  )
  expect(fetchMock.mock.calls[0][0]).toBe(
    "/api/public/nonprofits/search?q=&limit=20&category=faith"
  )
})

it("uses the shared listing shape without inventing a pin or verified service", async () => {
  const { nonprofitDirectoryMapItem } = await import("@/features/find-resource-index/lib/nonprofit-map-item")
  const source = { ...item("012345678"), operatingStatus: "unknown" as const, listingType: "nonprofit_organization" as const, city: "Albany", state: "NY", website: "https://example.org", websiteBasis: "source_reported" as const, descriptionSourcePeriod: "2024-12-31" }
  const listing = nonprofitDirectoryMapItem(source)
  expect(listing).toMatchObject({ id: "nonprofit:012345678", itemType: "external_resource", latitude: null, longitude: null, address: null, addressStreet: null, resourceCategories: [], verificationStatus: "external_data", lastVerifiedAt: null })
  expect(listing.nonprofit).toMatchObject({ ein: source.ein, websiteBasis: "source_reported", descriptionSourcePeriod: "2024-12-31" })
  expect(listing.services).toBeUndefined()
  expect(listing.availability).toBeUndefined()
  expect(listing.links?.[0].url).toBe(source.website)
  expect(nonprofitDirectoryMapItem(source, "food").resourceCategories).toEqual(["food"])
})


it("counts only the public projection using a bounded, estimated HEAD request", async () => {
  const abortSignal = vi.fn().mockResolvedValue({ count: 1_956_245, error: null })
  const select = vi.fn().mockReturnValue({ abortSignal })
  summaryFrom.mockReturnValue({ select })
  const { nonprofitSummaryGET } = await import("@/features/find-resource-index/server/nonprofit-summary")
  const response = await nonprofitSummaryGET()
  expect(summaryFrom).toHaveBeenCalledWith("nonprofit_directory_public")
  expect(select).toHaveBeenCalledWith("ein", { count: "planned", head: true })
  expect(abortSignal).toHaveBeenCalledWith(expect.any(AbortSignal))
  expect(await response.json()).toEqual({ count: 1_956_245, estimated: true })
  expect(response.headers.get("cache-control")).toContain("s-maxage=300")
})

it("does not cache a failed count or substitute a private/imported total", async () => {
  summaryFrom.mockReturnValue({ select: () => ({ abortSignal: () => Promise.resolve({ count: null, error: { code: "57014" } }) }) })
  const { nonprofitSummaryGET } = await import("@/features/find-resource-index/server/nonprofit-summary")
  const response = await nonprofitSummaryGET()
  expect(response.status).toBe(503)
  expect(response.headers.get("cache-control")).toBe("no-store")
  expect(await response.json()).not.toHaveProperty("count")
})


describe("standalone public resource pages", () => {
  it("uses stable URLs only for supported public identities", async () => {
    const { publicResourceProfileHref, publicResourceProfileItemId } = await import("@/lib/public-map/resource-profile-href")
    expect(publicResourceProfileHref("nonprofit:012345678")).toBe("/find/resources/012345678")
    expect(publicResourceProfileItemId("012345678")).toBe("nonprofit:012345678")
    const id = "47cd59b4-10dc-490b-9840-cf683e1ef9ad"
    expect(publicResourceProfileHref(`resource_map:${id}`)).toBe(`/find/resources/${id}`)
    expect(publicResourceProfileItemId(id)).toBe(`resource_map:${id}`)
    expect(publicResourceProfileHref("raw:candidate")).toBeNull()
    expect(publicResourceProfileItemId("../../private")).toBeNull()
  })

  it("reads an IRS profile through the anonymous public projection", async () => {
    rpc.mockResolvedValue({ data: item("012345678"), error: null })
    const { fetchPublicResourceProfile } = await import("@/lib/queries/public-resource-profile")
    const profile = await fetchPublicResourceProfile("012345678")
    expect(profile).toMatchObject({ id: "nonprofit:012345678", latitude: null, longitude: null, visibility: "published" })
    expect(createClient.mock.calls[0][1]).toBe("anon-only")
    expect(rpc).toHaveBeenCalledWith("get_nonprofit_directory", { p_ein: "012345678" })
  })

  it("rejects invalid IDs without querying and unavailable public identities without fallback", async () => {
    const { fetchPublicResourceProfile } = await import("@/lib/queries/public-resource-profile")
    expect(await fetchPublicResourceProfile("raw:candidate")).toBeNull()
    expect(rpc).not.toHaveBeenCalled()
    rpc.mockResolvedValue({ data: null, error: null })
    expect(await fetchPublicResourceProfile("012345678")).toBeNull()
    rpc.mockResolvedValue({ data: item("987654321"), error: null })
    expect(await fetchPublicResourceProfile("012345678")).toBeNull()
    rpc.mockResolvedValue({ data: null, error: { code: "offline" } })
    await expect(fetchPublicResourceProfile("012345678")).rejects.toThrow("temporarily unavailable")
  })
})
