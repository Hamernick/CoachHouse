import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const { createSupabaseRouteHandlerClientMock } = vi.hoisted(() => ({
  createSupabaseRouteHandlerClientMock: vi.fn(),
}))

vi.mock("@/lib/supabase/route", () => ({
  createSupabaseRouteHandlerClient: createSupabaseRouteHandlerClientMock,
}))

function buildSupabaseStub(mapPreferences: Record<string, unknown> = {}) {
  const updateUser = vi.fn().mockResolvedValue({ error: null })
  return {
    supabase: {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: "user-1",
              email: "member@example.test",
              user_metadata: { map_preferences: mapPreferences },
            },
          },
          error: null,
        }),
        updateUser,
      },
    },
    updateUser,
  }
}

function buildPatchRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/account/map-preferences", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("account map preferences route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns normalized account-backed resource collections", async () => {
    const { supabase } = buildSupabaseStub({
      collectedResourceIds: ["resource-1", " resource-2 ", "resource-1"],
    })
    createSupabaseRouteHandlerClientMock.mockReturnValue(supabase)

    const { GET } = await import("@/app/api/account/map-preferences/route")
    const response = await GET(
      new NextRequest("http://localhost/api/account/map-preferences")
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      preferences: {
        collectedResourceIds: ["resource-1", "resource-2"],
      },
    })
  })

  it("persists resource collections without replacing other preferences", async () => {
    const { supabase, updateUser } = buildSupabaseStub({
      favorites: ["organization-1"],
      savedQueries: ["food access"],
      recentOrganizationIds: ["organization-2"],
    })
    createSupabaseRouteHandlerClientMock.mockReturnValue(supabase)

    const { PATCH } = await import("@/app/api/account/map-preferences/route")
    const response = await PATCH(
      buildPatchRequest({
        collectedResourceIds: ["resource-1", " resource-2 ", "resource-1"],
      })
    )

    expect(response.status).toBe(200)
    expect(updateUser).toHaveBeenCalledWith({
      data: {
        map_preferences: {
          collectedResourceIds: ["resource-1", "resource-2"],
          favorites: ["organization-1"],
          savedQueries: ["food access"],
          recentOrganizationIds: ["organization-2"],
          savedGuideIds: [],
        },
      },
    })
  })

  it("persists only allowlisted guide IDs", async () => {
    const { supabase, updateUser } = buildSupabaseStub()
    createSupabaseRouteHandlerClientMock.mockReturnValue(supabase)

    const { PATCH } = await import("@/app/api/account/map-preferences/route")
    const response = await PATCH(
      buildPatchRequest({
        savedGuideIds: [
          "chicago-food-access",
          "made-up-guide",
          "chicago-food-access",
        ],
      })
    )

    expect(response.status).toBe(200)
    expect(updateUser).toHaveBeenCalledWith({
      data: {
        map_preferences: expect.objectContaining({
          savedGuideIds: ["chicago-food-access"],
        }),
      },
    })
  })

  it.each([
    "essentials",
    "transportation-access",
    "documents-and-id",
    "digital-access",
  ])("preserves the saved %s guide when updating favorites", async (guideId) => {
    const { supabase, updateUser } = buildSupabaseStub({
      savedGuideIds: [guideId, "chicago-food-access"],
    })
    createSupabaseRouteHandlerClientMock.mockReturnValue(supabase)

    const { PATCH } = await import("@/app/api/account/map-preferences/route")
    const response = await PATCH(
      buildPatchRequest({ favorites: ["organization-1"] })
    )

    expect(response.status).toBe(200)
    expect(updateUser).toHaveBeenCalledWith({
      data: {
        map_preferences: expect.objectContaining({
          favorites: ["organization-1"],
          savedGuideIds: [guideId, "chicago-food-access"],
        }),
      },
    })
  })

  it("returns known newer guide IDs while excluding unknown IDs", async () => {
    const { supabase } = buildSupabaseStub({
      savedGuideIds: ["essentials", "digital-access", "made-up-guide"],
    })
    createSupabaseRouteHandlerClientMock.mockReturnValue(supabase)

    const { GET } = await import("@/app/api/account/map-preferences/route")
    const response = await GET(
      new NextRequest("http://localhost/api/account/map-preferences")
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      preferences: { savedGuideIds: ["essentials", "digital-access"] },
    })
  })

  it("replays the same desired collection state idempotently", async () => {
    const { supabase, updateUser } = buildSupabaseStub()
    createSupabaseRouteHandlerClientMock.mockReturnValue(supabase)

    const { PATCH } = await import("@/app/api/account/map-preferences/route")
    const desiredState = { collectedResourceIds: ["resource-1"] }
    const first = await PATCH(buildPatchRequest(desiredState))
    const replay = await PATCH(buildPatchRequest(desiredState))

    expect(first.status).toBe(200)
    expect(replay.status).toBe(200)
    expect(updateUser).toHaveBeenCalledTimes(2)
    expect(updateUser.mock.calls[0]).toEqual(updateUser.mock.calls[1])
  })
})
