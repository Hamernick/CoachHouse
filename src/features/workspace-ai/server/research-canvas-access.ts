import "server-only"
import { assertWorkspaceCanvasAccess } from "@/lib/organization/workspace-canvas-access"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import type { ResearchContext } from "./research-context"
import { ResearchRecoveryError } from "./research-recovery"

/** A loaded context is a snapshot, not authority for a later disclosure. */
export async function assertResearchCanvasAccess(context: ResearchContext) {
  try {
    await assertWorkspaceCanvasAccess({
      supabase: createSupabaseAdminClient({ actorId: context.user.id, requestTimeoutMs: 10000 }),
      orgId: context.target.organizationId, userId: context.user.id,
      workspaceCanvasId: context.canvasId ?? undefined, allowAbsent: true,
    })
  } catch {
    throw new ResearchRecoveryError("verification_unavailable")
  }
}
