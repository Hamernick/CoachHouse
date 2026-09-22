import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  projectPublicPeople,
  projectPublicPerson,
} from "@/features/public-profiles/lib/public-directory"

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }))
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: createClient,
}))
import {
  fetchPublicPeopleDirectory,
  fetchPublicPersonByHandle,
} from "@/lib/queries/public-people"
import {
  marketplacePersonHref,
  decodeMarketplacePersonHandle,
} from "@/features/nonprofit-documentation/lib/marketplace-people"

const person = {
  profile_id: "person-1",
  display_name: "Published Person",
  headline: "Community organizer",
  location_label: "Chicago",
  avatar_url: "https://example.org/avatar.png",
  is_public: true,
}
const handle = {
  profile_id: "person-1",
  owner_type: "person",
  handle: "published-person",
}

const detail = {
  ...person,
  bio: "Published biography.\nSecond paragraph.",
  website_url: "https://example.org",
}

function detailClient(
  profile: unknown = detail,
  owner: unknown = handle,
  profileError: unknown = null,
  handleError: unknown = null
) {
  const peopleQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi
      .fn()
      .mockResolvedValue({ data: profile, error: profileError }),
  }
  const handlesQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: owner, error: handleError }),
  }
  const from = vi.fn((table: string) => {
    if (table === "public_person_profiles") return peopleQuery
    if (table === "public_handles") return handlesQuery
    throw new Error(`Unexpected private table: ${table}`)
  })
  createClient.mockResolvedValue({ from })
  return { from, peopleQuery, handlesQuery }
}

function clientFor(
  people: unknown[],
  handles: unknown[],
  error: unknown = null
) {
  const peopleQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockResolvedValue({ data: people, error }),
  }
  const handlesQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockResolvedValue({ data: handles, error: null }),
  }
  const from = vi.fn((table: string) => {
    if (table === "public_person_profiles") return peopleQuery
    if (table === "public_handles") return handlesQuery
    throw new Error(`Unexpected private table: ${table}`)
  })
  createClient.mockResolvedValue({ from })
  return { from, peopleQuery, handlesQuery }
}

describe("public people directory", () => {
  beforeEach(() => vi.clearAllMocks())

  it("projects only named, published people with a valid person handle", () => {
    const withPrivateFields = {
      ...person,
      email: "private@example.org",
      bio: "Not a directory field",
      show_saved_locations: true,
    }
    expect(
      projectPublicPeople(
        [
          withPrivateFields,
          { ...person, profile_id: "private", is_public: false },
          { ...person, profile_id: "orphan" },
          { ...person, profile_id: "organization-owner" },
        ],
        [
          handle,
          { ...handle, profile_id: "private", handle: "private-person" },
          {
            ...handle,
            profile_id: "organization-owner",
            owner_type: "organization",
          },
        ]
      )
    ).toEqual([
      {
        handle: "published-person",
        name: "Published Person",
        headline: "Community organizer",
        location: "Chicago",
        avatarUrl: "https://example.org/avatar.png",
        href: "/published-person",
      },
    ])
    expect(
      projectPublicPeople([person], [{ ...handle, handle: "documentation" }])
    ).toEqual([])
    expect(
      projectPublicPeople(
        [person],
        [{ ...handle, handle: "javascript:alert(1)" }]
      )
    ).toEqual([])
    expect(
      projectPublicPeople([{ ...person, display_name: " " }], [handle])
    ).toEqual([])
  })

  it("does not render unsafe avatar URLs or unvalidated profile paths", () => {
    for (const avatar_url of [
      "javascript:alert(1)",
      "data:image/svg+xml,<svg/>",
      "http://example.org/avatar.png",
      "not a URL",
    ]) {
      expect(
        projectPublicPeople([{ ...person, avatar_url }], [handle])[0].avatarUrl
      ).toBeNull()
    }
    expect(
      projectPublicPeople(
        [person],
        [{ ...handle, handle: "@Published-Person" }]
      )[0].href
    ).toBe("/published-person")
  })

  it("uses explicit publication filters, safe columns, and person-owned handles", async () => {
    const calls = clientFor([person], [handle])
    expect(await fetchPublicPeopleDirectory()).toEqual({
      status: "ready",
      people: projectPublicPeople([person], [handle]),
      hasMore: false,
      page: 1,
    })
    expect(calls.peopleQuery.eq).toHaveBeenCalledWith("is_public", true)
    expect(calls.peopleQuery.select).toHaveBeenCalledWith(
      "profile_id, display_name, headline, location_label, avatar_url, is_public"
    )
    expect(calls.handlesQuery.eq).toHaveBeenCalledWith("owner_type", "person")
    expect(calls.handlesQuery.in).toHaveBeenCalledWith("profile_id", [
      "person-1",
    ])
  })

  it("paginates deterministically and does not expose the lookahead row", async () => {
    const rows = Array.from({ length: 25 }, (_, i) => ({
      ...person,
      profile_id: `person-${i}`,
    }))
    const handles = rows.map((row, i) => ({
      ...handle,
      profile_id: row.profile_id,
      handle: `person-${i}`,
    }))
    const calls = clientFor(rows, handles)
    const result = await fetchPublicPeopleDirectory(2)
    expect(calls.peopleQuery.range).toHaveBeenCalledWith(24, 48)
    expect(result.people).toHaveLength(24)
    expect(result.hasMore).toBe(true)
    expect(result.people.some((entry) => entry.handle === "person-24")).toBe(
      false
    )
    expect(calls.peopleQuery.order.mock.calls).toEqual([
      ["display_name"],
      ["profile_id"],
    ])
  })

  it("distinguishes no published members from an unavailable service", async () => {
    const calls = clientFor([], [])
    expect(await fetchPublicPeopleDirectory(NaN)).toEqual({
      status: "ready",
      people: [],
      hasMore: false,
      page: 1,
    })
    expect(calls.from).toHaveBeenCalledTimes(1)
    clientFor([], [], { message: "private internal error" })
    expect(await fetchPublicPeopleDirectory()).toEqual({
      status: "unavailable",
      people: [],
      hasMore: false,
      page: 1,
    })
    createClient.mockRejectedValue(new Error("Unavailable"))
    expect((await fetchPublicPeopleDirectory()).status).toBe("unavailable")
  })
})

