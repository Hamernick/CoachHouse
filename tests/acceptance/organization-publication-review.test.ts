import { beforeEach, describe, expect, it, vi } from "vitest"
import { projectPublicMapOrganizations, type PublicMapProgramRow } from "@/lib/public-map/organization-projection"
import { resolvePublicationLocation } from "@/features/organization-launch/lib/publication-status"

const mocks = vi.hoisted(() => ({ load: vi.fn(), save: vi.fn(), sharing: { publicSharingEnabled: true }, session: vi.fn(), active: vi.fn() }))
vi.mock("@/features/organization-launch/server/load-publication-review", () => ({ loadOrganizationPublicationReview: mocks.load }))
vi.mock("@/actions/organization", () => ({ updateOrganizationProfileAction: mocks.save }))
vi.mock("@/lib/feature-flags", () => mocks.sharing)
vi.mock("@/lib/auth", () => ({ requireServerSession: mocks.session }))
vi.mock("@/lib/organization/active-org", () => ({ resolveActiveOrganization: mocks.active, canEditOrganization: (role: string) => ["owner", "admin", "staff"].includes(role) }))
import { setOrganizationPublicationAction } from "@/features/organization-launch/server/publication-actions"

const row = {
  user_id: "org-1", public_slug: "test", location_lat: null, location_lng: null,
  profile: { name: "Test", description: "Meals", donateUrl: "https://example.org/donate", org_people: [{ name: "Private person" }], internal_notes: "Secret", bankAccount: "Private", documents: [{ title: "Private document" }], brandTypography: { headings: { family: "Geist", weight: "500", tracking: "normal", privateNote: "Private" }, body: { family: "Geist", weight: "400", tracking: "normal" }, code: { family: "Geist Mono" }, secret: "Secret" } },
}

describe("public profile review projection", () => {
  it("uses an explicit public allowlist and never carries private profile fields", () => {
    const [organization] = projectPublicMapOrganizations([row], [])
    expect(organization.name).toBe("Test")
    expect(organization.donateUrl).toBe("https://example.org/donate")
    expect(organization.programs).toEqual([])
    expect(JSON.stringify(organization)).not.toMatch(/Private|Secret|bankAccount|internal_notes|org_people|documents/)
  })
  it("separates private, unresolved and online location states without inventing pending work", () => {
    const base = { isPublic: false, online: false, hasAddress: false, latitude: null, longitude: null }
    expect(resolvePublicationLocation(base).label).toBe("No public location")
    expect(resolvePublicationLocation({ ...base, hasAddress: true }).label).toBe("Location not resolved")
    expect(resolvePublicationLocation({ ...base, online: true }).label).toBe("Online organization")
    expect(resolvePublicationLocation({ ...base, hasAddress: true, latitude: 41, longitude: -87 }).label).toBe("Location ready")
    expect(resolvePublicationLocation({ ...base, isPublic: true, hasAddress: true, latitude: 41, longitude: -87 }).label).toBe("Public map location")
    expect(resolvePublicationLocation({ ...base, hasAddress: true, latitude: 999, longitude: 999 }).label).toBe("Location not resolved")
  })
})

describe("explicit publication mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.sharing.publicSharingEnabled = true
    mocks.load.mockResolvedValue({ organization: { id: "org-1", publicSlug: "test" }, updatedAt: "version-1", revision: "review-1", isPublic: false })
    mocks.save.mockResolvedValue({ ok: true })
  })
  it("uses canonical writes with reviewed organization/version and keeps the saved slug", async () => {
    expect(await setOrganizationPublicationAction({ revision: "review-1", isPublic: true })).toEqual({ ok: true })
    expect(mocks.save).toHaveBeenCalledExactlyOnceWith({ isPublic: true, publicSlug: "test" }, { organizationId: "org-1", updatedAt: "version-1" })
  })
  it("blocks a stale review before any write", async () => {
    expect(await setOrganizationPublicationAction({ revision: "old", isPublic: true })).toHaveProperty("error")
    expect(mocks.save).not.toHaveBeenCalled()
  })
  it("denies unauthorized review and never trusts a client organization ID", async () => {
    mocks.load.mockResolvedValue({ error: "Forbidden" })
    expect(await setOrganizationPublicationAction({ revision: "review-1", isPublic: true })).toEqual({ error: "Forbidden" })
    expect(mocks.save).not.toHaveBeenCalled()
  })
  it("keeps publication unavailable when sharing is off but permits making private", async () => {
    mocks.sharing.publicSharingEnabled = false
    expect(await setOrganizationPublicationAction({ revision: "review-1", isPublic: true })).toHaveProperty("error")
    expect(mocks.save).not.toHaveBeenCalled()
    expect(await setOrganizationPublicationAction({ revision: "review-1", isPublic: false })).toEqual({ ok: true })
  })
  it("returns canonical write errors without claiming success", async () => {
    mocks.save.mockResolvedValue({ error: "Updated elsewhere" })
    expect(await setOrganizationPublicationAction({ revision: "review-1", isPublic: true })).toEqual({ error: "Updated elsewhere" })
  })
  it("requires a saved public URL but not coordinates, curriculum or programs", async () => {
    mocks.load.mockResolvedValue({ organization: { id: "org-1", publicSlug: null }, revision: "review-1" })
    expect(await setOrganizationPublicationAction({ revision: "review-1", isPublic: true })).toHaveProperty("error")
    expect(mocks.save).not.toHaveBeenCalled()
  })
})


