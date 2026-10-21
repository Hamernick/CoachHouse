import { beforeEach, describe, expect, it, vi } from "vitest"

import { updateOrganizationProfileAction } from "@/actions/organization"
import {
  ORG_PROFILE_BRAND_COLOR_LIMIT,
  ORG_PROFILE_BRAND_VOICE_ATTRIBUTE_MAX_LENGTH,
  ORG_PROFILE_BRAND_VOICE_LONG_FORM_MAX_LENGTH,
  ORG_PROFILE_ROADMAP_TEXT_MAX_LENGTH,
  organizationProfilePersistencePatchSchema,
  validateOrganizationProfilePersistencePatch,
} from "@/lib/organization/profile-persistence-validation"
import { resolveCoreDocumentPublication, prepareCoreDocumentProfileSave } from "@/lib/roadmap/core-document-publication"
import { ORGANIZATION_CORE_DOCUMENT_SECTION_IDS } from "@/lib/roadmap/organization-core-documents"
import { resolvePublicOrganizationProfileNarratives, resolveOrganizationCoreDocuments, updateRoadmapSection } from "@/lib/roadmap"
import { resolveOrganizationNarrativePlainText } from "@/lib/roadmap"

import { resetTestMocks, revalidatePathMock, revalidateTagMock } from "./test-utils"

const authMocks = vi.hoisted(() => ({
  requireServerSession: vi.fn(),
  resolveActiveOrganization: vi.fn(),
  canEditOrganization: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({
  requireServerSession: authMocks.requireServerSession,
}))

vi.mock("@/lib/organization/active-org", () => ({
  resolveActiveOrganization: authMocks.resolveActiveOrganization,
  canEditOrganization: authMocks.canEditOrganization,
}))

function prepareOrganizationSave(existingProfile: Record<string, unknown>, options: { isPublic?: boolean; writeError?: string; ein?: string } = {}) {
  let updatedRow: Record<string, unknown> | null = null
  const selectQuery = {
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: {
        ein: options.ein ?? null,
        profile: existingProfile,
        location_lat: null,
        location_lng: null,
        public_slug: null,
        is_public: options.isPublic ?? false,
        updated_at: "2026-08-05T18:00:00.000Z",
      },
      error: null,
    }),
  }
  const updateQuery = {
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: options.writeError ? null : { user_id: "org-1" },
      error: options.writeError ? { message: options.writeError } : null,
    }),
  }
  const organizationTable = {
    select: vi.fn(() => selectQuery),
    update: vi.fn((payload: Record<string, unknown>) => {
      updatedRow = payload
      return updateQuery
    }),
  }
  const from = vi.fn((table: string) => {
    if (table !== "organizations") {
      throw new Error(`Unexpected table: ${table}`)
    }
    return organizationTable
  })

  authMocks.requireServerSession.mockResolvedValue({
    supabase: { from },
    session: { user: { id: "user-1" } },
  })
  authMocks.resolveActiveOrganization.mockResolvedValue({
    orgId: "org-1",
    role: "owner",
  })
  authMocks.canEditOrganization.mockReturnValue(true)

  return {
    getUpdatedProfile() {
      return (updatedRow?.profile ?? null) as Record<string, unknown> | null
    },
  }
}

