import { beforeEach, describe, expect, it, vi } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/types"

vi.mock("server-only", () => ({}))
const mocks = vi.hoisted(() => ({ client: vi.fn(), activeOrg: vi.fn(), drive: vi.fn() }))
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.client }))
vi.mock("@/lib/organization/active-org", () => ({ resolveActiveOrganization: mocks.activeOrg, canEditOrganization: () => true }))
vi.mock("@/features/google-drive", () => ({ getSelectedGoogleDriveFile: mocks.drive }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))
vi.mock("@/lib/notifications", () => ({ createNotification: vi.fn() }))
import { requireOrganizationDocumentStorage } from "@/lib/organization/document-storage-access"
import { saveRoadmapSectionAction, deleteRoadmapSectionAction } from "@/actions/roadmap"

function setup(subscription: unknown = null, error: unknown = null) {
  const eq = vi.fn()
  const update = vi.fn()
  const select = vi.fn()
  const not = vi.fn()
  const from = vi.fn((table: string) => {
    const q = {
      select: (...args: unknown[]) => { select(table, ...args); return q },
      eq: (...args: unknown[]) => { eq(table, ...args); return q },
      not: (...args: unknown[]) => { not(table, ...args); return q },
      order: () => q, limit: () => q,
      update: (...args: unknown[]) => { update(...args); return q },
      maybeSingle: async () => table === "subscriptions" ? { data: subscription, error } : {
        data: { user_id: "org-1", updated_at: "2026-10-12", profile: { roadmap: { sections: [{ id: "budget", title: "Budget", content: "Saved body", lastUpdated: null }] } } }, error: null,
      },
    }
    return q
  })
  const client = { from, auth: { getUser: async () => ({ data: { user: { id: "viewer-1" } }, error: null }) } }
  mocks.client.mockResolvedValue(client)
  return { client: client as unknown as SupabaseClient<Database, "public">, eq, update, select, not }
}

describe("free document access", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.activeOrg.mockResolvedValue({ orgId: "org-1", role: "owner" })
  })
  it.each([
    [null, false],
    [{ status: "active", metadata: { plan_tier: "organization" } }, true],
    [{ status: "trialing", metadata: { plan_tier: "operations_support" } }, true],
    [{ status: "canceled", metadata: { plan_tier: "organization" } }, false],
    [{ status: "active", metadata: { planName: "Free" } }, false],
  ])("checks the selected org subscription: %j", async (subscription, allowed) => {
    const { client, eq, not } = setup(subscription)
    const result = await requireOrganizationDocumentStorage({ supabase: client, orgId: "org-1" })
    expect("ok" in result).toBe(allowed)
    expect(eq).toHaveBeenCalledWith("subscriptions", "user_id", "org-1")
    expect(not).toHaveBeenCalledWith("subscriptions", "stripe_subscription_id", "ilike", "stub_%")
  })
  it("fails closed when billing status cannot be read", async () => {
    const { client } = setup(null, { message: "Database unavailable" })
    expect(await requireOrganizationDocumentStorage({ supabase: client, orgId: "org-1" })).toEqual({ error: "Unable to load subscription status." })
  })
  it("rejects native edits and deletes before touching saved documents", async () => {
    const { update, select } = setup()
    expect(await saveRoadmapSectionAction({ sectionId: "budget", content: "Overwrite" })).toHaveProperty("error")
    expect(await deleteRoadmapSectionAction("budget")).toHaveProperty("error")
    expect(update).not.toHaveBeenCalled()
    expect(select.mock.calls.every(([table]) => table === "subscriptions")).toBe(true)
  })
  it("does not allow native edits smuggled alongside a Drive link", async () => {
    const { update } = setup()
    expect(await saveRoadmapSectionAction({ sectionId: "budget", driveFileId: "drive-fixture-000001", content: "Overwrite" })).toHaveProperty("error")
    expect(update).not.toHaveBeenCalled()
    expect(mocks.drive).not.toHaveBeenCalled()
  })
  it("permits a verified Drive link and preserves the saved native body", async () => {
    const { update } = setup()
    mocks.drive.mockResolvedValue({ id: "drive-fixture-000001", name: "My budget", webViewLink: "https://docs.google.com/document/d/drive-fixture-000001/edit" })
    const result = await saveRoadmapSectionAction({ sectionId: "budget", driveFileId: "drive-fixture-000001", expectedOrganizationId: "org-1", expectedUserId: "viewer-1", expectedLastUpdated: null })
    expect(result).toMatchObject({ section: { id: "budget" } })
    expect(mocks.drive).toHaveBeenCalledWith("viewer-1", "drive-fixture-000001")
    expect(update).toHaveBeenCalledOnce()
    const sections = update.mock.calls[0][0].profile.roadmap.sections
    expect(sections.find((s: { id: string }) => s.id === "budget")).toMatchObject({ content: "Saved body", driveSource: { fileId: "drive-fixture-000001" } })
  })
})