describe("authenticated draft review loading", () => {
  async function loader() {
    return (await vi.importActual<typeof import("@/features/organization-launch/server/load-publication-review")>("@/features/organization-launch/server/load-publication-review")).loadOrganizationPublicationReview
  }
  function database() {
    const org = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: { ...row, is_public: false, updated_at: "version-1" }, error: null }) }
    const programs = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), returns: vi.fn().mockResolvedValue({ data: [], error: null }) }
    const from = vi.fn((table: string) => table === "organizations" ? org : programs)
    mocks.session.mockResolvedValue({ session: { user: { id: "editor" } }, supabase: { from } })
    mocks.active.mockResolvedValue({ orgId: "org-1", role: "staff" })
    return { org, programs, from }
  }
  it("resolves the active organization on the server and includes only public-marked programs", async () => {
    const db = database()
    const review = await (await loader())()
    expect(mocks.session).toHaveBeenCalledWith("/workspace/profile-preview")
    expect(db.org.eq).toHaveBeenCalledWith("user_id", "org-1")
    expect(db.programs.eq).toHaveBeenCalledWith("user_id", "org-1")
    expect(db.programs.eq).toHaveBeenCalledWith("is_public", true)
    expect(review).toHaveProperty("isPublic", false)
    expect(review).toHaveProperty("revision")
    expect(JSON.stringify(review)).not.toMatch(/Private person|Private document|Secret|bankAccount/)
  })
  it("rejects read-only viewers before loading the private organization", async () => {
    const db = database()
    mocks.active.mockResolvedValue({ orgId: "org-1", role: "member" })
    expect(await (await loader())()).toHaveProperty("error")
    expect(db.from).not.toHaveBeenCalled()
  })
  it("fails closed when selected programs cannot be loaded", async () => {
    const db = database()
    db.programs.returns.mockResolvedValue({ data: [], error: { message: "Unavailable" } })
    expect(await (await loader())()).toHaveProperty("error")
  })
  it("invalidates the review when selected programs change and excludes private builder fields", async () => {
    const db = database()
    const program: PublicMapProgramRow = {
      id: "program-1", user_id: "org-1", title: "Food pantry", subtitle: null,
      description: "Weekly groceries", created_at: "2026-10-10T12:00:00Z",
      image_url: null, location_type: "in_person", location_url: null,
      duration_label: null, features: [], cta_label: null, cta_url: null,
      start_date: null, wizard_snapshot: { internalNotes: "Private plan", budget: { bankAccount: "Secret account" }, teamIds: ["Private teammate"] },
    }
    db.programs.returns.mockResolvedValue({ data: [program], error: null })
    const load = await loader()
    const first = await load()
    if ("error" in first) throw new Error(first.error)
    expect(first.organization.programs).toEqual([expect.objectContaining({ title: "Food pantry", description: "Weekly groceries" })])
    expect(JSON.stringify(first)).not.toMatch(/Private plan|Secret account|Private teammate|internalNotes|bankAccount|teamIds/)
    db.programs.returns.mockResolvedValue({ data: [], error: null })
    const second = await load()
    if ("error" in second) throw new Error(second.error)
    expect(second.organization.programs).toEqual([])
    expect(second.revision).not.toBe(first.revision)
  })
  it("changes the review revision when public profile data changes", async () => {
    const db = database()
    const load = await loader()
    const first = await load()
    db.org.maybeSingle.mockResolvedValue({ data: { ...row, profile: { ...row.profile, description: "Updated public description" }, is_public: false, updated_at: "version-2" }, error: null })
    const second = await load()
    if ("error" in first || "error" in second) throw new Error("Expected review data")
    expect(second.revision).not.toBe(first.revision)
  })
})
