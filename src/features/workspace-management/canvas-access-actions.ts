"use server"

import { resolveOptionalAuthenticatedAppContext } from "@/lib/auth/request-context"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { assertWorkspaceCanvasAccess } from "@/lib/organization/workspace-canvas-access"
import { canEditOrganization } from "@/lib/organization/active-org"
import { canvasSourceReferencesSchema, emptyCanvasSourceReferences } from "@/lib/workspace/canvas-source-references"
import { retainedParticleFiles, retainedParticleDocuments } from "@/lib/organization/particle-ai-origins"
import { inaccessibleNativeFiles } from "@/lib/organization/particle-file-dependencies"
import { inaccessibleEditorDocuments } from "@/lib/organization/document-source-access"
import { workspaceAccessTargetSchema } from "./lib/access"

const requestSchema = workspaceAccessTargetSchema.extend({ sources: canvasSourceReferencesSchema.optional() })

/** Admission and known source checks only. Never return board contents or accept a client actor. */
export async function revalidateWorkspaceCanvasAccess(input: unknown) {
  const parsed = requestSchema.safeParse(input)
  if (!parsed.success) return { allowed: false as const }
  try {
    const context = await resolveOptionalAuthenticatedAppContext()
    if (!context || context.activeOrg.orgId !== parsed.data.orgId) return { allowed: false as const }
    const { user, activeOrg, profileAudience } = context
    await assertWorkspaceCanvasAccess({
      supabase: createSupabaseAdminClient({ actorId: user.id, requestTimeoutMs: 10000 }),
      orgId: activeOrg.orgId, userId: user.id,
      workspaceCanvasId: parsed.data.canvasId ?? undefined, allowAbsent: true,
    })
    const sources = parsed.data.sources ?? emptyCanvasSourceReferences()
    const [retainedFiles, retainedDocuments] = await Promise.all([
      retainedParticleFiles(activeOrg.orgId, user.id, sources.records),
      retainedParticleDocuments(activeOrg.orgId, user.id, sources.records),
    ])
    const [files, documents] = await Promise.all([
      inaccessibleNativeFiles([...sources.files, ...[...retainedFiles.values()].flatMap(ids => [...ids])], user.id),
      inaccessibleEditorDocuments([...sources.documents, ...[...retainedDocuments.values()].flatMap(ids => [...ids])], activeOrg.orgId, user.id),
    ])
    if (files.size || documents.size) return { allowed: false as const }
    return { allowed: true as const, viewerId: user.id, role: activeOrg.role,
      canEdit: profileAudience.isAdmin || canEditOrganization(activeOrg.role) }
  } catch {
    // Loss of authority and an unverified response both retire the old surface.
    return { allowed: false as const }
  }
}
