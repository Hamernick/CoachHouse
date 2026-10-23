import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ context: vi.fn(), manage: vi.fn(), admin: vi.fn(), revalidate: vi.fn(), sources: vi.fn() }))
vi.mock("@/features/workspace-finance/server", () => ({ loadOpportunitySourceOptions: mocks.sources }))
vi.mock("@/lib/auth/request-context", () => ({ resolveAuthenticatedAppContext: mocks.context }))
vi.mock("@/lib/workspace/workspace-finance-access", () => ({ canManageWorkspaceFinance: mocks.manage }))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mocks.admin }))
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }))
import { createWorkspaceOpportunity } from "@/actions/workspace-opportunities"

const org = "00000000-0000-4000-8000-000000000001"
const id = "00000000-0000-4000-8000-000000000002"
const input = { id, organizationId: org, title: "  Community workshop  ", source: " Foundation ", deadline: "2027-01-15" }
function database(insertError: { code: string } | null = null, found = true) {
  const row = { id, org_id: org, title: "Community workshop", source_label: "Foundation", due_at: "2027-01-15T12:00:00.000Z", status: "new", discovered_at: "2026-10-23T12:00:00.000Z" }
  const query = { insert: vi.fn().mockResolvedValue({ error: insertError }), select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: found ? row : null, error: null }) }
  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  const from = vi.fn().mockReturnValue(query)
  mocks.admin.mockReturnValue({ from })
  return { from, query }
}
beforeEach(() => {
  vi.clearAllMocks()
  mocks.context.mockResolvedValue({ activeOrg: { orgId: org, role: "owner" }, supabase: {}, user: { id: org } })
  mocks.manage.mockResolvedValue(true)
  mocks.sources.mockResolvedValue([])
})
describe("manual workspace opportunity creation", () => {
  it("rejects invalid fields before authentication or database access", async () => {
    for (const invalid of [{ title: " " }, { title: "x".repeat(201) }, { source: "x".repeat(121) }, { deadline: "2027-02-30" }, { id: "invalid" }]) {
      expect(await createWorkspaceOpportunity({ ...input, ...invalid })).toHaveProperty("error")
    }
    expect(mocks.context).not.toHaveBeenCalled()
    expect(mocks.admin).not.toHaveBeenCalled()
  })
  it("rejects unsigned actors", async () => {
    mocks.context.mockRejectedValueOnce(new Error("signed out"))
    expect(await createWorkspaceOpportunity(input)).toHaveProperty("error")
    expect(mocks.admin).not.toHaveBeenCalled()
  })
  it("rejects a stale organization selection", async () => {
    expect(await createWorkspaceOpportunity({ ...input, organizationId: id })).toHaveProperty("error")
    expect(mocks.admin).not.toHaveBeenCalled()
  })
  it("rejects actors without finance management permission", async () => {
    mocks.manage.mockResolvedValueOnce(false)
    expect(await createWorkspaceOpportunity(input)).toHaveProperty("error")
    expect(mocks.admin).not.toHaveBeenCalled()
  })
  it("stores normalized fields under the authorized organization", async () => {
    const { query } = database()
    expect(await createWorkspaceOpportunity(input)).toMatchObject({ opportunity: { id, title: "Community workshop", status: "new" } })
    expect(query.insert).toHaveBeenCalledWith({ id, org_id: org, title: "Community workshop", source_label: "Foundation", due_at: "2027-01-15T12:00:00.000Z", opportunity_type: "other", status: "new", external_provider: "manual", external_opportunity_id: id })
    expect(query.eq).toHaveBeenCalledWith("org_id", org)
    expect(mocks.revalidate).toHaveBeenCalledWith("/workspace")
  })
  it("accepts title-only cards", async () => {
    const { query } = database()
    await createWorkspaceOpportunity({ ...input, source: "", deadline: "" })
    expect(query.insert.mock.calls[0][0]).toMatchObject({ source_label: null, due_at: null })
  })
  it("recovers duplicate submissions without overwriting the existing card", async () => {
    const { query } = database({ code: "23505" })
    expect(await createWorkspaceOpportunity(input)).toHaveProperty("opportunity.id", id)
    expect(query.eq).toHaveBeenCalledWith("external_provider", "manual")
  })
  it("does not expose a duplicate owned by another organization", async () => {
    database({ code: "23505" }, false)
    expect(await createWorkspaceOpportunity(input)).toHaveProperty("error")
    expect(mocks.revalidate).not.toHaveBeenCalled()
  })
  it("returns a recoverable error when storage fails", async () => {
    database({ code: "23514" })
    expect(await createWorkspaceOpportunity(input)).toHaveProperty("error")
    expect(mocks.revalidate).not.toHaveBeenCalled()
  })
  it("rejects unavailable or foreign internal sources before storage", async () => {
    database()
    expect(await createWorkspaceOpportunity({ ...input, sources: [{ kind: "person", id }] })).toHaveProperty("error")
    expect(mocks.sources).toHaveBeenCalledWith({}, org)
    expect(mocks.admin).not.toHaveBeenCalled()
  })
  it("persists authorized references without copying private previews", async () => {
    const { query } = database()
    const sources = [{ kind: "person" as const, id }, { kind: "link" as const, url: "https://example.org/" }]
    mocks.sources.mockResolvedValue([{ source: sources[0], title: "Authorized person", description: "Private preview" }])
    expect(await createWorkspaceOpportunity({ ...input, sources })).toHaveProperty("opportunity")
    expect(query.insert.mock.calls[0][0].sources).toEqual(sources)
  })
  it("rejects unsafe, duplicate, oversized, and forged source metadata", async () => {
    for (const sources of [
      [{ kind: "link", url: "@" }],
      [{ kind: "link", url: "javascript:alert(1)" }],
      [{ kind: "link", url: "https://user:secret@example.org" }],
      [{ kind: "person", id, title: "Forged" }],
      [{ kind: "text", label: "same" }, { kind: "text", label: "same" }],
      Array.from({ length: 21 }, (_, i) => ({ kind: "text", label: String(i) })),
    ]) expect(await createWorkspaceOpportunity({ ...input, sources } as Parameters<typeof createWorkspaceOpportunity>[0])).toHaveProperty("error")
    expect(mocks.admin).not.toHaveBeenCalled()
  })
})
