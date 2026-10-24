import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ context: vi.fn(), manage: vi.fn(), admin: vi.fn(), revalidate: vi.fn(), sources: vi.fn() }))
vi.mock("@/features/workspace-finance/server", async importOriginal => ({ ...await importOriginal<typeof import("@/features/workspace-finance/server")>(), loadOpportunitySourceOptions: mocks.sources }))
vi.mock("@/lib/auth/request-context", () => ({ resolveAuthenticatedAppContext: mocks.context }))
vi.mock("@/lib/workspace/workspace-finance-access", () => ({ canManageWorkspaceFinance: mocks.manage }))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mocks.admin }))
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }))
import { createWorkspaceOpportunity, updateWorkspaceOpportunity } from "@/actions/workspace-opportunities"

const org = "00000000-0000-4000-8000-000000000001"
const id = "00000000-0000-4000-8000-000000000002"
const input = { id, organizationId: org, title: "  Community workshop  ", source: " Foundation ", deadline: "2027-01-15" }
function database(insertError: { code: string } | null = null, found = true) {
  const row = { updated_at: "2026-10-23T12:00:00.000Z", id, org_id: org, title: "Community workshop", source_label: "Foundation", due_at: "2027-01-15T12:00:00.000Z", status: "new", discovered_at: "2026-10-23T12:00:00.000Z" }
  const query = { update: vi.fn(), neq: vi.fn(), insert: vi.fn().mockResolvedValue({ error: insertError }), select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: found ? row : null, error: null }) }
  query.update.mockReturnValue(query)
  query.neq.mockReturnValue(query)
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
    for (const kind of ["person", "file"] as const) expect(await createWorkspaceOpportunity({ ...input, sources: [{ kind, id }] })).toHaveProperty("error")
    expect(mocks.sources).toHaveBeenCalledWith({}, org, org)
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

describe("opportunity report editing", () => {
  const updatedAt = "2026-10-23T12:00:00.000Z"
  const report = { version: 1 as const, blocks: [{ kind: "text" as const, id, title: "Overview", text: "A local workshop" }] }
  it("updates only an authorized manual report at the expected revision", async () => {
    const { query } = database()
    expect(await updateWorkspaceOpportunity({ ...input, updatedAt, report })).toHaveProperty("opportunity")
    expect(query.update).toHaveBeenCalledWith(expect.objectContaining({ title: "Community workshop", report, sources: [] }))
    expect(query.eq.mock.calls).toContainEqual(["org_id", org])
    expect(query.eq.mock.calls).toContainEqual(["external_provider", "manual"])
    expect(query.eq.mock.calls).toContainEqual(["updated_at", updatedAt])
    expect(query.insert).not.toHaveBeenCalled()
  })
  it("preserves a newer edit and refuses missing revision, foreign organization, and unprivileged writes", async () => {
    const { query } = database(null, false)
    expect(await updateWorkspaceOpportunity({ ...input, updatedAt, report })).toHaveProperty("error")
    expect(mocks.revalidate).not.toHaveBeenCalled()
    query.update.mockClear()
    for (const edit of [{ ...input }, { ...input, organizationId: id, updatedAt }]) expect(await updateWorkspaceOpportunity(edit)).toHaveProperty("error")
    mocks.manage.mockResolvedValue(false)
    expect(await updateWorkspaceOpportunity({ ...input, updatedAt })).toHaveProperty("error")
    expect(query.update).not.toHaveBeenCalled()
  })
  it("validates references inside components and rejects non-image or unavailable image files", async () => {
    database()
    const sources = { version: 1 as const, blocks: [{ kind: "sources" as const, id, title: "Contacts", sources: [{ kind: "person" as const, id }] }] }
    expect(await createWorkspaceOpportunity({ ...input, report: sources })).toHaveProperty("error")
    const image = { version: 1 as const, blocks: [{ kind: "image" as const, id, title: "", fileId: id, alt: "Workshop" }] }
    mocks.sources.mockResolvedValue([{ source: { kind: "file", id }, mimeType: "application/pdf" }])
    expect(await createWorkspaceOpportunity({ ...input, report: image })).toHaveProperty("error")
    expect(mocks.admin).not.toHaveBeenCalled()
    mocks.sources.mockResolvedValue([{ source: { kind: "file", id }, mimeType: "image/png" }])
    expect(await createWorkspaceOpportunity({ ...input, report: image })).toHaveProperty("opportunity")
  })
})

