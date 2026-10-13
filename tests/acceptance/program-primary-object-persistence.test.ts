import { beforeEach, describe, expect, it, vi } from "vitest"

import { createProgramAction, updateProgramAction } from "@/actions/programs"
import { mergeProgramWizardSnapshot } from "@/lib/programs/wizard-snapshot"
import { revalidateTagMock } from "./test-utils"

const sharing = vi.hoisted(() => ({ publicSharingEnabled: true }))
vi.mock("@/lib/feature-flags", () => sharing)

const actionMocks = vi.hoisted(() => ({
  requireServerSession: vi.fn(),
  resolveActiveOrganization: vi.fn(),
  canEditOrganization: vi.fn(),
  resolveProfileAudience: vi.fn(),
  resolveTesterMetadata: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({
  requireServerSession: actionMocks.requireServerSession,
}))

vi.mock("@/lib/organization/active-org", () => ({
  resolveActiveOrganization: actionMocks.resolveActiveOrganization,
  canEditOrganization: actionMocks.canEditOrganization,
}))

vi.mock("@/lib/devtools/audience", () => ({
  resolveProfileAudience: actionMocks.resolveProfileAudience,
  resolveTesterMetadata: actionMocks.resolveTesterMetadata,
}))

function prepareActor(supabase: Record<string, unknown>) {
  actionMocks.requireServerSession.mockResolvedValue({
    supabase,
    session: { user: { id: "user-1", user_metadata: {} } },
  })
  actionMocks.resolveActiveOrganization.mockResolvedValue({
    orgId: "org-1",
    role: "owner",
  })
  actionMocks.canEditOrganization.mockReturnValue(true)
  actionMocks.resolveProfileAudience.mockResolvedValue({ isAdmin: false })
  actionMocks.resolveTesterMetadata.mockReturnValue(false)
}

describe("program primary-object persistence", () => {
  beforeEach(() => {
    sharing.publicSharingEnabled = true
    revalidateTagMock.mockClear()
    for (const mock of Object.values(actionMocks)) {
      mock.mockReset()
    }
  })

  it.each([true, false])("saves only visibility (%s) within the active org and expires public projections", async (isPublic) => {
    const query = {
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: "program-1" }, error: null }),
    }
    const update = vi.fn((_values: Record<string, unknown>) => query)
    prepareActor({ from: vi.fn(() => ({ update, select: () => query })) })
    expect(await updateProgramAction("program-1", { isPublic })).toEqual({ ok: true })
    expect(Object.fromEntries(Object.entries(update.mock.calls[0][0]).filter(([, value]) => value !== undefined))).toEqual({ is_public: isPublic })
    expect(query.eq).toHaveBeenCalledWith("id", "program-1")
    expect(query.eq).toHaveBeenCalledWith("user_id", "org-1")
    expect(revalidateTagMock).toHaveBeenCalledWith("public-map-organizations", { expire: 0 })
    expect(revalidateTagMock).toHaveBeenCalledWith("public-profiles", { expire: 0 })
  })

  it("rejects publishing while sharing is unavailable without changing saved visibility", async () => {
    sharing.publicSharingEnabled = false
    const from = vi.fn()
    prepareActor({ from })
    expect(await updateProgramAction("program-1", { isPublic: true })).toHaveProperty("error")
    expect(await createProgramAction({ title: "New program", isPublic: true })).toHaveProperty("error")
    expect(from).not.toHaveBeenCalled()
    expect(revalidateTagMock).not.toHaveBeenCalled()
  })

  it("still permits withdrawing a public program when sharing is unavailable", async () => {
    sharing.publicSharingEnabled = false
    const query = { eq: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: { id: "program-1" }, error: null }) }
    const update = vi.fn(() => query)
    prepareActor({ from: vi.fn(() => ({ update, select: () => query })) })
    expect(await updateProgramAction("program-1", { isPublic: false })).toEqual({ ok: true })
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ is_public: false }))
    expect(revalidateTagMock).toHaveBeenCalledWith("public-map-organizations", { expire: 0 })
  })

  it.each([null, { message: "Save failed" }])("does not claim visibility saved or invalidate caches after a missing/failed write: %o", async (error) => {
    const query = { eq: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: null, error }) }
    prepareActor({ from: vi.fn(() => ({ update: vi.fn(() => query) })) })
    expect(await updateProgramAction("program-1", { isPublic: false })).toHaveProperty("error")
    expect(revalidateTagMock).not.toHaveBeenCalled()
  })

  it("denies visibility changes for a viewer without writing or invalidating public data", async () => {
    const from = vi.fn()
    prepareActor({ from })
    actionMocks.canEditOrganization.mockReturnValue(false)
    expect(await updateProgramAction("program-1", { isPublic: true })).toEqual({ error: "Forbidden" })
    expect(from).not.toHaveBeenCalled()
    expect(revalidateTagMock).not.toHaveBeenCalled()
  })

  it("merges builder updates without dropping future snapshot fields", () => {
    expect(
      mergeProgramWizardSnapshot({
        existing: {
          objectKind: "Program",
          bannerImageUrl: "https://example.com/banner.png",
          futureWizardKey: { preserved: true },
        },
        incoming: {
          objectKind: "Project",
          title: "Neighborhood hub",
        },
      })
    ).toEqual({
      success: true,
      snapshot: {
        objectKind: "Project",
        title: "Neighborhood hub",
        bannerImageUrl: "https://example.com/banner.png",
        futureWizardKey: { preserved: true },
      },
    })
  })

  it("keeps explicit snapshot clearing backward compatible", () => {
    expect(
      mergeProgramWizardSnapshot({
        existing: { objectKind: "Program", futureWizardKey: true },
        incoming: null,
      })
    ).toEqual({ success: true, snapshot: {} })
  })

  it.each(["Campaign", "Fundraiser", "Grant application", "Re-grant request"])(
    "rejects %s as an activity-wizard kind",
    (objectKind) => {
      expect(
        mergeProgramWizardSnapshot({
          existing: null,
          incoming: { objectKind },
        })
      ).toEqual({
        success: false,
        error: "Choose a supported activity type.",
        field: "wizardSnapshot",
      })
    }
  )

  it("rejects invalid create input before writing a program", async () => {
    const from = vi.fn()
    prepareActor({ from })

    const result = await createProgramAction({
      title: "Donation appeal",
      wizardSnapshot: { objectKind: "Campaign" },
    })

    expect(result).toEqual({
      error: "Choose a supported activity type.",
      field: "wizardSnapshot",
    })
    expect(from).not.toHaveBeenCalled()
  })

  it("preserves existing snapshot fields during an authorized update", async () => {
    let updatePayload: Record<string, unknown> | null = null
    const programSelectQuery = {
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          image_url: null,
          wizard_snapshot: {
            objectKind: "Program",
            bannerImageUrl: "https://example.com/banner.png",
            futureWizardKey: { preserved: true },
          },
          updated_at: "2026-08-05T18:00:00.000Z",
        },
        error: null,
      }),
    }
    const programUpdateQuery = {
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: "program-1" },
        error: null,
      }),
    }
    const programTable = {
      select: vi.fn(() => programSelectQuery),
      update: vi.fn((payload: Record<string, unknown>) => {
        updatePayload = payload
        return programUpdateQuery
      }),
    }
    const organizationQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    const organizationTable = {
      select: vi.fn(() => organizationQuery),
    }
    const from = vi.fn((table: string) => {
      if (table === "programs") return programTable
      if (table === "organizations") return organizationTable
      throw new Error(`Unexpected table: ${table}`)
    })
    prepareActor({
      from,
      storage: { from: vi.fn() },
    })

    expect(
      await updateProgramAction("program-1", {
        wizardSnapshot: {
          objectKind: "Project",
          title: "Neighborhood hub",
        },
      })
    ).toEqual({ ok: true })

    expect(
      (updatePayload as Record<string, unknown> | null)?.["wizard_snapshot"]
    ).toEqual({
      objectKind: "Project",
      title: "Neighborhood hub",
      bannerImageUrl: "https://example.com/banner.png",
      futureWizardKey: { preserved: true },
    })
    expect(programUpdateQuery.eq).toHaveBeenCalledWith(
      "updated_at",
      "2026-08-05T18:00:00.000Z"
    )

    programUpdateQuery.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    })
    expect(
      await updateProgramAction("program-1", {
        wizardSnapshot: {
          objectKind: "Service",
        },
      })
    ).toEqual({
      error: "This activity was updated elsewhere. Reload before saving.",
      conflict: true,
    })
  })
})
