import "server-only"
import { createHash } from "node:crypto"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { researchDraftCheckpointSchema, sameResearchDraft } from "../lib/research-draft-checkpoint"
import { createResearchDraft, validateResearchRecoveryDraft, type ResearchDraft } from "../lib/research-draft"
import type { ResearchResult } from "../research-types"

export async function readResearchOutputDraft(result: ResearchResult, actorId: string) {
  const { data, error } = await createSupabaseAdminClient({ actorId, requestTimeoutMs: 10000 }).rpc("access_workspace_research_draft", {
    p_run_id: result.runId, p_org_id: result.target.organizationId, p_actor_id: actorId,
    p_base: createHash("sha256").update(JSON.stringify(result)).digest("hex"),
    p_edit_id: null, p_revision: null, p_draft: null, p_attempted: false,
  })
  if (error) throw new Error("The saved source-effect draft could not be verified. Retry without changing it.")
  const checkpoint = researchDraftCheckpointSchema.parse(data)
  if (checkpoint.draft) validateResearchRecoveryDraft(result, checkpoint.draft, checkpoint.attempted)
  return checkpoint
}

export async function requireResearchOutputDraft(result: ResearchResult, actorId: string, input?: ResearchDraft) {
  const checkpoint = await readResearchOutputDraft(result, actorId)
  if (!checkpoint.attempted || !checkpoint.draft || !sameResearchDraft(checkpoint.draft, input ?? createResearchDraft(result)))
    throw new Error("Review and preserve this exact source-effect draft before applying it.")
  return checkpoint.draft
}
