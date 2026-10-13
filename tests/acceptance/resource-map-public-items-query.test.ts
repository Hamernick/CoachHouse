import { readPublicResourceIndexPage, PUBLIC_RESOURCE_INDEX_COLUMNS } from "@/lib/queries/resource-map-index-snapshot"
import { afterEach, describe, expect, it, vi } from "vitest"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import type { ResourceMapPublicItemsView } from "@/lib/supabase/schema/views"

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
}))

vi.mock("@supabase/supabase-js", () => ({
  createClient: createClientMock,
}))

import { buildExternalResourceMapItemFromPublicRow } from "@/lib/public-map/resource-map-public-item-adapter"
import { serializeFindResourceDetailItem } from "@/features/find-resource-index"
import { resolveResourceAvailability } from "@/lib/public-map/resource-availability"
import {
  clearResourceMapLocalPreviewCache,
  fetchPublicResourceMapItemById,
  fetchPublicResourceMapItems,
  fetchPublicResourceMapItemsPageById,
  isResourceMapPublicDbEnabled,
} from "@/lib/queries/resource-map-public-items"

function buildPublicResourceRow(
  overrides: Partial<ResourceMapPublicItemsView["Row"]> = {}
): ResourceMapPublicItemsView["Row"] {
  return {
    item_id: "service-food-1",
    item_type: "external_resource",
    organization_id: "resource-org-1",
    service_id: "service-food-1",
    platform_org_id: null,
    title: "Community Food Pantry",
    subtitle: null,
    description: "Weekly groceries and meal support.",
    organization_name: "Neighborhood Resource Hub",
    organization_tagline: "Local care coordination",
    organization_description: "A public resource organization.",
    website_url: "https://resource.example.org",
    donate_url: null,
    logo_url: "https://resource.example.org/logo.png",
    favicon_url: "https://resource.example.org/favicon.ico",
    mission: "Keep neighbors fed.",
    vision: null,
    values: ["dignity", "access"],
    aliases: ["NRH"],
    service_kind: "service",
    delivery_modes: ["in_person", "invalid-mode"],
    eligibility: "Open to local residents.",
    cost: "Free",
    who_it_helps: "Families",
    insurance_accepted: null,
    intake_url: "https://resource.example.org/intake",
    appointment_info: "Walk-in",
    documents_needed: ["Photo ID if available"],
    accessibility_notes: "Wheelchair accessible",
    urgent_availability: "Same-day pantry hours",
    languages: ["English", "Spanish"],
    hours: { label: "Weekdays 9-5" },
    timezone: "America/Chicago",
    appointment_required: false,
    availability_status: "available",
    availability_notes: "Call before visiting during severe weather.",
    temporary_closed_until: null,
    location_hours: {},
    coverage_area: ["Cook County"],
    minimum_age: 18,
    maximum_age: null,
    location_type: "physical",
    address_line1: "123 Pantry Ave",
    address_line2: "Suite 4",
    city: "Chicago",
    state: "IL",
    county: "Cook",
    postal_code: "60601",
    country: "United States",
    latitude: 41.8781,
    longitude: -87.6298,
    geocoding_accuracy: "rooftop",
    service_radius_miles: null,
    location_url: "https://maps.example.org/pantry",
    resource_categories: ["unknown", "food"],
    primary_resource_category: "food",
    public_contacts: [
      {
        id: "contact-1",
        type: "phone",
        label: "Pantry desk",
        value: "+13125550123",
        url: "tel:+13125550123",
        isPrimary: true,
      },
    ],
    public_links: [
      {
        id: "link-1",
        type: "website",
        label: "Website",
        url: "https://resource.example.org",
        domain: "resource.example.org",
        isPrimary: true,
      },
      {
        id: "link-logo",
        type: "logo",
        label: "Logo asset",
        url: "https://resource.example.org/logo.png",
        domain: "resource.example.org",
        isPrimary: false,
      },
      {
        id: "link-arcgis-query",
        type: "source",
        label: "Raw data endpoint",
        url: "https://services2.arcgis.com/example/arcgis/rest/services/Warming_and_Cooling_Centers/FeatureServer/0/query?where=1%3D1&outFields=*&returnGeometry=true&outSR=4326&f=json",
        domain: "services2.arcgis.com",
        isPrimary: false,
      },
    ],
    source_label: "City open data",
    source_url: "https://data.example.org/resources",
    source_attribution: "City dataset",
    verification_status: "external_data",
    last_verified_at: "2026-06-26T20:00:00.000Z",
    last_updated_at: "2026-06-26T20:05:00.000Z",
    ...overrides,
  }
}

