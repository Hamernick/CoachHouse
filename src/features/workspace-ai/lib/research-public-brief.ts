import { z } from "zod"

/** Exact human review, never model/tool-derived permission or private-context opt-in. */
export const researchPublicBriefSchema = z.strictObject({
  version: z.literal(1), destination: z.literal("openai_web_search"),
  brief: z.string().trim().min(1).max(1000), approved: z.literal(true),
})
export type ResearchPublicBrief = z.infer<typeof researchPublicBriefSchema>
export const publicResearchDestination = "OpenAI web search"
