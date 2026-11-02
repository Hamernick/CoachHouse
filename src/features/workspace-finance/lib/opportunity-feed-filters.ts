import type { WorkspaceFinanceOpportunityWorkflowStatus } from "../types"

export const opportunityFeedFilters = [
  { id: "all", label: "All" },
  { id: "saved", label: "Saved" },
  { id: "archived", label: "Archived" },
] as const
export type OpportunityFeedFilter = typeof opportunityFeedFilters[number]["id"]
export function matchesOpportunityFilter(filter: OpportunityFeedFilter, status: WorkspaceFinanceOpportunityWorkflowStatus, origin?: "manual" | "suggested") {
  switch (filter) {
    case "all": return status !== "dismissed"
    case "saved": return status === "saved" || (status === "new" && origin === "manual")
    case "archived": return status === "dismissed"
  }
}
