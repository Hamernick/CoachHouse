import type { AiCreditAccount, AiRateCard, AiUsage } from "../types"

function natural(value: number) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("Invalid AI accounting amount")
  return value
}
export function priceAiUsage(usage: AiUsage, tariff: AiRateCard) {
  for (const value of [usage.input, usage.cachedInput, usage.output,
    tariff.inputMicrodollarsPerMillion, tariff.cachedMicrodollarsPerMillion,
    tariff.outputMicrodollarsPerMillion]) natural(value)
  if (usage.cachedInput > usage.input || natural(tariff.microdollarsPerCredit) === 0)
    throw new Error("Invalid AI usage or tariff")
  const numerator = natural((usage.input - usage.cachedInput) * tariff.inputMicrodollarsPerMillion
    + usage.cachedInput * tariff.cachedMicrodollarsPerMillion + usage.output * tariff.outputMicrodollarsPerMillion)
  const microdollars = Math.ceil(numerator / 1_000_000)
  return { microdollars, credits: Math.ceil(microdollars / tariff.microdollarsPerCredit) }
}
export function aiCreditBalance(account: AiCreditAccount) {
  const result = { available: 0, included: 0, purchased: 0, reserved: 0 }
  for (const lot of account.lots) {
    const available = lot.expired ? 0 : Math.max(0, lot.credits - lot.spent - lot.reserved)
    result.available += available
    result.reserved += lot.reserved
    if (lot.kind === "included") result.included += available
    else result.purchased += available
  }
  return result
}
