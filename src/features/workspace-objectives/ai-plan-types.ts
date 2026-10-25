import { z } from "zod"
import type { AiCreditAccount } from "@/features/ai-credits/client"
import { planDraftSchema } from "./plan-types"

export const aiPlanDocumentSchema = z.object({ sectionId: z.string().min(1).max(100), title: z.string().max(200), revision: z.string().nullable() }).strict()
export type AiPlanDocument = z.infer<typeof aiPlanDocumentSchema>
export const aiSavedPlanSchema = z.object({ id: z.uuid(), revision: z.number().int().positive() }).strict()
export const aiPlanTargetSchema = z.object({ userId: z.uuid(), organizationId: z.uuid(), objectiveId: z.uuid(), revision: z.string().min(1), plan: aiSavedPlanSchema.optional() }).strict()
export type AiPlanTarget = z.infer<typeof aiPlanTargetSchema>
export const aiPlanRequestSchema = z.object({
  id: z.uuid(), target: aiPlanTargetSchema, document: aiPlanDocumentSchema.optional(), prompt: z.string().trim().min(1).max(4000),
  tariffVersion: z.string().min(1).max(80), maximumCredits: z.number().int().positive().max(125), reviseRunId: z.uuid().optional(),
}).strict()
export type AiPlanRequest = z.infer<typeof aiPlanRequestSchema>
export const aiPlanContentSchema = z.object({ draft: planDraftSchema, summary: z.string().max(1500), assumptions: z.array(z.string().max(500)).max(10), questions: z.array(z.string().max(500)).max(10) })
export const aiPlanApplicationSchema = z.object({ run_id: z.uuid(), plan_id: z.uuid(), saved_at: z.string(), undone_at: z.string().nullable() })
export type AiPlanApplication = z.infer<typeof aiPlanApplicationSchema>
export type AiPlanContent = z.infer<typeof aiPlanContentSchema>
export type AiPlanProposal = { id: string; target: AiPlanTarget; status: string; content: AiPlanContent | null; credits: number | null; maxCredits: number; application: AiPlanApplication | null; revisionSourceRunId?: string; document?: AiPlanDocument; baseline?: z.infer<typeof planDraftSchema> }
export type AiPlanQuote = { maximumCredits: number; tariffVersion: string; account: AiCreditAccount; documents?: AiPlanDocument[] }
export type AiPlanTransport = {
  quote: (target: AiPlanTarget) => Promise<AiPlanQuote>
  generate: (request: AiPlanRequest) => Promise<{ proposal?: AiPlanProposal; error?: string; reserved?: boolean }>
  read: (id: string, target: AiPlanTarget) => Promise<AiPlanProposal>
  stop: (id: string, target: AiPlanTarget) => Promise<unknown>
  apply: (id: string, target: AiPlanTarget) => Promise<AiPlanApplication>
  undo: (id: string, target: AiPlanTarget) => Promise<AiPlanApplication>
}