describe("Marketplace public person detail", () => {
  beforeEach(() => vi.clearAllMocks())

  it("accepts literal and URL-encoded @ route segments and rejects malformed encoding", () => {
    expect(decodeMarketplacePersonHandle("@published-person")).toBe(
      "@published-person"
    )
    expect(decodeMarketplacePersonHandle("%40published-person")).toBe(
      "@published-person"
    )
    expect(decodeMarketplacePersonHandle("%ZZ")).toBe("")
  })

  it("loads only the published person for the normalized handle", async () => {
    const calls = detailClient({ ...detail, email: "private@example.org" })
    const result = await fetchPublicPersonByHandle("@Published-Person")
    expect(result).toEqual({
      ...projectPublicPeople([person], [handle])[0],
      bio: detail.bio,
      websiteUrl: "https://example.org/",
    })
    expect(calls.handlesQuery.eq.mock.calls).toEqual([
      ["handle", "published-person"],
      ["owner_type", "person"],
    ])
    expect(calls.peopleQuery.eq.mock.calls).toEqual([
      ["profile_id", "person-1"],
      ["is_public", true],
    ])
    expect(calls.peopleQuery.select).toHaveBeenCalledWith(
      "profile_id, display_name, headline, bio, location_label, website_url, avatar_url, is_public"
    )
    expect(marketplacePersonHref(result!.handle)).toBe(
      "/documentation/marketplace/people/@published-person"
    )
  })

  it("denies missing, organization-owned, and unpublished people", async () => {
    for (const owner of [
      null,
      { ...handle, profile_id: null },
      { ...handle, owner_type: "organization" },
    ]) {
      const calls = detailClient(detail, owner)
      expect(await fetchPublicPersonByHandle(handle.handle)).toBeNull()
      expect(calls.peopleQuery.select).not.toHaveBeenCalled()
    }
    for (const profile of [
      null,
      { ...detail, is_public: false },
      { ...detail, profile_id: "different-person" },
    ]) {
      detailClient(profile)
      expect(await fetchPublicPersonByHandle(handle.handle)).toBeNull()
    }
  })

  it("rejects invalid and reserved handles before querying", async () => {
    for (const input of [
      "documentation",
      "../caleb",
      "javascript:alert(1)",
      "",
    ]) {
      expect(await fetchPublicPersonByHandle(input)).toBeNull()
    }
    expect(createClient).not.toHaveBeenCalled()
  })

  it("never exposes unsafe website links or private account fields", () => {
    for (const website_url of [
      "javascript:alert(1)",
      "data:text/html,unsafe",
      "//example.org",
      "not a URL",
    ]) {
      expect(
        projectPublicPerson({ ...detail, website_url }, handle)?.websiteUrl
      ).toBeNull()
    }
    expect(
      projectPublicPerson({ ...detail, website_url: null }, handle)?.websiteUrl
    ).toBeNull()
  })

  it("fails closed on lookup errors without revealing provider details", async () => {
    detailClient(detail, handle, { message: "private provider error" })
    await expect(fetchPublicPersonByHandle(handle.handle)).rejects.toThrow(
      "Unable to load this person."
    )
    const calls = detailClient(detail, handle, null, {
      message: "private provider error",
    })
    await expect(fetchPublicPersonByHandle(handle.handle)).rejects.toThrow(
      "Unable to load this person."
    )
    expect(calls.peopleQuery.select).not.toHaveBeenCalled()
  })
})
