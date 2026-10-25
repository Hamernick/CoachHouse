import type { AiCreditAccount } from "../../../src/features/ai-credits/types"
import type { AiCreditPurchases } from "../../../src/features/ai-credits/purchase-types"
import type { AiCreditLimits } from "../../../src/features/ai-credits/limit-types"
export const creditOrg = "71000000-0000-4000-8000-000000000002"
export const creditAccount: AiCreditAccount = { enabled: true, lots: [{ kind: "purchased", credits: 100, spent: 0, reserved: 0, expiresAt: null }], history: [] }
const pack = { key: "fixture", credits: 1000, amount: 1000, currency: "usd" }
export async function loadCreditPurchases(organizationId: string) {
  if (organizationId !== creditOrg) throw new Error("Organization changed")
  const credited = localStorage.getItem("credit-paid") === "true"
  const issue = new URLSearchParams(location.search).has("restricted") ? "refund_pending" as const : null
  const id = localStorage.getItem("credit-order")
  const purchases: AiCreditPurchases = { canPurchase: !new URLSearchParams(location.search).has("staff"), packs: [pack],
    orders: id ? [{ ...pack, id, created_at: new Date().toISOString(), status: credited ? "paid" : "pending", paymentIssue: issue }] : [] }
  return { account: { ...creditAccount, paymentReview: Boolean(issue), lots: [creditAccount.lots[0],
    ...(credited ? [{ ...creditAccount.lots[0], credits: 1000, restricted: Boolean(issue) }] : []),
    ...(localStorage.getItem("allowance-confirmed") ? [{ kind: "included" as const, credits: 500, spent: 0, reserved: 0, expiresAt: "2026-11-23T12:00:00Z" }] : [])] }, purchases }
}
export async function startCreditPurchase(input: { organizationId: string; id: string; pack: string }) {
  const calls = JSON.parse(localStorage.getItem("credit-calls") || "[]")
  localStorage.setItem("credit-calls", JSON.stringify([...calls, input]))
  if (new URLSearchParams(location.search).has("failure") && calls.length === 0) throw new Error("Checkout connection interrupted. Retry this purchase.")
  localStorage.setItem("credit-order", input.id)
  return { orderId: input.id, url: `${location.origin}/?fixture-checkout` }
}
export async function loadAiCreditLimits(): Promise<AiCreditLimits> {
  const stored = localStorage.getItem("credit-limits")
  return stored ? JSON.parse(stored) : { canManage: !new URLSearchParams(location.search).has("staff"), resetsAt: "2026-11-01T00:00:00Z",
    organization: { limit: null, used: 25, revision: "71000000-0000-4000-8000-000000000020" },
    members: [{ memberId: creditOrg, name: "Fictional Owner", limit: null, used: 10, revision: null },
      { memberId: "71000000-0000-4000-8000-000000000003", name: "Fictional Teammate", limit: null, used: 15, revision: null }] }
}
export async function saveAiCreditLimit(input: { memberId: string | null; limit: number | null; revision: string | null; operationId: string }) {
  const limits = await loadAiCreditLimits()
  const row = input.memberId ? limits.members.find(member => member.memberId === input.memberId)! : limits.organization
  if (row.revision !== input.revision) throw new Error("Spending limit changed. Reload limits before saving.")
  row.limit = input.limit; row.revision = crypto.randomUUID()
  localStorage.setItem("credit-limits", JSON.stringify(limits))
  return limits
}

export async function loadAiUsageHistory(input: { memberId?: string | null; task?: string | null; before?: { at: string; id: string } | null }) {
  if (new URLSearchParams(location.search).has("usage-error") && !sessionStorage.getItem("usage-available")) {
    throw new Error("Simulated usage outage")
  }
  const staff = new URLSearchParams(location.search).has("staff")
  const members = [{ id: creditOrg, name: "Fictional Owner" }, { id: "71000000-0000-4000-8000-000000000003", name: "Fictional Teammate" }]
  const rows = Array.from({ length: 25 }, (_, index) => ({ id: `74000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    created_at: new Date(Date.UTC(2026, 9, 23, 12, 0, 60 - index)).toISOString(), status: "succeeded", task: index % 2 ? "plan" as const : "document" as const,
    charged_credits: index + 1, max_credits: 50, actorId: members[index % 2].id, actorName: members[index % 2].name,
    resourceTitle: index % 2 ? null : `Document ${index + 1}`, sectionId: index % 2 ? null : "mission" }))
    .filter(row => (!staff || row.actorId === creditOrg) && (!input.memberId || row.actorId === input.memberId) && (!input.task || row.task === input.task) && (!input.before || row.created_at < input.before.at))
  return { canFilterMembers: !staff, members, rows: rows.slice(0, 20), hasMore: rows.length > 20 }
}

export async function loadAiAllowance() {
  if (!new URLSearchParams(location.search).has("allowance")) return null
  return { organizationName: "Fictional Organization", binding: localStorage.getItem("allowance-bound") ? "sub_fixture" : null,
    grant: localStorage.getItem("allowance-confirmed") ? { label: "Fixture plan", credits: 500, expiresAt: "2026-11-23T12:00:00Z" } : null,
    options: [{ id: "sub_fixture", label: "Fixture plan", credits: 500 }] }
}
export async function assignAiAllowance(input: { organizationId: string; subscriptionId: string; operationId: string }) {
  const calls = JSON.parse(localStorage.getItem("allowance-calls") || "[]")
  localStorage.setItem("allowance-calls", JSON.stringify([...calls, input]))
  localStorage.setItem("allowance-bound", "true")
  if (new URLSearchParams(location.search).has("allowance-failure") && calls.length === 0) throw new Error("Allowance confirmation pending. Retry this request.")
  localStorage.setItem("allowance-confirmed", "true")
  return loadAiAllowance()
}
