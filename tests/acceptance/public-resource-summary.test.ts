import { beforeEach, expect, it, vi } from "vitest"

const sources = vi.hoisted(() => ({ nonprofits: vi.fn(), catalog: vi.fn(), organizations: vi.fn() }))
vi.mock("@/features/find-resource-index/server/nonprofit-summary", () => ({ readPublicNonprofitCount: sources.nonprofits }))
vi.mock("@/features/find-resource-index/server/catalog", () => ({ getFindResourceCatalog: sources.catalog }))
vi.mock("@/lib/queries/public-map-index", () => ({ fetchPublicMapOrganizations: sources.organizations }))

import { GET } from "@/app/api/public/resource-map/summary/route"

beforeEach(() => {
  sources.nonprofits.mockResolvedValue(1_900_000)
  sources.catalog.mockResolvedValue({ items: [{}, {}] })
  sources.organizations.mockResolvedValue([{}])
})

it("returns the combined public directory count without sending records", async () => {
  const response = await GET()
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ count: 1_900_003, estimated: true })
  expect(response.headers.get("cache-control")).toContain("s-maxage=300")
})

it.each(["nonprofits", "catalog", "organizations"] as const)("does not advertise a partial total if %s fails", async (source) => {
  sources[source].mockRejectedValueOnce(new Error("unavailable"))
  const response = await GET()
  expect(response.status).toBe(503)
  expect(response.headers.get("cache-control")).toBe("no-store")
  expect(await response.json()).not.toHaveProperty("count")
})