import { opportunityReportSchema, readOpportunityReport, hasReportContent } from "@/features/workspace-finance/lib/opportunity-report"
it("bounds versioned components and rejects duplicate IDs or executable custom markup fields", () => {
  const block = { id, title: "", kind: "text", text: "Summary" }
  for (const report of [
    { version: 2, blocks: [block] },
    { version: 1, blocks: [block, block] },
    { version: 1, blocks: [{ ...block, html: "<script/>" }] },
    { version: 1, blocks: [{ ...block, text: "x".repeat(6001) }] },
    { version: 1, blocks: Array.from({ length: 13 }, (_, i) => ({ ...block, id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}` })) },
  ]) expect(opportunityReportSchema.safeParse(report).success).toBe(false)
  expect(readOpportunityReport(undefined)).toEqual({ version: 1, blocks: [] })
  expect(hasReportContent({ id, title: "Empty", kind: "text", text: " " })).toBe(false)
  expect(hasReportContent({ id, title: "Image", kind: "image", fileId: null, alt: "" })).toBe(false)
})


import { deleteWorkspaceOpportunity, getWorkspaceOpportunity } from "@/actions/workspace-opportunity-lifecycle"
describe("opportunity lifecycle", () => {
  const deletion = { organizationId: org, id, updatedAt: "2026-10-23T12:00:00.000Z" }
  it("rejects malformed deletion before auth", async () => {
    expect(await deleteWorkspaceOpportunity({ ...deletion, updatedAt: "" })).toHaveProperty("error")
    expect(mocks.context).not.toHaveBeenCalled()
  })
  it("rejects signed-out, wrong-organization and unauthorized deletions", async () => {
    mocks.context.mockRejectedValueOnce(new Error("signed out"))
    expect(await deleteWorkspaceOpportunity(deletion)).toHaveProperty("error")
    expect(await deleteWorkspaceOpportunity({ ...deletion, organizationId: id })).toHaveProperty("error")
    mocks.manage.mockResolvedValueOnce(false)
    expect(await deleteWorkspaceOpportunity(deletion)).toHaveProperty("error")
    expect(mocks.admin).not.toHaveBeenCalled()
  })
  it("deletes only the exact manual report revision in the active organization", async () => {
    const { query, from } = database()
    const del = vi.fn().mockReturnValue(query)
    mocks.admin.mockReturnValue({ from: vi.fn().mockReturnValue({ ...query, delete: del }) })
    expect(await deleteWorkspaceOpportunity(deletion)).toEqual({ ok: true })
    expect(del).toHaveBeenCalledOnce()
    expect(query.eq.mock.calls).toEqual([["id", id], ["org_id", org], ["external_provider", "manual"], ["updated_at", deletion.updatedAt]])
    expect(from).not.toHaveBeenCalled() // No file deletion or unrelated writes.
  })
  it("refuses stale or unavailable deletions", async () => {
    const { query } = database(null, false)
    mocks.admin.mockReturnValue({ from: vi.fn().mockReturnValue({ ...query, delete: vi.fn().mockReturnValue(query) }) })
    expect(await deleteWorkspaceOpportunity(deletion)).toHaveProperty("error")
    expect(mocks.revalidate).not.toHaveBeenCalled()
  })
  it("reads linked reports through actor RLS and exact organization scope", async () => {
    const { query, from } = database()
    mocks.context.mockResolvedValueOnce({ activeOrg: { orgId: org }, user: { id: org }, supabase: { from } })
    mocks.admin.mockClear()
    expect(await getWorkspaceOpportunity({ organizationId: org, id })).toHaveProperty("opportunity.id", id)
    expect(mocks.admin).not.toHaveBeenCalled()
    expect(query.eq.mock.calls).toEqual([["org_id", org], ["id", id]])
  })
  it("does not read foreign-organization reports", async () => {
    expect(await getWorkspaceOpportunity({ organizationId: id, id })).toHaveProperty("error")
    expect(mocks.sources).not.toHaveBeenCalled()
    expect(mocks.admin).not.toHaveBeenCalled()
  })
})


import { assertParticleSourceReferenceAccess } from "@/features/workspace-particles/server/particle-source-access"
import { createParticle } from "@/features/workspace-particles/lib/particle-registry"
import type { ParticleGraph } from "@/features/workspace-particles/types"
describe("opportunity canvas reference authorization", () => {
  const graph = { workspaceId: org, revision: 0, rootId: null, particles: [], connections: [] } as unknown as ParticleGraph
  const linked = () => {
    const p = createParticle("activity", { id, workspaceId: org, now: "2026-10-23T12:00:00.000Z" })
    if (p.type !== "activity") throw new Error("Expected activity")
    p.data.widget = { kind: "opportunity", organizationId: org, opportunityId: id }
    return p
  }
  function actor(rows: { id: string }[]) {
    const query = { select: vi.fn(), eq: vi.fn(), in: vi.fn(), abortSignal: vi.fn().mockResolvedValue({ data: rows, error: null }) }
    query.select.mockReturnValue(query); query.eq.mockReturnValue(query); query.in.mockReturnValue(query)
    const from = vi.fn().mockReturnValue(query)
    return { client: { from } as unknown as Parameters<typeof assertParticleSourceReferenceAccess>[0]["supabase"], query, from }
  }
  it("checks newly placed references using actor RLS in the graph organization", async () => {
    const db = actor([{ id }])
    await assertParticleSourceReferenceAccess({ supabase: db.client, previous: graph, next: { ...graph, particles: [linked()] } })
    expect(db.from).toHaveBeenCalledWith("organization_finance_opportunities")
    expect(db.query.eq).toHaveBeenCalledWith("org_id", org)
  })
  it("rejects forged organization and unreadable opportunity references", async () => {
    const db = actor([]), p = linked()
    await expect(assertParticleSourceReferenceAccess({ supabase: db.client, previous: graph, next: { ...graph, particles: [p] } })).rejects.toThrow("unavailable")
    p.data.widget = { kind: "opportunity", organizationId: id, opportunityId: id }
    db.from.mockClear()
    await expect(assertParticleSourceReferenceAccess({ supabase: db.client, previous: graph, next: { ...graph, particles: [p] } })).rejects.toThrow("another organization")
    expect(db.from).not.toHaveBeenCalled()
  })
  it("keeps a deleted report reference movable without bypassing new-reference checks", async () => {
    const db = actor([]), p = linked()
    await assertParticleSourceReferenceAccess({ supabase: db.client, previous: { ...graph, particles: [p] }, next: { ...graph, particles: [{ ...p, position: { x: 200, y: 100 } }] } })
    expect(db.from).not.toHaveBeenCalled()
  })
})


import { opportunityCostsSchema, opportunityCostTotal, parseOpportunityCost } from "@/features/workspace-finance/lib/opportunity-costs"
describe("opportunity cost breakdowns", () => {
  const costs = { currency: "USD" as const, items: [{ id, title: "Materials", type: "variable" as const, amountCents: 125050 }] }
  it("persists typed cost items inside facts without replacing legacy text", async () => {
    const { query } = database()
    const report = { version: 1 as const, blocks: [{ id, title: "Facts", kind: "facts" as const, items: [{ id, label: "Budget", value: "$2,500 proposed", costs }] }] }
    expect(await createWorkspaceOpportunity({ ...input, report })).toHaveProperty("opportunity")
    expect(query.insert.mock.calls[0][0].report).toEqual(report)
    expect(readOpportunityReport(report)).toEqual(report)
    expect(hasReportContent(report.blocks[0])).toBe(true)
  })
  it("uses integer cents and handles blanks and zero without inventing a total", () => {
    expect(parseOpportunityCost("0.10")).toBe(10)
    expect(parseOpportunityCost("0.20")).toBe(20)
    expect(parseOpportunityCost("1250.50")).toBe(125050)
    expect(parseOpportunityCost("")).toBeNull()
    expect(opportunityCostTotal({ ...costs, items: [] })).toBeNull()
    expect(opportunityCostTotal({ ...costs, items: [{ ...costs.items[0], amountCents: 0 }] })).toBe(0)
    expect(opportunityCostTotal({ ...costs, items: [{ ...costs.items[0], amountCents: 10 }, { ...costs.items[0], id: org, amountCents: 20 }] })).toBe(30)
  })
  it("rejects negative, fractional-cent, nonfinite, oversized and malformed costs", () => {
    for (const text of ["-1", "1.005", "NaN", "Infinity", "1e2", "1000000000.01"]) expect(parseOpportunityCost(text)).toBeUndefined()
    for (const amountCents of [-1, 1.5, Infinity, 100_000_000_001]) expect(opportunityCostsSchema.safeParse({ ...costs, items: [{ ...costs.items[0], amountCents }] }).success).toBe(false)
    expect(opportunityCostsSchema.safeParse({ ...costs, items: [{ ...costs.items[0], type: "unknown" }] }).success).toBe(false)
    expect(opportunityCostsSchema.safeParse({ ...costs, items: [costs.items[0], costs.items[0]] }).success).toBe(false)
    expect(opportunityCostsSchema.safeParse({ ...costs, items: Array.from({ length: 21 }, () => ({ ...costs.items[0], id: crypto.randomUUID() })) }).success).toBe(false)
  })
})
