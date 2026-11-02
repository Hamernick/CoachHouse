import { z } from "zod"
import { researchHistorySchema, researchResultSchema } from "../research-types"

// Only a validated, durable success can expose a proposal. Progress and terminal
// failure are never substitutes for a saved result or an application receipt.
export const researchSnapshotSchema = z.strictObject({
  version: z.literal(1),
  id: z.uuid(),
  status: researchHistorySchema.element.shape.status,
  credits: z.number().nonnegative().nullable(),
  result: researchResultSchema.nullable(),
  appliedObjectiveId: z.uuid().optional(),
  // A run has one immutable saved result. Preview revision zero is never durable;
  // edits belong to a separate draft/proposal, not a new generation revision.
  resultRevision: z.literal(1).nullable(),
  applicability: z.enum(["unavailable", "review_required", "already_applied"]),
}).superRefine((snapshot, context) => {
  const receipt = snapshot.appliedObjectiveId !== undefined
  const result = snapshot.result !== null
  if (snapshot.status === "succeeded" ? result === receipt : result || receipt)
    context.addIssue({ code: "custom", message: "Inconsistent saved research state." })
  if (snapshot.result && snapshot.result.runId !== snapshot.id)
    context.addIssue({ code: "custom", message: "Research result identity changed." })
  if (snapshot.resultRevision !== (snapshot.status === "succeeded" ? 1 : null) ||
    snapshot.applicability !== (receipt ? "already_applied" : result ? "review_required" : "unavailable"))
    context.addIssue({ code: "custom", message: "Inconsistent research revision or applicability." })
})
