import "server-only"

import { createHash } from "node:crypto"
import { z } from "zod"
import { readAiRun } from "@/features/ai-credits"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import type { Json } from "@/lib/supabase"
import type { RoadmapSection } from "@/lib/roadmap"
import { aiApplicationSchema, aiRunProposal } from "../lib"

// Invoked only by the roadmap save action after session, organization and
// document-storage authorization. These are not client-callable actions.
export async function readAiDocumentApplication({ id,organizationId,userId,sectionId,revision,reviewedRevision }: {
  id:string; organizationId:string; userId:string; sectionId:string; revision:string | null | undefined; reviewedRevision?:string
}) {
  z.uuid().parse(id)
  const stored = await readAiRun(id,organizationId,userId)
  if (!stored) throw new Error("This AI proposal is unavailable.")
  const proposal = aiRunProposal(stored)
  if (proposal.status !== "succeeded" || proposal.target.sectionId !== sectionId ||
    proposal.target.organizationId !== organizationId || proposal.target.userId !== userId)
    throw new Error("This AI proposal belongs to another document.")
  return { application:proposal.application, stale:!proposal.application && proposal.target.revision !== revision && reviewedRevision !== revision }
}

export async function commitAiDocumentApplication({ id,organizationId,userId,organizationRevision,sourceRevision,reviewedRevision,profile,section }: {
  id:string; organizationId:string; userId:string; organizationRevision:string;
  sourceRevision:string | null; reviewedRevision?:string; profile:Record<string,unknown>; section:RoadmapSection
}) {
  const {data,error} = await createSupabaseAdminClient({actorId:userId,requestTimeoutMs:15000}).rpc("commit_workspace_ai_document",{
    p_id:id,p_org_id:organizationId,p_actor_id:userId,p_expected_updated_at:organizationRevision,
    p_expected_section_revision:sourceRevision,p_reviewed_revision:reviewedRevision,p_profile:profile as Json,p_section:section as unknown as Json,
    p_content_hash:createHash("sha256").update(section.content).digest("hex"),
  })
  if (error?.code === "40001") return { conflict:true as const }
  if (error) throw new Error("Unable to confirm this AI document save. Retry to recover its status.")
  return z.object({replayed:z.boolean(),application:aiApplicationSchema}).parse(data)
}