describe("resource map public item adapter", () => {
  it("maps sanitized public rows into external resource map items", () => {
    const item = buildExternalResourceMapItemFromPublicRow(
      buildPublicResourceRow()
    )

    expect(item).toMatchObject({
      id: "resource_map:service-food-1",
      itemType: "external_resource",
      title: "Community Food Pantry",
      subtitle: "Neighborhood Resource Hub",
      description: "Weekly groceries and meal support.",
      latitude: 41.8781,
      longitude: -87.6298,
      addressStreet: "123 Pantry Ave, Suite 4",
      city: "Chicago",
      state: "IL",
      orgCategory: null,
      resourceCategories: ["food"],
      primaryResourceCategory: "food",
      verificationStatus: "external_data",
      sourceLabel: "City open data",
      sourceUrl: "https://data.example.org/resources",
      markerImageUrl: "https://resource.example.org/logo.png",
      deliveryModes: ["in_person"],
      hoursLabel: "Weekdays 9-5",
      availability: expect.objectContaining({
        timezone: "America/Chicago",
        label: "Weekdays 9-5",
        notes: "Call before visiting during severe weather.",
        appointmentRequired: false,
      }),
      lastUpdatedAt: "2026-06-26T20:05:00.000Z",
    })
    expect(item?.links).toEqual([
      expect.objectContaining({ id: "link-1", type: "website" }),
      expect.objectContaining({ id: "link-logo", type: "other" }),
    ])
    expect(item?.links).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "link-arcgis-query" }),
      ])
    )
    expect(item?.contacts).toEqual([
      expect.objectContaining({
        id: "contact-1",
        type: "phone",
        value: "+13125550123",
      }),
    ])
    expect(item?.services?.[0]).toMatchObject({
      title: "Community Food Pantry",
      eligibility: "Open to local residents.",
      documentsNeeded: ["Photo ID if available"],
      ageRange: "Ages 18+",
      serviceArea: ["Cook County"],
      availability: expect.objectContaining({
        timezone: "America/Chicago",
      }),
    })
  })

  it("suppresses duplicate public resource subtitles during adaptation", () => {
    const item = buildExternalResourceMapItemFromPublicRow(
      buildPublicResourceRow({
        organization_name: "Community Food Pantry",
        subtitle: "  Community   Food Pantry  ",
      })
    )

    expect(item?.title).toBe("Community Food Pantry")
    expect(item?.subtitle).toBeNull()
  })

  it("normalizes stale cooling-center rows away from broad emergency labels", () => {
    const item = buildExternalResourceMapItemFromPublicRow(
      buildPublicResourceRow({
        title: "Amundsen Park cooling center",
        resource_categories: [
          "emergency",
          "emergency_cooling_centers",
          "community",
        ],
        primary_resource_category: "emergency",
      })
    )

    expect(item).toMatchObject({
      resourceCategories: ["emergency_cooling_centers", "community"],
      primaryResourceCategory: "emergency_cooling_centers",
    })
    expect(item?.resourceCategories).not.toContain("emergency")
  })

  it("serializes public resource map transport items without dead preview payload", () => {
    const technicalSourceUrl =
      "https://services2.arcgis.com/example/arcgis/rest/services/Warming_and_Cooling_Centers/FeatureServer/0/query?where=1%3D1&outFields=*&returnGeometry=true&outSR=4326&f=json"
    const overpassSourceUrl =
      "https://overpass-api.de/api/interpreter?data=%5Bout%3Ajson%5D%3Bout%3B"
    const socrataSourceUrl =
      "https://data.cityofchicago.org/resource/msrk-w9ih.json?$limit=500"
    const wikidataSourceUrl = "http://www.wikidata.org/entity/Q5971402"
    const item = buildExternalResourceMapItemFromPublicRow(
      buildPublicResourceRow({
        availability_notes: null,
        source_url: technicalSourceUrl,
      })
    )
    expect(item).not.toBeNull()

    const serialized = serializeFindResourceDetailItem({
      ...item!,
      aliases: [],
      availability: {
        appointmentRequired: false,
        label: null,
        nextCloseAt: null,
        nextOpenAt: null,
        notes: null,
        openNow: null,
        sourceStatus: null,
        status: "unknown",
        statusLabel: "Unknown",
        temporaryClosedUntil: null,
        timezone: null,
      },
      deliveryModes: [],
      markerImageUrl: null,
      sourceUrl: technicalSourceUrl,
    })

    expect(serialized.sourceUrl).toBeNull()
    expect(
      serializeFindResourceDetailItem({
        ...item!,
        sourceUrl: overpassSourceUrl,
      }).sourceUrl
    ).toBeNull()
    expect(
      serializeFindResourceDetailItem({
        ...item!,
        sourceUrl: socrataSourceUrl,
      }).sourceUrl
    ).toBeNull()
    expect(
      serializeFindResourceDetailItem({
        ...item!,
        sourceUrl: wikidataSourceUrl,
      }).sourceUrl
    ).toBeNull()
    expect(serialized.availability).toBeUndefined()
    expect(serialized.links?.length).toBeGreaterThan(0)
    expect(serialized.services).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eligibility: expect.any(String),
        }),
      ])
    )
    expect("aliases" in serialized).toBe(false)
    expect("deliveryModes" in serialized).toBe(false)
    expect("markerImageUrl" in serialized).toBe(false)
  })

  it("drops invalid rows before they reach the public map", () => {
    expect(
      buildExternalResourceMapItemFromPublicRow(
        buildPublicResourceRow({ item_id: "" })
      )
    ).toBeNull()
    expect(
      buildExternalResourceMapItemFromPublicRow(
        buildPublicResourceRow({ title: " " })
      )
    ).toBeNull()
  })
})

