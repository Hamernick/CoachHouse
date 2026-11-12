import { aiCreditBalance } from "./index"
import type { AiCreditAccount } from "../types"

export function creditSummary(account: AiCreditAccount) {
  const balance = aiCreditBalance(account)
  const lots = account.lots.filter(lot => lot.kind === "included" && !lot.expired && !lot.restricted)
  const allowance = lots.reduce((sum, lot) => sum + lot.credits, 0)
  const percent = allowance > 0 ? Math.min(100, Math.max(0, Math.round(balance.included / allowance * 100))) : null
  const expires = lots.map(lot => lot.expiresAt).filter((date): date is string => Boolean(date)).sort()[0]
  return { ...balance, allowance, percent, expires }
}

