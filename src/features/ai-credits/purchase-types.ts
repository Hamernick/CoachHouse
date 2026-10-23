export type AiCreditPack = { key: string; credits: number; amount: number; currency: string }
export type AiCreditPurchases = {
  canPurchase: boolean
  packs: AiCreditPack[]
  orders: Array<{ id: string; credits: number; amount: number; currency: string; created_at: string; status: "pending" | "paid" | "expired";
    paymentIssue?: "refunded" | "partially_refunded" | "refund_pending" | "disputed" | "verification_pending" | null }>
}
