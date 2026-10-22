import { z } from "zod"
import { aiPlanContentSchema, aiPlanTargetSchema, type AiPlanContent, type AiPlanProposal } from "../ai-plan-types"

const key = z.string().regex(/^[a-zA-Z0-9_-]{1,40}$/)
export const generatedPlanShape = z.object({
  title: z.string().trim().min(1).max(240), summary: z.string().max(1500),
  assumptions: z.array(z.string().max(500)).max(10), questions: z.array(z.string().max(500)).max(10),
  steps: z.array(z.object({ key, title: z.string().trim().min(1).max(240), kind: z.enum(["action", "decision"]) }).strict()).max(20),
  edges: z.array(z.object({ source: key, target: key, label: z.string().trim().max(120) }).strict()).max(40),
}).strict()
export const generatedPlanSchema = generatedPlanShape.superRefine((value, ctx) => {
  const ids = new Set(value.steps.map(step => step.key))
  const bad = () => ctx.addIssue({ code: "custom", message: "The proposal contains invalid steps or branches." })
  if (ids.size !== value.steps.length || (!value.steps.length && !value.questions.length)) bad()
  if (value.edges.some(edge => !ids.has(edge.source) || !ids.has(edge.target) || edge.source === edge.target)) bad()
  if (new Set(value.edges.map(edge => JSON.stringify(edge))).size !== value.edges.length) bad()
  for (const step of value.steps.filter(item => item.kind === "decision")) {
    const outcomes = value.edges.filter(edge => edge.source === step.key)
    if (outcomes.length < 2 || outcomes.some(edge => !edge.label) || new Set(outcomes.map(edge => edge.label.toLowerCase())).size !== outcomes.length) bad()
  }
  const visiting = new Set<string>(); const visited = new Set<string>()
  const cyclic = (id: string): boolean => {
    if (visiting.has(id)) return true
    if (visited.has(id)) return false
    visiting.add(id)
    if (value.edges.filter(edge => edge.source === id).some(edge => cyclic(edge.target))) return true
    visiting.delete(id); visited.add(id); return false
  }
  if (value.steps.some(step => cyclic(step.key))) bad()
})
export function bindAiPlan(text: string, runId: string, objectiveId: string, uuid: () => string): AiPlanContent {
  const value = generatedPlanSchema.parse(JSON.parse(text))
  const ids = new Map(value.steps.map(step => [step.key, uuid()]))
  return aiPlanContentSchema.parse({ summary: value.summary, assumptions: value.assumptions, questions: value.questions,
    draft: { id: runId, objectiveId, revision: 0, title: value.title,
      steps: value.steps.map(step => ({ id: ids.get(step.key), title: step.title, status: "todo", expectedUpdatedAt: null })),
      edges: value.edges.map(edge => ({ id: uuid(), source: ids.get(edge.source), target: ids.get(edge.target), label: edge.label })),
      decisions: value.steps.filter(step => step.kind === "decision").map(step => ({ stepId: ids.get(step.key), selectedEdgeId: null })),
    } })
}
export function aiPlanProposal(value: unknown): AiPlanProposal {
  const run = z.object({ id: z.uuid(), task: z.literal("plan"), actor_id: z.uuid(), org_id: z.uuid(),
    target: aiPlanTargetSchema.extend({ kind: z.literal("plan"), title: z.string(), description: z.string().nullable(), revisionSourceRunId: z.uuid().optional() }),
    status: z.enum(["reserved", "running", "reconciling", "succeeded", "failed", "canceled"]), proposal: z.string().nullable(), charged_credits: z.number().nullable(), max_credits: z.number(),
  }).parse(value)
  if (run.target.userId !== run.actor_id || run.target.organizationId !== run.org_id) throw new Error("Invalid proposal scope.")
  const content = run.proposal ? aiPlanContentSchema.parse(JSON.parse(run.proposal)) : null
  if (content && (content.draft.id !== run.id || content.draft.objectiveId !== run.target.objectiveId)) throw new Error("Invalid proposal target.")
  return { id: run.id, target: aiPlanTargetSchema.parse({ userId: run.actor_id, organizationId: run.org_id, objectiveId: run.target.objectiveId, revision: run.target.revision }), status: run.status, content, credits: run.charged_credits, maxCredits: run.max_credits, application: null, revisionSourceRunId: run.target.revisionSourceRunId }
}
