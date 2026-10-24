export type AiUsageHistoryRow = {
  id: string; created_at: string; status: string; task: "document" | "plan"
  charged_credits: number | null; max_credits: number
  actorId: string; actorName: string; resourceTitle: string | null; sectionId: string | null
}
export type AiUsageHistory = {
  canFilterMembers: boolean; members: Array<{ id: string; name: string }>
  rows: AiUsageHistoryRow[]; hasMore: boolean
}
export type AiUsageHistoryQuery = {
  organizationId: string; memberId?: string | null; task?: "document" | "plan" | null
  before?: { at: string; id: string } | null
}
