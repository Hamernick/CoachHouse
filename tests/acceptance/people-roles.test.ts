import { beforeEach, describe, expect, it, vi } from "vitest"
import sharp from "sharp"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { MAX_PERSON_PHOTO_DATA_URL_LENGTH } from "@/lib/people/profile-photo"
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
  it("edits a phone and preserves it when older callers omit the field", async () => {
    await upsertPersonAction({
      id: "person-1",
      name: "Morgan",
      category: "volunteers",
      phone: " +1 312 555 0100 ",
    })
    await upsertPersonAction({
      id: "person-1",
      name: "Morgan updated",
      category: "volunteers",
    })
    expect(profile.org_people[0].phone).toBe("+1 312 555 0100")
  })
  it("rejects oversized phone data before writing", async () => {
    expect(
      await upsertPersonAction({
        name: "Morgan",
        category: "volunteers",
        phone: "1".repeat(65),
      })
    ).toHaveProperty("error")
    expect(mocks.mutate).not.toHaveBeenCalled()
  })
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


describe("People profile photos", () => {
  async function photo() {
    const bytes = await sharp({ create: { width: 800, height: 600, channels: 4, background: "#369" } }).png().toBuffer()
    return `data:image/png;base64,${bytes.toString("base64")}`
  }
  function storage(error: object | null = null) {
    const upload = vi.fn(async () => ({ error }))
    const remove = vi.fn(async () => ({ error: null }))
    vi.mocked(createSupabaseAdminClient).mockReturnValue({ storage: { from: vi.fn(() => ({ upload, remove })) } } as never)
    return { upload, remove }
  }
  it("stores a bounded photo and saves only its reference, retaining other contact fields", async () => {
    const { upload } = storage()
    const result = await upsertPersonAction({ id: "person-1", name: "Morgan", category: "volunteers", image: await photo() })
    expect(result).toEqual({ ok: true, id: "person-1" })
    const [path, bytes, options] = upload.mock.calls[0] as unknown as [string, Buffer, object]
    expect(path).toMatch(/^users\/org-1\/[a-f0-9-]+\.webp$/)
    expect(options).toEqual({ contentType: "image/webp", upsert: false })
    expect(await sharp(bytes).metadata()).toMatchObject({ format: "webp", width: 512, height: 384 })
    expect(profile.org_people[0]).toMatchObject({ image: path, tags: ["tag-a"] })
    expect(profile.org_people[0].image!.length).toBeLessThan(4096)
  })
  it("rejects oversized, invalid and unauthorized photos without changing the contact", async () => {
    const { upload } = storage()
    const saved = JSON.stringify(profile)
    expect(await upsertPersonAction({ name: "Morgan", category: "staff", image: "data:image/png;base64," + "A".repeat(MAX_PERSON_PHOTO_DATA_URL_LENGTH) })).toHaveProperty("error")
    expect(await upsertPersonAction({ name: "Morgan", category: "staff", image: "data:image/png;base64,bm90LWFuLWltYWdl" })).toHaveProperty("error")
    mocks.canEdit.mockReturnValue(false)
    expect(await upsertPersonAction({ name: "Morgan", category: "staff", image: await photo() })).toEqual({ error: "Forbidden" })
    expect(upload).not.toHaveBeenCalled()
    expect(mocks.mutate).not.toHaveBeenCalled()
    expect(JSON.stringify(profile)).toBe(saved)
  })
  it("preserves the existing photo when upload or the revision-guarded save fails", async () => {
    profile.org_people[0].image = "users/org-1/original.webp"
    const saved = JSON.stringify(profile)
    const failed = storage({ message: "Upload failed" })
    expect(await upsertPersonAction({ id: "person-1", name: "Morgan", category: "staff", image: await photo() })).toHaveProperty("error")
    expect(failed.remove).not.toHaveBeenCalled()
    expect(JSON.stringify(profile)).toBe(saved)
    const uploaded = storage()
    expect(await upsertPersonAction({ id: "person-1", expectedRevision: 99, name: "Morgan", category: "staff", image: await photo() })).toHaveProperty("error")
    expect(uploaded.upload).toHaveBeenCalledOnce()
    expect(uploaded.remove).not.toHaveBeenCalled()
    expect(JSON.stringify(profile)).toBe(saved)
  })
})
