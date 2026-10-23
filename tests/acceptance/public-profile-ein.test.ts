import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { admin, publicClient, query, result } = vi.hoisted(() => {
  const result = { data: [] as Array<{ id: string; ein: string | null }>, error: null as { code: string } | null }
  const query = {
    select: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(), is: vi.fn().mockReturnThis(),
    then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
  }
  return { admin: vi.fn(() => ({ from: vi.fn(() => query) })), publicClient: vi.fn(), query, result }
})
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: admin }))
vi.mock("@supabase/supabase-js", () => ({ createClient: publicClient }))
vi.mock("@/lib/env", () => ({ env: { SUPABASE_SERVICE_ROLE_KEY: "test-only", RESOURCE_MAP_PUBLIC_DB_ENABLED: "true" } }))

import { formatEin, normalizeEin } from "@/lib/organization/ein"
import { PublicProfileEin } from "@/components/public/public-profile-ein"
import { projectPublicMapOrganizations } from "@/lib/public-map/organization-projection"
import { buildExternalResourceMapItemFromPublicRow } from "@/lib/public-map/resource-map-public-item-adapter"
import { withPublicResourceEins } from "@/lib/queries/public-resource-ein"
import { fetchPublicResourceMapItemById } from "@/lib/queries/resource-map-public-items"
import { PublicMapResourceDetail } from "@/components/public/public-map-index/resource-detail"

const itemId = "8b2441bf-7acc-4219-b108-142167c18252"
const row = { item_id: itemId, title: "Community Pantry", organization_id: "public-org", organization_name: "Community Group" }
const item = () => buildExternalResourceMapItemFromPublicRow(row)!

beforeEach(() => { vi.clearAllMocks(); result.data = []; result.error = null })

describe("public profile EIN display", () => {
  it.each(["012345678", "01-2345678", " 01-2345678 "])("preserves leading zeroes in %s", (value) => {
    expect(normalizeEin(value)).toBe("012345678")
    expect(formatEin(value)).toBe("01-2345678")
    expect(renderToStaticMarkup(React.createElement(PublicProfileEin, { value }))).toContain("EIN 01-2345678")
  })
  it.each([null, undefined, "", "12345678", "1234567890", "EIN 012345678", "12x3456789", 123456789])("hides malformed or missing value %s", (value) => {
    expect(normalizeEin(value)).toBeNull()
    expect(renderToStaticMarkup(React.createElement(PublicProfileEin, { value }))).toBe("")
  })
  it.each([undefined, "pre_501c3", "in_progress"])("shows the EIN without implying 501(c)(3) verification for %s", (formationStatus) => {
    const html = renderToStaticMarkup(React.createElement(PublicProfileEin, { value: "01-2345678", formationStatus }))
    expect(html).toContain("EIN 01-2345678")
    expect(html).not.toContain('aria-label="Verified"')
  })
  it("shows the existing blue Verified badge only with approved status and an EIN", () => {
    const html = renderToStaticMarkup(React.createElement(PublicProfileEin, { value: "01-2345678", formationStatus: "approved" }))
    expect(html).toContain('aria-label="Verified"')
    expect(html).toContain("text-blue-600")
    expect(renderToStaticMarkup(React.createElement(PublicProfileEin, { value: null, formationStatus: "approved" }))).toBe("")
  })
  it("uses the canonical organization EIN, without reviving stale profile data", () => {
    const base = { user_id: "org", profile: { name: "Community Group", ein: "98-7654321" }, location_lat: null, location_lng: null, public_slug: "community-group" }
    expect(projectPublicMapOrganizations([{ ...base, ein: "01-2345678" }], [])[0].ein).toBe("012345678")
    expect(projectPublicMapOrganizations([{ ...base, ein: null }], [])[0].ein).toBeNull()
  })
  it("shows an IRS EIN once across the complete profile", () => {
    const nonprofit = { ein: "012345678", websiteSourcePeriod: null, phoneSourcePeriod: null, descriptionSourcePeriod: null, websiteBasis: null, phoneBasis: null }
    const html = renderToStaticMarkup(React.createElement(PublicMapResourceDetail, { item: { ...item(), nonprofit }, standalone: true, onBack: () => {} }))
    expect(html.match(/EIN 01-2345678/g)).toHaveLength(1)
    expect(html).not.toContain('aria-label="Verified"')
    expect(html).toContain("01-2345678")
  })
  it("reads only the EIN for the exact public organization and retains publication gates", async () => {
    result.data = [{ id: "public-org", ein: "01-2345678" }, { id: "unrelated-org", ein: "98-7654321" }]
    expect((await withPublicResourceEins([item()]))[0].ein).toBe("012345678")
    expect(query.select).toHaveBeenCalledWith("id, ein")
    expect(query.in).toHaveBeenCalledWith("id", ["public-org"])
    expect(query.eq).toHaveBeenCalledWith("visibility", "published")
    expect(query.in).toHaveBeenCalledWith("review_status", ["approved", "verified"])
    expect(query.not).toHaveBeenCalledWith("approved_at", "is", null)
    for (const column of ["hidden_at", "suppressed_at", "deleted_at"]) expect(query.is).toHaveBeenCalledWith(column, null)
  })
  it("does not borrow an EIN when the identity lookup excludes or omits the organization", async () => {
    result.data = [{ id: "unrelated-org", ein: "98-7654321" }]
    expect((await withPublicResourceEins([item()]))[0].ein).toBeNull()
  })
  it("does not fetch identity fields for nonexistent or hidden public resource rows", async () => {
    publicClient.mockReturnValue({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) })
    expect(await fetchPublicResourceMapItemById(`resource_map:${itemId}`)).toBeNull()
    expect(admin).not.toHaveBeenCalled()
  })
  it("includes an existing EIN on the selected public resource detail", async () => {
    publicClient.mockReturnValue({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }) }) }) })
    result.data = [{ id: "public-org", ein: "01-2345678" }]
    expect((await fetchPublicResourceMapItemById(`resource_map:${itemId}`))?.ein).toBe("012345678")
  })
})
