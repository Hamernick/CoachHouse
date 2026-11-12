import type { ResearchRequest, ResearchResult } from "../research-types"

/** A reply is a successful metered turn, never an executable artifact. Legacy
 * results without the discriminator retain their existing proposal semantics. */
export const isResearchReply = (result: Pick<ResearchResult, "responseKind"> | null | undefined) =>
  result?.responseKind === "answer" || result?.responseKind === "clarify"

export const supportsConversationReplies = (request: Pick<ResearchRequest, "target" | "parentRunId" | "publicResearch">) =>
  !request.publicResearch && (request.target.mode === "new_objective" || Boolean(request.parentRunId))

export function validateResearchResponse(result: Pick<ResearchResult, "responseKind" | "summary" | "items" | "decisions" | "removeReferences" | "questions" | "outputBindings" | "answerEvidenceIds">) {
  if (isResearchReply(result)) {
    if (!result.summary.trim() || result.items.length || result.decisions?.length || result.removeReferences?.length || result.questions.length || result.outputBindings?.length)
      throw new Error("A chat reply cannot contain plan mutations or artifact bindings.")
  } else if (result.answerEvidenceIds?.length) throw new Error("Plan evidence belongs to its proposed items.")
}
