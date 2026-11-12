import "server-only"
import { z } from "zod"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { loadAiDocumentSource, requireAiActor } from "./document-context"
import type { AiDocumentTarget } from "../types"

const sourcesSchema = z.strictObject({
  sources: z.array(z.strictObject({ runId: z.uuid(), sectionId: z.string().min(1).max(120), kind: z.enum(["editor", "selection"]) })).min(1).max(64),
  complete: z.literal(false),
})

// Retained identities cannot grant access. Recheck current actor/source access
// before disclosing or reusing a draft; never trust its mutable target alone.
export async function assertAiDocumentSources(id: string, target: AiDocumentTarget, selection: boolean,
  authorizedActor?: Awaited<ReturnType<typeof requireAiActor>>) {
  z.uuid().parse(id)
  const actor = authorizedActor ?? await requireAiActor(target)
  if (actor.userId !== target.userId || actor.organizationId !== target.organizationId)
    throw new Error("Document source access denied.")
  const { data, error } = await createSupabaseAdminClient({ actorId: actor.userId, requestTimeoutMs: 10000 })
    .rpc("read_workspace_ai_document_sources", { p_org_id: actor.organizationId, p_actor_id: actor.userId, p_run_id: id })
  const parsed = sourcesSchema.safeParse(data)
  if (error || !parsed.success || parsed.data.sources[0].runId !== id ||
    parsed.data.sources[0].kind !== (selection ? "selection" : "editor") ||
    parsed.data.sources.some(source => source.sectionId !== target.sectionId) ||
    new Set(parsed.data.sources.map(source => source.runId)).size !== parsed.data.sources.length)
    throw new Error("Document sources could not be verified. Reopen the document.")
  // A revision chain stays within one section. One current RLS source lookup
  // covers its editor inputs; explicit selections do not imply a stored read.
  if (parsed.data.sources.some(source => source.kind === "editor")) await loadAiDocumentSource(target, actor)
}
