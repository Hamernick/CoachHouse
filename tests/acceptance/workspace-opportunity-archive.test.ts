import { beforeEach, describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ context: vi.fn(), admin: vi.fn() }))
vi.mock("@/lib/auth/request-context", () => ({ resolveAuthenticatedAppContext: mocks.context }))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mocks.admin }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
import { getArchivedWorkspaceOpportunities } from "@/actions/workspace-opportunity-lifecycle"
import { matchesOpportunityFilter, opportunityFeedFilters } from "@/features/workspace-finance/lib/opportunity-feed-filters"

import { getOpportunitySiteIcon } from "@/features/workspace-finance/components/opportunity-site-icon"

const org = "00000000-0000-4000-8000-000000000001"
beforeEach(() => vi.clearAllMocks())
describe("opportunity archive", () => {
  it("denies invalid, signed-out and stale-organization reads before querying", async () => {
    expect(await getArchivedWorkspaceOpportunities("invalid")).toHaveProperty("error")
    expect(mocks.context).not.toHaveBeenCalled()
    mocks.context.mockRejectedValueOnce(new Error("signed out"))
    expect(await getArchivedWorkspaceOpportunities(org)).toHaveProperty("error")
    const from = vi.fn()
    mocks.context.mockResolvedValue({ activeOrg: { orgId: "another-org" }, supabase: { from } })
    expect(await getArchivedWorkspaceOpportunities(org)).toHaveProperty("error")
    expect(from).not.toHaveBeenCalled()
    expect(mocks.admin).not.toHaveBeenCalled()
  })
  it("loads persisted archives through actor RLS, scoped and bounded", async () => {
    const query = { select: vi.fn(), eq: vi.fn(), order: vi.fn(), limit: vi.fn() }
    for (const method of [query.select, query.eq, query.order]) method.mockReturnValue(query)
    query.limit.mockResolvedValue({ data: [{ id: org, title: "Previous grant", status: "dismissed", external_provider: "manual", report: null, sources: null }], error: null })
    const from = vi.fn().mockReturnValue(query)
    mocks.context.mockResolvedValue({ activeOrg: { orgId: org }, supabase: { from } })
    expect(await getArchivedWorkspaceOpportunities(org)).toMatchObject({ opportunities: [{ title: "Previous grant", status: "dismissed", origin: "manual" }] })
    expect(query.eq).toHaveBeenCalledWith("org_id", org)
    expect(query.eq).toHaveBeenCalledWith("status", "dismissed")
    expect(query.limit).toHaveBeenCalledWith(100)
    expect(mocks.admin).not.toHaveBeenCalled()
    query.limit.mockResolvedValue({ data: null, error: new Error("denied") })
    expect(await getArchivedWorkspaceOpportunities(org)).toHaveProperty("error")
  })
  it("keeps every workflow state accessible within three filters", () => {
    expect(opportunityFeedFilters.map(filter => filter.id)).toEqual(["all", "saved", "archived"])
    for (const origin of ["manual", "suggested"] as const) for (const status of ["new", "saved", "applied", "awarded", "not_awarded", "dismissed"] as const) {
      const groups = opportunityFeedFilters.filter(filter => matchesOpportunityFilter(filter.id, status, origin))
      expect(groups.length).toBeGreaterThan(0)
      expect(matchesOpportunityFilter("all", status, origin)).toBe(status !== "dismissed")
    }
    expect(matchesOpportunityFilter("saved", "new", "manual")).toBe(true)
    expect(matchesOpportunityFilter("saved", "new", "suggested")).toBe(false)
  })
})


describe("opportunity source website icons", () => {
  it("uses only a public-looking domain and strips paths, query strings and fragments", () => {
    expect(getOpportunitySiteIcon("https://partner.org/private/path?secret=value#section")).toEqual({host:"partner.org",src:"https://partner.org/favicon.ico"})
    expect(getOpportunitySiteIcon("http://partner.org/path")?.src).toBe("https://partner.org/favicon.ico")
    for (const url of ["http://127.0.0.1/file","http://[::1]/file","https://localhost/file","https://team.local/file","https://team.internal/file","https://team.test/file","https://intranet/file","https://user:pass@partner.org/file","https://partner.org:8080/file","javascript:alert(1)"]) expect(getOpportunitySiteIcon(url)).toBeNull()
  })
})
