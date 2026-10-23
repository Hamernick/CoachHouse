import { beforeEach, describe, expect, it, vi } from "vitest"

const { createClientMock, adminMock } = vi.hoisted(() => ({ createClientMock: vi.fn(), adminMock: vi.fn() }))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: adminMock }))
vi.mock("@supabase/supabase-js", () => ({ createClient: createClientMock }))
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown, keys: string[]) =>
  keys.includes("public-resource-profile-v1") ? async () => ({ title: "stale fixture" }) : fn }))
vi.mock("@/lib/env", () => ({ env: {
  RESOURCE_MAP_PUBLIC_DB_ENABLED: "true",
  PUBLIC_MAP_CLAIM_OWNER_USER_ID: "owner",
  NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-only",
} }))

import { fetchPublicResourceIndexSnapshot } from "@/lib/queries/resource-map-index-snapshot"
import { fetchPublicResourceMapItemById, fetchPublicResourceMapItems } from "@/lib/queries/resource-map-public-items"
import { buildExternalResourceMapItemFromPublicRow } from "@/lib/public-map/resource-map-public-item-adapter"
import { shouldShowPublicMapResourceItem } from "@/lib/public-map/resource-item-visibility"

import { searchPublicMapClaimListings } from "@/features/public-map-claims/server/search"
import { submitPublicMapClaimRequest } from "@/features/public-map-claims/server/submission"
import { fetchPublicResourceProfile } from "@/lib/queries/public-resource-profile"

const ids = ["8b2441bf-7acc-4219-b108-142167c18252", "ada4ffc9-20ce-42a6-9d92-02e44fe7ed08"]
const fixture = (id: string) => ({
  item_id: id, title: "RLS Resource Service", subtitle: "RLS Resource Org", organization_name: "RLS Resource Org",
  description: "Public approved test service.", source_url: "https://example.org/service",
  latitude: 40.7128, longitude: -74.006, address_line1: null, city: "New York", state: "NY", country: "United States",
  primary_resource_category: "food", resource_categories: ["food"],
})
const real = { ...fixture("real-place"), title: "Neighborhood Food Pantry", organization_name: "Neighborhood Food Pantry", subtitle: null, source_url: "https://pantry.test/services" }

beforeEach(() => vi.clearAllMocks())

describe("public resource test-fixture exclusion", () => {
  it.each(ids)("does not expose leaked fixture %s through a detail link", async (id) => {
    createClientMock.mockReturnValue({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: fixture(id), error: null }) }) }) }) })
    expect(await fetchPublicResourceMapItemById(`resource_map:${id}`)).toBeNull()
  })
  it("excludes test records from the compact map/catalog projection", async () => {
    const rows = [...ids.map(fixture), real]
    createClientMock.mockReturnValue({ from: () => ({ select: () => ({ order: () => ({ limit: async () => ({ data: rows, error: null }) }) }) }) })
    expect((await fetchPublicResourceIndexSnapshot()).map((item) => item.id)).toEqual(["resource_map:real-place"])
  })
  it("excludes test records from the legacy public RPC", async () => {
    createClientMock.mockReturnValue({ rpc: async () => ({ data: [...ids.map(fixture), real], error: null }) })
    expect((await fetchPublicResourceMapItems()).map((item) => item.id)).toEqual(["resource_map:real-place"])
  })
  it.each([
    { source_url: "https://real-provider.test/service" },
    { title: "RLS Community Food Pantry" },
    { subtitle: "RLS Community Center", organization_name: "RLS Community Center" },
  ])("does not suppress a real resource based on a partial fixture match: %j", (changes) => {
    const item = buildExternalResourceMapItemFromPublicRow({ ...fixture("real"), ...changes })!
    expect(shouldShowPublicMapResourceItem(item)).toBe(true)
  })
})

const targetId = "a74bfebe-7af2-4980-a371-0a7967eda380"
const claimRow = { ...fixture(ids[0]), organization_id: targetId, platform_org_id: null, source_label: "RLS fixture" }
function mockClaimRows(rows: Record<string, unknown>[]) {
  const result = { data: rows, error: null }
  const query = {
    select: vi.fn().mockReturnThis(), is: vi.fn().mockReturnThis(), not: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(), maybeSingle: async () => ({ data: rows[0], error: null }),
    then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
  }
  const rpc = vi.fn(async (name: string) => ({ data: name === "submit_public_map_claim_request"
    ? { status: "recorded", claimId: "claim" } : { ok: true }, error: null }))
  adminMock.mockReturnValue({ from: () => query, rpc })
  return rpc
}
function submitClaim() {
  return submitPublicMapClaimRequest({
    request: new Request("https://coachhouse.app/api/public/organization-claims"),
    value: { claimantEmail: "person@example.org", claimantName: "Casey Founder", listingName: "Untrusted client name",
      submissionKey: "f9ff4f91-a252-46aa-b19d-c7b8b8bf2021", targetKind: "resource_map_organization", targetId, website: "" },
  })
}

describe("claim and profile fixture boundaries", () => {
  it("removes fixture-only organizations from claim searches without suppressing partial matches", async () => {
    mockClaimRows([claimRow, { ...claimRow, organization_id: "real", source_url: "https://provider.test/service" }])
    expect(await searchPublicMapClaimListings("RLS")).toEqual([{ id: "real", name: "RLS Resource Org" }])
  })
  it("rejects direct fixture claims before recording or delivering them", async () => {
    const rpc = mockClaimRows([claimRow])
    expect(await submitClaim()).toEqual({ code: "invalid", ok: false })
    expect(rpc).not.toHaveBeenCalled()
  })
  it("allows an organization with a legitimate service after a hidden service", async () => {
    const rpc = mockClaimRows([claimRow, { ...claimRow, title: "Community Pantry" }])
    expect(await submitClaim()).toEqual({ claimId: "claim", ok: true })
    expect(rpc).toHaveBeenCalledWith("submit_public_map_claim_request", expect.objectContaining({ p_target_id: targetId, p_listing_name: "RLS Resource Org" }))
  })
  it("does not reuse a profile cached before fixture exclusion", async () => {
    createClientMock.mockReturnValue({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: fixture(ids[0]), error: null }) }) }) }) })
    expect(await fetchPublicResourceProfile(ids[0])).toBeNull()
    expect(createClientMock).toHaveBeenCalled()
  })
})
