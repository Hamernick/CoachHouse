import { describe, expect, it, vi } from "vitest"

import { applyPublicMapOrganizationSelection } from "@/components/public/public-map-index/use-public-map-actions"
import {
  resolvePublicMapSelectedOrganization,
  resolveSyncedPublicMapSelectedOrgId,
} from "@/components/public/public-map-index/public-map-index-runtime"
import type { PublicMapOrganization } from "@/lib/queries/public-map-index"

function buildOrganization(
  overrides: Partial<PublicMapOrganization> = {}
): PublicMapOrganization {
  return {
    id: "org-1",
    name: "Alpha Org",
    tagline: null,
    description: null,
    boilerplate: null,
    vision: null,
    mission: null,
    values: null,
    needStatement: null,
    originStory: null,
    theoryOfChange: null,
    formationStatus: null,
    contactName: null,
    logoUrl: null,
    brandMarkUrl: null,
    headerUrl: null,
    website: null,
    donateUrl: null,
    email: null,
    phone: null,
    twitter: null,
    facebook: null,
    linkedin: null,
    instagram: null,
    brandPrimary: null,
    brandColors: [],
    brandThemePresetId: null,
    brandAccentPresetId: null,
    brandTypographyPresetId: null,
    brandTypography: null,
    brandKitAvailable: false,
    latitude: 41.8781,
    longitude: -87.6298,
    address: null,
    addressStreet: null,
    addressPostal: null,
    city: "Chicago",
    state: "IL",
    country: "United States",
    locationUrl: null,
    publicSlug: "alpha-org",
    activityLinks: [],
    programPreview: null,
    programs: [],
    programCount: 0,
    groups: ["community"],
    primaryGroup: "community",
    isOnlineOnly: false,
    ...overrides,
  }
}

describe("public map actions", () => {
  it("keeps the find page unselected until an organization is explicitly selected", () => {
    const organizationById = new Map([["org-1", buildOrganization()]])

    expect(
      resolvePublicMapSelectedOrganization({
        organizationById,
        selectedOrgId: null,
      })
    ).toBeNull()
    expect(
      resolveSyncedPublicMapSelectedOrgId({
        organizationById,
        selectedOrgId: null,
      })
    ).toBeNull()
  })

  it("clears stale selected organizations instead of selecting the first available result", () => {
    const organizationById = new Map([["org-1", buildOrganization()]])

    expect(
      resolvePublicMapSelectedOrganization({
        organizationById,
        selectedOrgId: "missing-org",
      })
    ).toBeNull()
    expect(
      resolveSyncedPublicMapSelectedOrgId({
        organizationById,
        selectedOrgId: "missing-org",
      })
    ).toBeNull()
  })

  it("targets the selected organization on the map when opening mapped details", () => {
    const setSelectedOrgId = vi.fn()
    const setSidebarMode = vi.fn()
    const setCameraTargetOrgId = vi.fn()
    const setRecentOrganizationIds = vi.fn()

    applyPublicMapOrganizationSelection({
      organizationById: new Map([["org-1", buildOrganization()]]),
      organizationId: "org-1",
      openDetails: true,
      setSelectedOrgId,
      setSidebarMode,
      setCameraTargetOrgId,
      setRecentOrganizationIds,
    })

    expect(setSelectedOrgId).toHaveBeenCalledWith("org-1")
    expect(setSidebarMode).toHaveBeenCalledWith("details")
    expect(setCameraTargetOrgId).toHaveBeenCalledWith("org-1")

    const recentUpdater = setRecentOrganizationIds.mock.calls[0]?.[0] as
      | ((current: string[]) => string[])
      | undefined
    expect(recentUpdater?.(["org-2", "org-1", "org-3"])).toEqual([
      "org-1",
      "org-2",
      "org-3",
    ])
  })

  it("requests map focus for repeated explicit selections of the same organization", () => {
    const setCameraTargetOrgId = vi.fn()
    const selectionArgs = {
      organizationById: new Map([["org-1", buildOrganization()]]),
      organizationId: "org-1",
      openDetails: true,
      setSelectedOrgId: vi.fn(),
      setSidebarMode: vi.fn(),
      setCameraTargetOrgId,
      setRecentOrganizationIds: vi.fn(),
    }

    applyPublicMapOrganizationSelection(selectionArgs)
    applyPublicMapOrganizationSelection(selectionArgs)

    expect(setCameraTargetOrgId).toHaveBeenCalledTimes(2)
    expect(setCameraTargetOrgId).toHaveBeenNthCalledWith(1, "org-1")
    expect(setCameraTargetOrgId).toHaveBeenNthCalledWith(2, "org-1")
  })

  it("does not target the map when the organization has no coordinates", () => {
    const setCameraTargetOrgId = vi.fn()

    applyPublicMapOrganizationSelection({
      organizationById: new Map([
        [
          "org-1",
          buildOrganization({
            latitude: null,
            longitude: null,
          }),
        ],
      ]),
      organizationId: "org-1",
      openDetails: true,
      setSelectedOrgId: vi.fn(),
      setSidebarMode: vi.fn(),
      setCameraTargetOrgId,
      setRecentOrganizationIds: vi.fn(),
    })

    expect(setCameraTargetOrgId).not.toHaveBeenCalled()
  })
})
