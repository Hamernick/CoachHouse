export type AiRateCard = {
  version: string
  model: string
  inputMicrodollarsPerMillion: number
  cachedMicrodollarsPerMillion: number
  outputMicrodollarsPerMillion: number
  webSearchMicrodollarsPerCall?: number
  embeddingMicrodollarsPerMillion?: number
  embedding?: { model: string; dimensions: number; maxInputBytes: number; maxInputTokens: number; maxCalls: number; processing?: { provider: string; destination: string; retention: string; training: string; qualification: string; tokenizerQualification: string; tokenBound: "utf8_bytes"; costPolicy: "on_demand_shared_run" } }
  microdollarsPerCredit: number
}
export type AiUsage = { input: number; cachedInput: number; output: number; webSearchCalls?: number; embeddingInput?: number }
export type AiCreditAccount = {
  enabled: boolean
  paymentReview?: boolean
  lots: Array<{ kind: "included" | "purchased" | "adjustment"; expiresAt: string | null; expired?: boolean; restricted?: boolean; credits: number; spent: number; reserved: number }>
  history: Array<{ id: string; status: string; created_at: string; charged_credits: number | null; max_credits: number; settled_at: string | null }>
}