describe("resource map availability", () => {
  it("computes open now next close and closed next open from structured hours", () => {
    const hours = {
      label: "Mon-Fri 9-5",
      weekly: [
        {
          days: ["monday", "tuesday", "wednesday", "thursday", "friday"],
          opensAt: "09:00",
          closesAt: "17:00",
        },
      ],
    }

    const open = resolveResourceAvailability({
      hours,
      timezone: "America/Chicago",
      now: new Date("2026-06-29T16:00:00.000Z"),
    })
    const closed = resolveResourceAvailability({
      hours,
      timezone: "America/Chicago",
      now: new Date("2026-06-29T23:00:00.000Z"),
    })

    expect(open).toMatchObject({
      status: "open",
      statusLabel: "Open now",
      openNow: true,
      nextCloseAt: "2026-06-29T22:00:00.000Z",
    })
    expect(closed).toMatchObject({
      status: "closed",
      statusLabel: "Closed",
      openNow: false,
      nextOpenAt: "2026-06-30T14:00:00.000Z",
    })
  })

  it("honors appointment-only and temporary closure states", () => {
    expect(
      resolveResourceAvailability({
        hours: { alwaysOpen: true },
        timezone: "America/Chicago",
        appointmentRequired: true,
        now: new Date("2026-06-29T16:00:00.000Z"),
      })
    ).toMatchObject({
      status: "appointment_required",
      statusLabel: "Open now, appointment required",
      openNow: true,
    })

    expect(
      resolveResourceAvailability({
        hours: { alwaysOpen: true },
        timezone: "America/Chicago",
        availabilityStatus: "temporarily_closed",
        temporaryClosedUntil: "2026-07-01T16:00:00.000Z",
        now: new Date("2026-06-29T16:00:00.000Z"),
      })
    ).toMatchObject({
      status: "temporarily_closed",
      statusLabel: "Temporarily closed",
      openNow: false,
    })
  })
})

