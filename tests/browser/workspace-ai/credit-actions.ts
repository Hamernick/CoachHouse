import type { AiCreditAccount } from "../../../src/features/ai-credits/types"
import type { AiCreditPurchases } from "../../../src/features/ai-credits/purchase-types"
export const creditOrg = "71000000-0000-4000-8000-000000000002"
export const creditAccount: AiCreditAccount = { enabled: true, lots: [{ kind: "purchased", credits: 100, spent: 0, reserved: 0, expiresAt: null }], history: [] }
const pack = { key: "fixture", credits: 1000, amount: 1000, currency: "usd" }
export async function loadCreditPurchases(organizationId: string) {
  if (organizationId !== creditOrg) throw new Error("Organization changed")
  const credited = localStorage.getItem("credit-paid") === "true"
  const id = localStorage.getItem("credit-order")
  const purchases: AiCreditPurchases = { canPurchase: !new URLSearchParams(location.search).has("staff"), packs: [pack],
    orders: id ? [{ ...pack, id, created_at: new Date().toISOString(), status: credited ? "paid" : "pending" }] : [] }
  return { account: { ...creditAccount, lots: [{ ...creditAccount.lots[0], credits: credited ? 1100 : 100 }] }, purchases }
}
export async function startCreditPurchase(input: { organizationId: string; id: string; pack: string }) {
  const calls = JSON.parse(localStorage.getItem("credit-calls") || "[]")
  localStorage.setItem("credit-calls", JSON.stringify([...calls, input]))
  if (new URLSearchParams(location.search).has("failure") && calls.length === 0) throw new Error("Checkout connection interrupted. Retry this purchase.")
  localStorage.setItem("credit-order", input.id)
  return { orderId: input.id, url: `${location.origin}/?fixture-checkout` }
}