describe("organization profile persistence validation", () => {
  beforeEach(() => {
    resetTestMocks()
    authMocks.requireServerSession.mockReset()
    authMocks.resolveActiveOrganization.mockReset()
    authMocks.canEditOrganization.mockReset()
  })

  it.each(Object.entries(ORGANIZATION_CORE_DOCUMENT_SECTION_IDS))(
    "saves the %s switch through canonical document status without losing content",
    async (key, id) => {
      const initial = updateRoadmapSection({ unrelated: "preserved" }, id, { content: "<p>Story</p>", status: "complete" }).nextProfile
      const state = resolveCoreDocumentPublication(initial)
      const save = prepareOrganizationSave(initial)
      const result = await updateOrganizationProfileAction({ coreDocumentPublication: {
        [key]: { lastUpdated: state[key as keyof typeof state].lastUpdated, status: "in_progress" },
      } })
      expect(result).toMatchObject({ ok: true, coreDocumentPublication: { [key]: { status: "in_progress" } } })
      const stored = save.getUpdatedProfile()
      expect(stored).toMatchObject({ unrelated: "preserved" })
      expect(stored).not.toHaveProperty("coreDocumentPublication")
      expect(resolveOrganizationCoreDocuments(stored)[key as keyof typeof state]).toBe("<p>Story</p>")
      const publicKey = key === "need" ? "needStatement" : key
      const visible = resolvePublicOrganizationProfileNarratives(stored)
      expect(visible[publicKey as keyof typeof visible]).toBe("")
      const next = resolveCoreDocumentPublication(stored)
      const republish = prepareOrganizationSave(stored!)
      expect(await updateOrganizationProfileAction({ coreDocumentPublication: {
        [key]: { lastUpdated: next[key as keyof typeof next].lastUpdated, status: "complete" },
      } })).toMatchObject({ ok: true })
      expect(resolvePublicOrganizationProfileNarratives(republish.getUpdatedProfile())[publicKey as keyof typeof visible]).toBe("<p>Story</p>")
    }
  )

  it("rejects a stale switch without overwriting another editor's document", async () => {
    const initial = updateRoadmapSection({}, "origin_story", { content: "Newer story", status: "complete" }).nextProfile
    const save = prepareOrganizationSave(initial)
    expect(await updateOrganizationProfileAction({ coreDocumentPublication: {
      originStory: { lastUpdated: null, status: "in_progress" },
    } })).toMatchObject({ conflict: "originStory" })
    expect(save.getUpdatedProfile()).toBeNull()
  })

  it("rejects invalid publication states and revisions", () => {
    for (const entry of [{ status: "public", lastUpdated: null }, { status: "complete" }, { status: "complete", lastUpdated: 42 }]) {
      expect(validateOrganizationProfilePersistencePatch({ coreDocumentPublication: { mission: entry } })).toMatchObject({ success: false, field: "coreDocumentPublication" })
    }
  })

  it("preserves newer document status and text when saving an unrelated profile edit", async () => {
    const original = updateRoadmapSection({}, "mission_vision_values", { content: "<p>Original</p>", status: "complete" }).nextProfile
    const company = { name: "Before", mission: "<p>Original</p>", coreDocumentPublication: resolveCoreDocumentPublication(original) }
    const newer = updateRoadmapSection(original, "mission_vision_values", { content: "<p>Newer draft</p>", status: "in_progress" }).nextProfile
    const save = prepareOrganizationSave(newer)
    expect(await updateOrganizationProfileAction(prepareCoreDocumentProfileSave({ ...company, name: "After" }, company))).toMatchObject({ ok: true })
    expect(resolveCoreDocumentPublication(save.getUpdatedProfile()).mission.status).toBe("in_progress")
    expect(resolveOrganizationCoreDocuments(save.getUpdatedProfile()).mission).toBe("<p>Newer draft</p>")
  })

  it("requires organization edit permission for publication switches", async () => {
    const save = prepareOrganizationSave({})
    authMocks.canEditOrganization.mockReturnValue(false)
    expect(await updateOrganizationProfileAction({ coreDocumentPublication: { mission: { status: "complete", lastUpdated: null } } })).toEqual({ error: "Forbidden" })
    expect(save.getUpdatedProfile()).toBeNull()
  })

  it.each([true, false])("immediately expires public reads after saving visibility %s", async (isPublic) => {
    prepareOrganizationSave({ name: "Test" }, { isPublic: !isPublic })
    expect(await updateOrganizationProfileAction({ isPublic })).toMatchObject({ ok: true })
    expect(revalidateTagMock).toHaveBeenCalledWith("public-map-organizations", { expire: 0 })
    expect(revalidateTagMock).toHaveBeenCalledWith("public-profiles", { expire: 0 })
  })

  it("does not invalidate public reads when a visibility save fails", async () => {
    prepareOrganizationSave({ name: "Test" }, { isPublic: true, writeError: "Save failed" })
    expect(await updateOrganizationProfileAction({ isPublic: false })).toEqual({ error: "Save failed" })
    expect(revalidateTagMock).not.toHaveBeenCalled()
  })

  it("rejects publication after switching away from the reviewed organization", async () => {
    const saved = prepareOrganizationSave({ name: "Test" })
    const result = await updateOrganizationProfileAction({ isPublic: true }, { organizationId: "another-org", updatedAt: "2026-08-05T18:00:00.000Z" })
    expect(result).toHaveProperty("error", "Your active organization changed. Reload the preview before publishing.")
    expect(saved.getUpdatedProfile()).toBeNull()
  })

  it("rejects publication when the reviewed organization version is stale", async () => {
    const saved = prepareOrganizationSave({ name: "Test" })
    const result = await updateOrganizationProfileAction({ isPublic: true }, { organizationId: "org-1", updatedAt: "old-version" })
    expect(result).toHaveProperty("error", "This organization was updated elsewhere. Reload before publishing.")
    expect(saved.getUpdatedProfile()).toBeNull()
  })

  it("rejects a whitespace-only name before any profile write", async () => {
    const from = vi.fn()
    authMocks.requireServerSession.mockResolvedValue({
      supabase: { from },
      session: { user: { id: "owner-1" } },
    })
    authMocks.resolveActiveOrganization.mockResolvedValue({
      orgId: "owner-1",
      role: "owner",
    })
    authMocks.canEditOrganization.mockReturnValue(true)
    expect(await updateOrganizationProfileAction({ name: "   " })).toEqual({
      error: "Name is required",
      field: "name",
    })
    expect(from).not.toHaveBeenCalled()
  })

  it("adds organization identity through the existing Workspace action without losing saved work", async () => {
    const preserved = {
      mission: "Saved mission",
      vision: "Saved vision",
      values: "Saved values",
      documents: { bylaws: { path: "sample/bylaws.pdf" } },
      org_people: [{ id: "teammate", name: "Existing teammate" }],
      futureProfileKey: { retained: true },
    }
    const save = prepareOrganizationSave(preserved)
    expect(
      await updateOrganizationProfileAction({
        name: `  ${"R".repeat(120)}  `,
        formationStatus: "approved",
        ein: "12-3456789",
      })
    ).toMatchObject({ ok: true })
    expect(save.getUpdatedProfile()).toMatchObject({
      ...preserved,
      name: "R".repeat(120),
      formationStatus: "approved",
    })
  })

  it.each([undefined, "", "123", "letters"])("rejects approval without a valid EIN: %s", async (ein) => {
    const save = prepareOrganizationSave({ formationStatus: "in_progress" })
    const result = await updateOrganizationProfileAction({ formationStatus: "approved", ein })
    expect(result).toMatchObject({ field: "ein", error: expect.any(String) })
    expect(save.getUpdatedProfile()).toBeNull()
  })

  it("accepts approval with the stored canonical EIN", async () => {
    const save = prepareOrganizationSave({}, { ein: "12-3456789" })
    expect(await updateOrganizationProfileAction({ formationStatus: "approved" })).toMatchObject({ ok: true })
    expect(save.getUpdatedProfile()).toMatchObject({ formationStatus: "approved" })
  })

  it("accepts a legacy profile EIN when the canonical column is empty", async () => {
    prepareOrganizationSave({ ein: "12-3456789" })
    expect(await updateOrganizationProfileAction({ formationStatus: "approved" })).toMatchObject({ ok: true })
  })

  it("rejects clearing an approved organization's EIN", async () => {
    const save = prepareOrganizationSave({ formationStatus: "approved" }, { ein: "12-3456789" })
    expect(await updateOrganizationProfileAction({ ein: "" })).toMatchObject({ field: "ein" })
    expect(save.getUpdatedProfile()).toBeNull()
  })

  it("preserves unrelated saves for legacy approved profiles without an EIN", async () => {
    prepareOrganizationSave({ formationStatus: "approved" })
    expect(await updateOrganizationProfileAction({ tagline: "Updated tagline" })).toMatchObject({ ok: true })
  })

  it("allows switching away from approval without deleting a stored EIN", async () => {
    const save = prepareOrganizationSave({ formationStatus: "approved", ein: "12-3456789" }, { ein: "12-3456789" })
    expect(await updateOrganizationProfileAction({ formationStatus: "in_progress" })).toMatchObject({ ok: true })
    expect(save.getUpdatedProfile()).toMatchObject({ formationStatus: "in_progress", ein: "12-3456789" })
  })

  it("accepts the complete Brand Kit and MVV persistence contract", () => {
    const result = organizationProfilePersistencePatchSchema.safeParse({
      mission: "Equip community leaders.",
      vision: "Every neighborhood thrives.",
      values: "Care, clarity, rigor.",
      narrativeRevisions: {
        mission: "2026-08-05T18:00:00.000Z",
        vision: null,
        values: "2026-08-05T18:00:00.000Z",
      },
      brandVoiceAudience: "Community leaders",
      brandVoiceTone: "Warm and direct",
      brandVoiceStyle: "Plain language",
      brandVoicePersonality: "A trusted guide",
      brandVoiceGuidelines: "Lead with the clearest next step.",
      brandVoiceAvoid: "Insider jargon",
      brandPrimary: "6c3aed",
      brandColors: ["#111827", "F9FAFB"],
      brandThemePresetId: "skyline",
      brandAccentPresetId: "violet",
      brandTypographyPresetId: "modern-grotesk",
      brandTypography: {
        headings: {
          family: "Inter",
          weight: "600",
          tracking: "normal",
        },
        body: {
          family: "Inter",
          weight: "400",
          tracking: "normal",
        },
        code: { family: "Geist Mono" },
      },
      futureProfileKey: { preserved: true },
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.brandPrimary).toBe("#6c3aed")
      expect(result.data.futureProfileKey).toEqual({ preserved: true })
    }
  })

  it.each([
    {
      payload: {
        brandVoiceTone: "x".repeat(
          ORG_PROFILE_BRAND_VOICE_ATTRIBUTE_MAX_LENGTH + 1
        ),
      },
      field: "brandVoiceTone",
    },
    {
      payload: {
        brandVoiceGuidelines: "x".repeat(
          ORG_PROFILE_BRAND_VOICE_LONG_FORM_MAX_LENGTH + 1
        ),
      },
      field: "brandVoiceGuidelines",
    },
    { payload: { brandPrimary: "#123" }, field: "brandPrimary" },
    {
      payload: {
        brandColors: Array.from(
          { length: ORG_PROFILE_BRAND_COLOR_LIMIT + 1 },
          () => "#123456"
        ),
      },
      field: "brandColors",
    },
    {
      payload: {
        brandTypography: {
          headings: { family: "Inter", weight: "600", tracking: "invalid" },
          body: { family: "Inter", weight: "400", tracking: "normal" },
          code: { family: "Geist Mono" },
        },
      },
      field: "brandTypography",
    },
    {
      payload: {
        mission: "x".repeat(ORG_PROFILE_ROADMAP_TEXT_MAX_LENGTH + 1),
      },
      field: "mission",
    },
    {
      payload: { narrativeRevisions: { mission: 42 } },
      field: "narrativeRevisions",
    },
  ])("rejects invalid persistence input at $field", ({ payload, field }) => {
    expect(validateOrganizationProfilePersistencePatch(payload)).toMatchObject({
      success: false,
      field,
    })
  })

  it("rejects invalid Brand Kit data before reading or writing the organization", async () => {
    const from = vi.fn()
    authMocks.requireServerSession.mockResolvedValue({
      supabase: { from },
      session: { user: { id: "user-1" } },
    })
    authMocks.resolveActiveOrganization.mockResolvedValue({
      orgId: "org-1",
      role: "owner",
    })
    authMocks.canEditOrganization.mockReturnValue(true)

    const result = await updateOrganizationProfileAction({
      brandVoiceTone: "x".repeat(
        ORG_PROFILE_BRAND_VOICE_ATTRIBUTE_MAX_LENGTH + 1
      ),
    })

    expect(result).toEqual({
      error: `Brand voice fields must be ${ORG_PROFILE_BRAND_VOICE_ATTRIBUTE_MAX_LENGTH} characters or less.`,
      field: "brandVoiceTone",
    })
    expect(from).not.toHaveBeenCalled()
  })

  it("preserves MVV and unknown fields during a Brand Kit save", async () => {
    const save = prepareOrganizationSave({
      mission: "Existing mission",
      vision: "Existing vision",
      values: "Existing values",
      brandVoiceTone: "Formal",
      futureProfileKey: { preserved: true },
    })

    expect(
      await updateOrganizationProfileAction({ brandVoiceTone: "Warm" })
    ).toMatchObject({ ok: true })

    expect(save.getUpdatedProfile()).toMatchObject({
      mission: "Existing mission",
      vision: "Existing vision",
      values: "Existing values",
      brandVoiceTone: "Warm",
      futureProfileKey: { preserved: true },
    })
    expect(revalidatePathMock).toHaveBeenCalledWith("/workspace")
    expect(revalidatePathMock).toHaveBeenCalledWith("/my-organization")
    expect(revalidatePathMock).toHaveBeenCalledWith("/organization")
    expect(revalidatePathMock).toHaveBeenCalledWith("/resources")
  })

  it("preserves Brand Kit and unknown fields during an MVV save", async () => {
    const save = prepareOrganizationSave({
      mission: "Existing mission",
      brandPrimary: "#6C3AED",
      brandVoiceTone: "Warm and direct",
      futureProfileKey: { preserved: true },
    })

    expect(
      await updateOrganizationProfileAction({
        mission: "<p>Updated mission</p>",
        narrativeRevisions: {
          mission: null,
          vision: null,
          values: null,
        },
      })
    ).toMatchObject({ ok: true })

    const updatedProfile = save.getUpdatedProfile()
    expect(updatedProfile).toMatchObject({
      brandPrimary: "#6C3AED",
      brandVoiceTone: "Warm and direct",
      futureProfileKey: { preserved: true },
    })
    expect(
      resolveOrganizationNarrativePlainText(updatedProfile, "mission")
    ).toBe("Updated mission")
  })
})