describe("fetchPublicResourceMapItems", () => {
  afterEach(() => {
    clearResourceMapLocalPreviewCache()
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  it("stays disabled unless the server-side flag is explicit", async () => {
    expect(isResourceMapPublicDbEnabled("true")).toBe(true)
    expect(isResourceMapPublicDbEnabled(" TRUE ")).toBe(true)
    expect(isResourceMapPublicDbEnabled("false")).toBe(false)
    expect(isResourceMapPublicDbEnabled(undefined)).toBe(false)

    await expect(
      fetchPublicResourceMapItems({
        enabled: false,
        localEnginePreviewFile: null,
      })
    ).resolves.toEqual([])
    expect(createClientMock).not.toHaveBeenCalled()
  })

  it("uses only the sanitized paginated public RPC when enabled", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [buildPublicResourceRow()],
      error: null,
    })
    const from = vi.fn()
    createClientMock.mockReturnValue({ from, rpc })

    const items = await fetchPublicResourceMapItems({
      enabled: true,
      localEnginePreviewFile: null,
      limit: 25,
    })

    expect(items.map((item) => item.id)).toEqual([
      "resource_map:service-food-1",
    ])
    expect(rpc).toHaveBeenCalledWith("get_resource_map_public_items_page", {
      p_category_keys: null,
      p_latitude: null,
      p_limit: 25,
      p_longitude: null,
      p_offset: 0,
      p_query: null,
      p_radius_miles: null,
    })
    expect(from).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalledWith(
      expect.stringContaining("resource_map_import_records"),
      expect.anything()
    )
  })

  it("loads one detail item from the sanitized public view", async () => {
    const itemId = "0072e21f-c0ce-4544-9bd4-40a75be58794"
    const maybeSingle = vi.fn().mockResolvedValue({
      data: buildPublicResourceRow({ item_id: itemId }),
      error: null,
    })
    const eq = vi.fn().mockReturnValue({ maybeSingle })
    const select = vi.fn().mockReturnValue({ eq })
    const from = vi.fn().mockReturnValue({ select })
    createClientMock.mockReturnValue({ from })

    const item = await fetchPublicResourceMapItemById(
      `resource_map:${itemId}`,
      {
        enabled: true,
        localEnginePreviewFile: null,
        localPreviewFile: null,
      }
    )

    expect(item).toMatchObject({
      id: `resource_map:${itemId}`,
      title: "Community Food Pantry",
    })
    expect(from).toHaveBeenCalledWith("resource_map_public_items")
    expect(select).toHaveBeenCalledWith("*")
    expect(eq).toHaveBeenCalledWith("item_id", itemId)
    expect(maybeSingle).toHaveBeenCalledOnce()
  })

  it("rejects malformed production item IDs without querying the view", async () => {
    await expect(
      fetchPublicResourceMapItemById("resource_map:missing", {
        enabled: true,
        localEnginePreviewFile: null,
        localPreviewFile: null,
      })
    ).resolves.toBeNull()

    expect(createClientMock).not.toHaveBeenCalled()
  })

  it("loads one bounded index page directly from the sanitized view", async () => {
    const cursorId = "0072e21f-c0ce-4544-9bd4-40a75be58794"
    const nextId = "1072e21f-c0ce-4544-9bd4-40a75be58794"
    const gt = vi.fn().mockResolvedValue({
      data: [buildPublicResourceRow({ item_id: nextId })],
      error: null,
      count: 853,
    })
    const limit = vi.fn().mockReturnValue({ gt })
    const order = vi.fn().mockReturnValue({ limit })
    const select = vi.fn().mockReturnValue({ order })
    const from = vi.fn().mockReturnValue({ select })
    createClientMock.mockReturnValue({ from })

    const page = await fetchPublicResourceMapItemsPageById({
      cursor: `resource_map:${cursorId}`,
      limit: 200,
      options: {
        enabled: true,
        localEnginePreviewFile: null,
        localPreviewFile: null,
      },
    })

    expect(page).toMatchObject({
      totalCount: 853,
      items: [{ id: `resource_map:${nextId}` }],
    })
    expect(select).toHaveBeenCalledWith("*", { count: "exact" })
    expect(order).toHaveBeenCalledWith("item_id", { ascending: true })
    expect(limit).toHaveBeenCalledWith(201)
    expect(gt).toHaveBeenCalledWith("item_id", cursorId)
  })

  it("loads more than 1,000 approved resources without truncation", async () => {
    const rows = Array.from({ length: 1205 }, (_, index) =>
      buildPublicResourceRow({
        item_id: `service-${index + 1}`,
        service_id: `service-${index + 1}`,
        title: `Resource ${index + 1}`,
      })
    )
    const rpc = vi
      .fn()
      .mockImplementation(
        (_name: string, args: { p_limit: number; p_offset: number }) =>
          Promise.resolve({
            data: rows.slice(args.p_offset, args.p_offset + args.p_limit),
            error: null,
          })
      )
    createClientMock.mockReturnValue({ rpc })

    const items = await fetchPublicResourceMapItems({
      enabled: true,
      localEnginePreviewFile: null,
      limit: 1205,
    })

    expect(items).toHaveLength(1205)
    expect(rpc).toHaveBeenCalledTimes(3)
    expect(rpc.mock.calls.map((call) => call[1].p_offset)).toEqual([
      0, 500, 1000,
    ])
  }, 15_000)

  it("can render scraped JSONL locally before anything is uploaded to Supabase", async () => {
    const directory = mkdtempSync(join(tmpdir(), "resource-map-preview-"))
    const previewFile = join(directory, "scraped.jsonl")
    writeFileSync(
      previewFile,
      [
        JSON.stringify({
          sourceRecordId: "scraped-food-1",
          sourceName: "Local scrape",
          sourceUrl: "https://example.org/pantry",
          extractedFields: {
            organizationName: "Neighborhood Pantry",
            title: "Friday food pantry",
            description: "Groceries and prepared meals.",
            category: "food pantry",
            latitude: "41.8781",
            longitude: "-87.6298",
            address: "123 Local Ave, Chicago, IL",
            city: "Chicago",
            state: "IL",
            phone: "312-555-0100",
            websiteUrl: "example.org/pantry",
            deliveryModes: ["in person"],
          },
        }),
        JSON.stringify({
          sourceRecordId: "scraped-clinic-1",
          sourceName: "Local scrape",
          extractedFields: {
            organizationName: "Community Clinic",
            title: "Walk-in clinic",
            category: "health",
          },
        }),
        JSON.stringify({
          sourceRecordId: "Q5971402",
          sourceName: "Wikidata - Chicago public resources",
          sourceUrl: "http://www.wikidata.org/entity/Q5971402",
          extractedFields: {
            organizationName: "IIT Stuart School of Business",
            title: "IIT Stuart School of Business",
            description: "business school of Illinois Institute of Technology",
            category: "education",
            websiteUrl: "http://www.stuart.iit.edu",
          },
        }),
        JSON.stringify({
          sourceRecordId: "Q2257594",
          sourceName: "Wikidata - Chicago public resources",
          sourceUrl: "http://www.wikidata.org/entity/Q2257594",
          extractedFields: {
            organizationName: "Moody Bible Institute",
            title: "Moody Bible Institute",
            description: "Bible institute",
            category: "organizations",
            websiteUrl: "http://www.moody.edu",
          },
        }),
        JSON.stringify({
          sourceRecordId: "Q7611082",
          sourceName: "Wikidata - Chicago public resources",
          sourceUrl: "http://www.wikidata.org/entity/Q7611082",
          extractedFields: {
            organizationName: "Steppenwolf Theatre Company",
            title: "Steppenwolf Theatre Company",
            description:
              "theater and theater company in Chicago, Illinois, United States",
            category: "education",
          },
        }),
      ].join("\n")
    )

    try {
      const items = await fetchPublicResourceMapItems({
        enabled: true,
        localPreviewFile: previewFile,
      })

      expect(createClientMock).not.toHaveBeenCalled()
      expect(items).toHaveLength(2)
      expect(items.map((item) => item.title)).not.toContain(
        "IIT Stuart School of Business"
      )
      expect(items.map((item) => item.title)).not.toContain(
        "Moody Bible Institute"
      )
      expect(items.map((item) => item.title)).not.toContain(
        "Steppenwolf Theatre Company"
      )
      expect(items[0]).toMatchObject({
        id: "local_resource_map:scraped-food-1",
        itemType: "external_resource",
        title: "Friday food pantry",
        subtitle: "Neighborhood Pantry",
        latitude: 41.8781,
        longitude: -87.6298,
        primaryResourceCategory: "food",
        verificationStatus: "external_data",
        visibility: "superadmin_preview",
        sourceLabel: "Local scrape",
        sourceUrl: "https://example.org/pantry",
      })
      expect(items[0]?.links).toEqual([
        expect.objectContaining({
          type: "website",
          url: "https://example.org/pantry",
        }),
      ])
      expect(items[0]?.contacts).toEqual([
        expect.objectContaining({
          type: "phone",
          value: "312-555-0100",
        }),
      ])

      const discoveryPreviewItems = await fetchPublicResourceMapItems({
        enabled: true,
        includeDiscoveryCandidates: true,
        localPreviewFile: previewFile,
      })
      expect(discoveryPreviewItems).toHaveLength(5)
      expect(discoveryPreviewItems.map((item) => item.title)).toEqual(
        expect.arrayContaining([
          "IIT Stuart School of Business",
          "Moody Bible Institute",
          "Steppenwolf Theatre Company",
        ])
      )
      expect(
        discoveryPreviewItems.filter((item) =>
          item.sourceLabel?.toLowerCase().includes("wikidata")
        )
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ visibility: "superadmin_preview" }),
        ])
      )
    } finally {
      rmSync(directory, { force: true, recursive: true })
    }
  })

  it("keeps cached local preview pages coherent and invalidates changed files", async () => {
    const directory = mkdtempSync(join(tmpdir(), "resource-map-page-cache-"))
    const previewFile = join(directory, "preview.jsonl")
    const buildPreviewRows = (count: number) =>
      Array.from({ length: count }, (_, index) =>
        JSON.stringify({
          sourceRecordId: `cached-resource-${index + 1}`,
          sourceName: "Local cache test",
          sourceUrl: `https://example.org/resource-${index + 1}`,
          extractedFields: {
            organizationName: `Cached organization ${index + 1}`,
            title: `Cached resource ${index + 1}`,
            description: "Locally reviewed public resource.",
            category: "food pantry",
          },
        })
      ).join("\n")

    try {
      writeFileSync(previewFile, buildPreviewRows(3))
      const options = {
        enabled: true,
        includeDiscoveryCandidates: true,
        localPreviewFile: previewFile,
      }

      const firstPage = await fetchPublicResourceMapItemsPageById({
        cursor: null,
        limit: 1,
        options,
      })
      const secondPage = await fetchPublicResourceMapItemsPageById({
        cursor: firstPage.items[0]?.id ?? null,
        limit: 1,
        options,
      })

      expect(firstPage.totalCount).toBe(3)
      expect(secondPage.totalCount).toBe(3)

      writeFileSync(previewFile, buildPreviewRows(4))
      const refreshedPage = await fetchPublicResourceMapItemsPageById({
        cursor: null,
        limit: 1,
        options,
      })

      expect(refreshedPage.totalCount).toBe(4)
    } finally {
      rmSync(directory, { force: true, recursive: true })
    }
  })

  it("never loads the raw candidate intake queue as an implicit public preview", async () => {
    await expect(
      fetchPublicResourceMapItems({ enabled: false })
    ).resolves.toEqual([])
    expect(createClientMock).not.toHaveBeenCalled()
  })

  it("can render local engine candidate records before seed fallback", async () => {
    const directory = mkdtempSync(join(tmpdir(), "resource-map-engine-"))
    const previewFile = join(directory, "candidate-records.jsonl")
    writeFileSync(
      previewFile,
      JSON.stringify({
        sourceRecordId: "engine-legal-1",
        sourceName: "Local engine",
        sourceUrl: "https://example.org/legal-aid",
        extractedFields: {
          organizationName: "Neighborhood Legal Center",
          title: "Tenant legal aid",
          description: "Eviction prevention and housing law help.",
          category: "housing law",
          latitude: "41.88",
          longitude: "-87.63",
          address: "10 Court St, Chicago, IL",
          city: "Chicago",
          state: "IL",
          phone: "312-555-0144",
        },
      }) + "\n"
    )

    try {
      const items = await fetchPublicResourceMapItems({
        enabled: false,
        localEnginePreviewFile: previewFile,
      })

      expect(createClientMock).not.toHaveBeenCalled()
      expect(items).toHaveLength(1)
      expect(items[0]).toMatchObject({
        id: "local_resource_map:engine-legal-1",
        itemType: "external_resource",
        title: "Tenant legal aid",
        subtitle: "Neighborhood Legal Center",
        latitude: 41.88,
        longitude: -87.63,
        primaryResourceCategory: "legal_housing_law",
        sourceLabel: "Local engine",
        visibility: "superadmin_preview",
      })
    } finally {
      rmSync(directory, { force: true, recursive: true })
    }
  })

  it("loads local engine records beyond the old 500 raw-row cap", async () => {
    const directory = mkdtempSync(join(tmpdir(), "resource-map-engine-"))
    const previewFile = join(directory, "candidate-records.jsonl")
    const invalidRows = Array.from({ length: 4 }, (_, index) =>
      JSON.stringify({
        sourceRecordId: `missing-title-${index + 1}`,
        sourceName: "Local engine",
        extractedFields: {
          latitude: "41.88",
          longitude: "-87.63",
        },
      })
    )
    const validRows = Array.from({ length: 505 }, (_, index) => {
      const rowNumber = index + 1
      return JSON.stringify({
        sourceRecordId: `engine-food-${rowNumber}`,
        sourceName: "Local engine",
        sourceUrl: `https://example.org/food/${rowNumber}`,
        extractedFields: {
          organizationName: `Food Site ${rowNumber}`,
          title: `Food pantry ${rowNumber}`,
          category: "food pantry",
          latitude: "41.88",
          longitude: "-87.63",
        },
      })
    })
    writeFileSync(previewFile, [...invalidRows, ...validRows].join("\n"))

    try {
      const items = await fetchPublicResourceMapItems({
        enabled: false,
        localEnginePreviewFile: previewFile,
      })

      expect(createClientMock).not.toHaveBeenCalled()
      expect(items).toHaveLength(505)
      expect(items.at(-1)).toMatchObject({
        id: "local_resource_map:engine-food-505",
        title: "Food pantry 505",
        primaryResourceCategory: "food",
      })
    } finally {
      rmSync(directory, { force: true, recursive: true })
    }
  })

  it("falls back to no DB resources if the public RPC is unavailable", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined)
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: {
        code: "42883",
        message: "function public.get_resource_map_public_items does not exist",
      },
    })
    createClientMock.mockReturnValue({ rpc })

    await expect(
      fetchPublicResourceMapItems({
        enabled: true,
        localEnginePreviewFile: null,
      })
    ).resolves.toEqual([])
    expect(console.warn).toHaveBeenCalledWith(
      "[resource-map] public RPC unavailable; using seed fallback",
      expect.objectContaining({ code: "42883" })
    )
  })
})


