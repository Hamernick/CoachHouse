import "server-only"
import { priceAiUsage, type AiRateCard } from "@/features/ai-credits"
import { z } from "zod"

// Proposed tariff, versioned independently of subscription grants. This feature
// also requires the explicit database policy and organization wallet allowlist.
export function workspaceAiConfig() {
  if (process.env.WORKSPACE_AI_ENABLED !== "true") throw new Error("AI assistance is not enabled yet.")
  if (!process.env.OPENAI_API_KEY) throw new Error("AI assistance is unavailable.")
  const proposed: AiRateCard = {
    version: "2026-10-22-proposed", model: "gpt-6.1-sol",
    inputMicrodollarsPerMillion: 2000000, cachedMicrodollarsPerMillion: 100000,
    outputMicrodollarsPerMillion: 10000000, microdollarsPerCredit: 2000,
  }
  const tariff = z.object({ version: z.string().min(1).max(80), model: z.string().min(1).max(80),
    inputMicrodollarsPerMillion: z.number().int().positive(), cachedMicrodollarsPerMillion: z.number().int().nonnegative(),
    outputMicrodollarsPerMillion: z.number().int().positive(), microdollarsPerCredit: z.number().int().positive(),
  }).strict().parse(process.env.WORKSPACE_AI_RATE_CARD ? JSON.parse(process.env.WORKSPACE_AI_RATE_CARD) : proposed)
  // Worst-case UTF-8 bytes, not a character/token guess. Limit the actual
  // serialized provider input to this budget before reserving any credits.
  const maxInputBytes = 70000
  const maxOutputTokens = 6000
  const price = priceAiUsage({ input: maxInputBytes, cachedInput: 0, output: maxOutputTokens },tariff)
  if (price.credits > 125 || price.microdollars > 250000) throw new Error("AI tariff exceeds the configured run limit.")
  return { tariff, maxInputBytes, maxOutputTokens, maxCredits: price.credits, maxCost: price.microdollars }
}
