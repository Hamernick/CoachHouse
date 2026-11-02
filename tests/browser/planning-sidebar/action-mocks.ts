export async function callFixtureAction(name: string, input: Record<string, unknown>) {
  if (name === "objectivePlanningAccessAction") return { isOrganizationOwner: true }
  if (name === "searchOpportunityFundingSources") {
    localStorage.setItem("funding-search-count", String(Number(localStorage.getItem("funding-search-count") ?? 0) + 1))
    if (input.keyword === "slow") await new Promise(resolve => setTimeout(resolve, 500))
    if (localStorage.getItem("funding-search-error")) { localStorage.removeItem("funding-search-error"); return { error: "Grants.gov is unavailable. Try again." } }
    return { options: input.keyword === "empty" ? [] : [{ source: { kind: "link", url: "https://www.grants.gov/search-results-detail/123", title: input.keyword === "slow" ? "Stale grant" : "Community facilities grant" }, title: input.keyword === "slow" ? "Stale grant" : "Community facilities grant", category: "Funding link", description: "Example agency · Up to $50,000 per award" }] }
  }
  if (name === "getWorkspaceOpportunitySources") return { options: [] }
  if (name === "getWorkspaceOpportunity") return { opportunity: { report: { version: 1, blocks: [{ id: "00000000-0000-4000-8000-000000000099", kind: "text", title: "Summary", text: "Drag this opportunity report across the canvas." }] }, sources: [{ kind: "text", label: "Community partner" }] }, options: [] }
  if (name === "createWorkspaceOpportunity" || name === "updateWorkspaceOpportunity") {
    if (localStorage.getItem("fail-opportunity") === "true") { localStorage.removeItem("fail-opportunity"); return { error: "Fixture save failed. Try again." } }
    const opportunity = { ...input, origin: "manual", status: "new", dueAt: input.deadline ? `${input.deadline}T12:00:00.000Z` : null, updatedAt: new Date().toISOString() }
    localStorage.setItem("saved-opportunity", JSON.stringify(opportunity))
    return { opportunity }
  }
  if (name === "reorderWorkspaceOpportunities") {
    if (localStorage.getItem("fail-order")) { localStorage.removeItem("fail-order"); return { error: "Fixture order conflict" } }
    const ordered = input.ordered as string[]
    localStorage.setItem("fixture-opportunity-order", JSON.stringify(ordered))
    return { items: ordered.map((id, index) => ({ id, feedPosition: index + 1, updatedAt: new Date().toISOString() })) }
  }
  if (name === "getArchivedWorkspaceOpportunities") {
    if (localStorage.getItem("fail-archive-load")) { localStorage.removeItem("fail-archive-load"); return { error: "Fixture archive failed" } }
    const opportunity = JSON.parse(localStorage.getItem("archived-opportunity") ?? "null")
    return { opportunities: opportunity ? [opportunity] : [] }
  }
  if (name === "updateWorkspaceFinanceOpportunityStatus") {
    if (localStorage.getItem("fail-status")) { localStorage.removeItem("fail-status"); return { error: "Fixture status failed" } }
    const statuses = JSON.parse(localStorage.getItem("fixture-opportunity-statuses") ?? "{}")
    statuses[String(input.opportunityId)] = input.status
    localStorage.setItem("fixture-opportunity-statuses", JSON.stringify(statuses))
    const existing = JSON.parse(localStorage.getItem("archived-opportunity") ?? "null")
    const opportunity = { ...existing, id: input.opportunityId, title: existing?.title ?? "Suggested partnership", origin: existing?.origin ?? "suggested", status: input.status }
    if (input.status === "dismissed") localStorage.setItem("archived-opportunity", JSON.stringify(opportunity))
    else localStorage.removeItem("archived-opportunity")
    return { ok: true }
  }
  if (name === "deleteWorkspaceOpportunity") return { ok: true }
  return { error: `Unused fixture action: ${name}` }
}
