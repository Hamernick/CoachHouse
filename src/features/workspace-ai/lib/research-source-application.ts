import type { ResearchResult } from "../research-types"
import { applyResearchDraft, createResearchDraft, researchDraftError } from "./research-draft"

type Draft = ReturnType<typeof createResearchDraft>
/** Explicit Apply only. Preserve the exact reviewed payload before crossing a
 * source boundary, and stop if the originating session disappeared. */
export async function prepareReviewedResearchSources({ result, draft, saveDraft, applySources, isCurrent }: {
  result: ResearchResult; draft?: Draft;
  saveDraft: (draft: Draft, attempted: boolean) => Promise<boolean>;
  applySources: () => Promise<boolean>; isCurrent: () => boolean;
}) {
  const reviewed = draft ?? createResearchDraft(result)
  const error = researchDraftError(result, reviewed)
  if (error) throw new Error(error)
  const hasSources = applyResearchDraft(result, reviewed).items.some(item => item.kind === "data_view")
  if ((draft || hasSources) && !await saveDraft(reviewed, true)) return { ready: false as const }
  if (!isCurrent()) return { ready: false as const }
  if (hasSources && !await applySources()) return { ready: false as const }
  return { ready: true as const, draft: draft || hasSources ? reviewed : undefined }
}
