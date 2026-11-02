"use server"
import { createHash } from "node:crypto"
import { z } from "zod"
import { resolveAuthenticatedAppContext } from "@/lib/auth/request-context"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { readResearchRun } from "./server/research-run"
import { validateResearchRecoveryDraft } from "./lib/research-draft"
import { researchDraftCheckpointSchema, researchDraftWriteSchema, type ResearchDraftReply } from "./lib/research-draft-checkpoint"
import type { ResearchTarget } from "./research-types"

/** Private recovery is separate from immutable generation and canonical proposals. */
export async function accessWorkspaceResearchDraft(id: string, target: ResearchTarget, input?: unknown): Promise<ResearchDraftReply> {
  try {
    z.uuid().parse(id)
    const write = input === undefined ? undefined : researchDraftWriteSchema.parse(input)
    const actor = await resolveAuthenticatedAppContext()
    if (actor.activeOrg.orgId !== target.organizationId) throw new Error("Scope changed")
    // This reader verifies the run owner, scope and every observed source again.
    const run = await readResearchRun(id, target)
    if (!run.result || run.applicability !== "review_required") throw new Error("Result unavailable")
    if (write?.draft) validateResearchRecoveryDraft(run.result, write.draft, write.attempted)
    const base = createHash("sha256").update(JSON.stringify(run.result)).digest("hex")
    const { data, error } = await createSupabaseAdminClient({ actorId: actor.user.id, requestTimeoutMs: 10000 }).rpc("access_workspace_research_draft", {
      p_run_id: id, p_org_id: target.organizationId, p_actor_id: actor.user.id, p_base: base,
      p_edit_id: write?.editId ?? null, p_revision: write?.revision ?? null,
      p_draft: write?.draft ?? null, p_attempted: write?.attempted ?? false,
    })
    if (error) {
      if (error.code === "40001") return { error: "Draft changed elsewhere. Reopen research before saving.", conflict: true }
      throw new Error("Draft unavailable")
    }
    const checkpoint = researchDraftCheckpointSchema.parse(data)
    if (checkpoint.draft) validateResearchRecoveryDraft(run.result, checkpoint.draft, checkpoint.attempted)
    return { checkpoint }
  } catch { return { error: "Draft could not be verified. Your edits are still here. Retry." } }
}
