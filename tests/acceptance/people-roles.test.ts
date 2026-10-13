import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  updatePersonCategoryAction,
  upsertPersonAction,
  type OrgPerson,
} from "@/actions/people"
import { listPeopleRolesAction } from "@/actions/people-roles"
import {
  personMatchesRole,
  readPeopleRoles,
  resolvePersonRole,
} from "@/lib/people/roles"

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  activeOrg: vi.fn(),
  canEdit: vi.fn(),
  mutate: vi.fn(),
}))
vi.mock("@/lib/auth", () => ({ requireServerSession: mocks.session }))
vi.mock("@/lib/organization/active-org", () => ({
  resolveActiveOrganization: mocks.activeOrg,
  canEditOrganization: mocks.canEdit,
}))
vi.mock("@/lib/people/profile-write", () => ({
  mutateOrganizationPeopleProfile: mocks.mutate,
}))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn() }))

let profile: {
  org_people: OrgPerson[]
  people_roles: string[]
  mission: string
}
const query = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() }
beforeEach(() => {
  vi.clearAllMocks()
  profile = {
    org_people: [
      {
        id: "person-1",
        name: "Morgan",
        category: "volunteers",
        tags: ["tag-a"],
      },
    ],
    people_roles: [],
    mission: "Keep me",
  }
  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  query.maybeSingle.mockImplementation(async () => ({
    data: { profile, role: "member" },
    error: null,
  }))
  mocks.session.mockResolvedValue({
    session: { user: { id: "user-1" } },
    supabase: { from: vi.fn(() => query) },
  })
  mocks.activeOrg.mockResolvedValue({ orgId: "org-1", role: "owner" })
  mocks.canEdit.mockReturnValue(true)
  mocks.mutate.mockImplementation(async ({ orgId, mutate }) => {
    expect(orgId).toBe("org-1")
    const result = mutate(profile.org_people, profile)
    if ("error" in result) return result
    if (result.changed)
      profile = {
        ...profile,
        org_people: result.people,
        people_roles: result.peopleRoles ?? profile.people_roles,
      }
    return { ok: true, value: result.value }
  })
})

describe("organization People roles", () => {
  it("creates and assigns a role without changing grouping or other contact fields", async () => {
    expect(
      await updatePersonCategoryAction(
        "person-1",
        "volunteers",
        "  Community   partner "
      )
    ).toEqual({ ok: true })
    expect(profile.org_people[0]).toEqual({
      id: "person-1",
      name: "Morgan",
      category: "volunteers",
      tags: ["tag-a"],
      customRole: "Community partner",
    })
    expect(profile.people_roles).toEqual(["Community partner"])
    expect(profile.mission).toBe("Keep me")
  })
  it("reuses existing roles regardless of case and spacing", async () => {
    profile.people_roles = ["Community partner"]
    await updatePersonCategoryAction(
      "person-1",
      "volunteers",
      "community  PARTNER"
    )
    expect(profile.people_roles).toEqual(["Community partner"])
    expect(profile.org_people[0].customRole).toBe("Community partner")
  })
  it("keeps a role available after its last contact switches to a built-in role", async () => {
    await updatePersonCategoryAction("person-1", "volunteers", "Partner")
    await updatePersonCategoryAction("person-1", "staff")
    expect(profile.org_people[0]).toMatchObject({
      category: "staff",
      customRole: null,
    })
    expect(await listPeopleRolesAction()).toEqual({ roles: ["Partner"] })
    expect(query.eq).toHaveBeenCalledWith("user_id", "org-1")
  })
  it("preserves a custom role when legacy contact updates omit it", async () => {
    await updatePersonCategoryAction("person-1", "volunteers", "Partner")
    await upsertPersonAction({
      id: "person-1",
      name: "New name",
      category: "volunteers",
    })
    expect(profile.org_people[0]).toMatchObject({
      name: "New name",
      customRole: "Partner",
    })
  })
  it("saves a role during contact creation and makes it reusable", async () => {
    expect(
      await upsertPersonAction({
        name: "New contact",
        category: "staff",
        customRole: "Mentor",
      })
    ).toHaveProperty("ok", true)
    expect(profile.org_people[1]).toMatchObject({
      name: "New contact",
      customRole: "Mentor",
    })
    expect(await listPeopleRolesAction()).toEqual({ roles: ["Mentor"] })
  })
  it("denies a read-only member before attempting a mutation", async () => {
    mocks.canEdit.mockReturnValue(false)
    expect(
      await updatePersonCategoryAction("person-1", "staff", "Partner")
    ).toEqual({ error: "Forbidden" })
    expect(mocks.mutate).not.toHaveBeenCalled()
  })
  it("refuses to assign a role to a contact outside the active organization", async () => {
    expect(
      await updatePersonCategoryAction("other-org-person", "staff", "Partner")
    ).toEqual({ error: "Person not found." })
    expect(profile.people_roles).toEqual([])
  })
  it("returns persistence errors without claiming success", async () => {
    mocks.mutate.mockResolvedValue({
      error: "People changed while you were saving. Try again.",
    })
    expect(
      await updatePersonCategoryAction("person-1", "staff", "Partner")
    ).toHaveProperty("error")
    expect(profile.people_roles).toEqual([])
  })
  it("validates labels server-side and resolves built-in role duplicates", () => {
    expect(
      resolvePersonRole({ category: "staff", customRole: "a".repeat(61) }, [])
    ).toHaveProperty("error")
    expect(
      resolvePersonRole({ category: "staff", customRole: " Volunteers " }, [])
    ).toEqual({ category: "volunteers", customRole: null })
    expect(
      readPeopleRoles({
        people_roles: [null, "Partner", " partner "],
        org_people: [],
      })
    ).toEqual(["partner"])
  })
  it("filters custom roles separately while retaining category grouping", () => {
    const person = { category: "volunteers" as const, customRole: "Mentor" }
    expect(personMatchesRole(person, "custom:Mentor")).toBe(true)
    expect(personMatchesRole(person, "custom:Partner")).toBe(false)
    expect(personMatchesRole(person, "volunteers")).toBe(true)
    expect(personMatchesRole(person, "all")).toBe(true)
  })
})
