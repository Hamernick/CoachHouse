import { beforeEach, describe, expect, it, vi } from "vitest"

const { createSupabaseAdminClientMock, envMock } = vi.hoisted(() => ({
  createSupabaseAdminClientMock: vi.fn(),
  envMock: {
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key" as string | undefined,
  },
}))

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: createSupabaseAdminClientMock,
}))
vi.mock("@/lib/env", () => ({ env: envMock }))

import { fetchPublicMapOrganizations } from "@/lib/queries/public-map-index"

function buildSupabaseAdminStub({
  organizations,
  programs,
}: {
  organizations: Array<{
    user_id: string
    profile: Record<string, unknown> | null
    location_lat: number | null
    location_lng: number | null
    public_slug: string | null
  }>
  programs: Array<{
    id: string
    user_id: string
    title: string | null
    subtitle: string | null
    description: string | null
    created_at: string | null
    image_url: string | null
    location_type: "in_person" | "online" | null
    location_url: string | null
    duration_label: string | null
    features: string[] | null
    cta_label: string | null
    cta_url: string | null
    start_date: string | null
    wizard_snapshot: Record<string, unknown> | null
  }>
}) {
  const organizationsReturns = vi
    .fn()
    .mockResolvedValue({ data: organizations, error: null })
  const programsReturns = vi
    .fn()
    .mockResolvedValue({ data: programs, error: null })
  const organizationsQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    returns: organizationsReturns,
  }

  const programsQuery = {
    select: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    returns: programsReturns,
  }

  const from = vi.fn((table: string) => {
    if (table === "organizations") return organizationsQuery
    if (table === "programs") return programsQuery
    throw new Error(`Unexpected table: ${table}`)
  })

  return {
    supabase: { from, rpc: vi.fn(async (_name: string, args: { p_ids: string[] }) => ({ data: args.p_ids, error: null })) },
    calls: {
      from,
      organizationsQuery,
      programsQuery,
      organizationsReturns,
      programsReturns,
    },
  }
}