describe("compact cached resource index projection", () => {
  it("selects index columns without an exact count and advances by item ID", async () => {
    const rows = [buildPublicResourceRow()]
    const builder = { select: vi.fn(), order: vi.fn(), limit: vi.fn(), gt: vi.fn(), then: (resolve: (result: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(resolve) }
    for (const method of [builder.select, builder.order, builder.limit, builder.gt]) method.mockReturnValue(builder)
    createClientMock.mockReturnValue({ from: vi.fn(() => builder) })
    expect(await readPublicResourceIndexPage("previous-id")).toEqual(rows)
    expect(builder.select).toHaveBeenCalledWith(PUBLIC_RESOURCE_INDEX_COLUMNS)
    expect(PUBLIC_RESOURCE_INDEX_COLUMNS).not.toContain("description")
    expect(PUBLIC_RESOURCE_INDEX_COLUMNS).not.toContain("public_contacts")
    expect(PUBLIC_RESOURCE_INDEX_COLUMNS).toContain("source_attribution")
    expect(builder.limit).toHaveBeenCalledWith(500)
    expect(builder.gt).toHaveBeenCalledWith("item_id", "previous-id")
  })

  it("normalizes compact rows without requiring detail arrays", () => {
    const item = buildExternalResourceMapItemFromPublicRow({ item_id: "compact", title: "Resource", resource_categories: ["food"], city: "Chicago" })
    expect(item).toMatchObject({ id: "resource_map:compact", title: "Resource", latitude: null, longitude: null, resourceCategories: ["food"] })
  })
})