describe("fetchPublicMapOrganizations", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    envMock.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key"
  })

  it("returns an empty directory when the admin client is not configured", async () => {
    envMock.SUPABASE_SERVICE_ROLE_KEY = undefined

    await expect(fetchPublicMapOrganizations()).resolves.toEqual([])
    expect(createSupabaseAdminClientMock).not.toHaveBeenCalled()
  })

  it("removes a formerly published projection on fresh closure admission", async () => {
    const { supabase } = buildSupabaseAdminStub({ organizations: [{ user_id: "closing", profile: { name: "Closed" }, location_lat: null, location_lng: null, public_slug: "closed" }], programs: [] })
    createSupabaseAdminClientMock.mockReturnValue(supabase)
    expect(await fetchPublicMapOrganizations()).toHaveLength(1)
    supabase.rpc.mockResolvedValueOnce({ data: [], error: null })
    expect(await fetchPublicMapOrganizations()).toEqual([])
  })

  it("returns published orgs even when coordinates are missing", async () => {
    const { supabase, calls } = buildSupabaseAdminStub({
      organizations: [
        {
          user_id: "org-with-marker",
          profile: {
            name: "Atlas Org",
            tagline: "In-person programs",
            formationStatus: "approved",
            origin_story:
              "Atlas began after local caregivers lost support access.",
            theory_of_change:
              "Pair trained neighbors with recurring care circles.",
            address_street: "123 Main St",
            address_city: "Brooklyn",
            address_state: "NY",
            address_country: "United States",
          },
          location_lat: 40.6782,
          location_lng: -73.9442,
          public_slug: "atlas-org",
        },
        {
          user_id: "org-without-marker",
          profile: {
            name: "Beacon Org",
            tagline: "Public profile without address",
            originStory: "Beacon launched from a mutual aid pilot.",
            theoryOfChange:
              "Shared onboarding and referrals improve continuity.",
            location_type: "online",
            location_url: "https://beacon.org/visit",
          },
          location_lat: null,
          location_lng: null,
          public_slug: "beacon-org",
        },
      ],
      programs: [
        {
          id: "program-1",
          user_id: "org-with-marker",
          title: "Neighborhood Workshops",
          subtitle: "Weekly support",
          description: "Workshops for neighborhood caregivers.",
          created_at: "2026-03-01T00:00:00.000Z",
          image_url: null,
          location_type: "in_person",
          location_url: "https://atlas.org/workshops",
          duration_label: "12 months",
          features: [],
          cta_label: "Join",
          cta_url: "https://atlas.org/join",
          start_date: "2026-03-01T00:00:00.000Z",
          wizard_snapshot: {
            objectKind: "Event",
            oneSentence: "Public workshops for neighborhood caregivers.",
            programType: "Training & Capacity Building",
            durationLabel: "12 months",
            bannerImageUrl: "https://atlas.org/banner.jpg",
          },
        },
        {
          id: "program-2",
          user_id: "org-without-marker",
          title: "Remote Office Hours",
          subtitle: "Open to all",
          description: null,
          created_at: "2026-03-02T00:00:00.000Z",
          image_url: null,
          location_type: "online",
          location_url: "https://beacon.org/office-hours",
          duration_label: null,
          features: [],
          cta_label: "Open",
          cta_url: null,
          start_date: null,
          wizard_snapshot: {
            objectKind: "Web resource",
            coreFormat: "Digital",
          },
        },
      ],
    })

    createSupabaseAdminClientMock.mockReturnValue(supabase)

    const organizations = await fetchPublicMapOrganizations()

    expect(calls.from).toHaveBeenCalledWith("organizations")
    expect(calls.from).toHaveBeenCalledWith("programs")
    expect(calls.from).not.toHaveBeenCalledWith(
      "organization_public_resource_evidence"
    )
    expect(calls.organizationsQuery.eq).toHaveBeenCalledWith("is_public", true)
    expect(calls.programsQuery.eq).toHaveBeenCalledWith("is_public", true)

    expect(organizations).toHaveLength(2)
    expect(organizations.map((organization) => organization.name)).toEqual([
      "Atlas Org",
      "Beacon Org",
    ])

    expect(
      organizations.find(
        (organization) => organization.id === "org-with-marker"
      )
    ).toMatchObject({
      publicSlug: "atlas-org",
      formationStatus: "approved",
      latitude: 40.6782,
      longitude: -73.9442,
      city: "Brooklyn",
      state: "NY",
      country: "United States",
      originStory:
        "<p>Atlas began after local caregivers lost support access.</p>",
      theoryOfChange:
        "<p>Pair trained neighbors with recurring care circles.</p>",
      programPreview: {
        activityKind: "Event",
        ctaLabel: "Join",
        ctaUrl: "https://atlas.org/join",
        description: "Public workshops for neighborhood caregivers.",
        durationLabel: "12 months",
        id: "program-1",
        imageUrl: "https://atlas.org/banner.jpg",
        locationUrl: "https://atlas.org/workshops",
        title: "Neighborhood Workshops",
      },
    })

    expect(
      organizations.find(
        (organization) => organization.id === "org-without-marker"
      )
    ).toMatchObject({
      publicSlug: "beacon-org",
      latitude: null,
      longitude: null,
      isOnlineOnly: true,
      locationUrl: "https://beacon.org/visit",
      originStory: "<p>Beacon launched from a mutual aid pilot.</p>",
      theoryOfChange:
        "<p>Shared onboarding and referrals improve continuity.</p>",
      programPreview: {
        activityKind: "Web resource",
        ctaLabel: "Open",
        locationUrl: "https://beacon.org/office-hours",
        id: "program-2",
        title: "Remote Office Hours",
      },
    })
  })

  it("keeps all activity links even when visual activity previews are capped", async () => {
    const programs = Array.from({ length: 7 }, (_, index) => {
      const activityNumber = index + 1
      return {
        id: `program-${activityNumber}`,
        user_id: "org-with-many-activities",
        title:
          activityNumber === 7
            ? "Older Climate Resource Library"
            : `Recent Activity ${activityNumber}`,
        subtitle: null,
        description: null,
        created_at: `2026-03-${String(10 - index).padStart(2, "0")}T00:00:00.000Z`,
        image_url: null,
        location_type: "online" as const,
        location_url:
          activityNumber === 7 ? "https://resource.example.org/library" : null,
        duration_label: activityNumber === 7 ? "Ongoing" : null,
        features: [],
        cta_label: activityNumber === 7 ? "Open library" : null,
        cta_url:
          activityNumber === 7 ? "https://resource.example.org/open" : null,
        start_date: null,
        wizard_snapshot: {
          objectKind: activityNumber === 7 ? "Web resource" : "Program",
        },
      }
    })
    const { supabase } = buildSupabaseAdminStub({
      organizations: [
        {
          user_id: "org-with-many-activities",
          profile: {
            name: "Resource Dense Org",
            location_type: "online",
          },
          location_lat: null,
          location_lng: null,
          public_slug: "resource-dense-org",
        },
      ],
      programs,
    })

    createSupabaseAdminClientMock.mockReturnValue(supabase)

    const [organization] = await fetchPublicMapOrganizations()

    expect(organization?.programCount).toBe(7)
    expect(organization?.programs).toHaveLength(6)
    expect(organization?.programs.map((program) => program.id)).not.toContain(
      "program-7"
    )
    expect(organization?.activityLinks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "program-7",
          title: "Older Climate Resource Library",
          activityKind: "Web resource",
          ctaLabel: "Open library",
          ctaUrl: "https://resource.example.org/open",
          durationLabel: "Ongoing",
          locationUrl: "https://resource.example.org/library",
        }),
      ])
    )
    expect(organization?.groups).toContain("climate")
    expect(organization?.primaryGroup).toBe("climate")
  })
})
