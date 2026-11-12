import "server-only"
import { z } from "zod"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

const originsSchema = z.array(z.strictObject({
  id: z.string().min(1).max(125), fileIds: z.array(z.uuid()), complete: z.literal(false),
})).max(500)

/** Retained observations, never a permission grant or proof of complete lineage.
 * No transcript or source body leaves the service-only database reader. */
export async function retainedParticleFiles(organizationId: string, actorId: string, recordIds: Iterable<string>) {
  const ids = [...new Set(recordIds)]
  const files = new Map<string, Set<string>>()
  if (!ids.length) return files
  const admin = createSupabaseAdminClient({ actorId, requestTimeoutMs: 10000 })
  for (let offset = 0; offset < ids.length; offset += 500) {
    const batch = ids.slice(offset, offset + 500)
    const result = await admin.rpc("read_workspace_particle_ai_files", {
      p_org_id: organizationId, p_actor_id: actorId, p_record_ids: batch,
    })
    const parsed = originsSchema.safeParse(result.data)
    if (result.error || !parsed.success || parsed.data.some(row => !batch.includes(row.id)) ||
        new Set(parsed.data.map(row => row.id)).size !== parsed.data.length)
      throw new Error("Particle source access could not be verified. Try again.")
    for (const row of parsed.data) files.set(row.id, new Set(row.fileIds))
  }
  return files
}

const documentsSchema = z.array(z.strictObject({
  id: z.string().min(1).max(125), documentIds: z.array(z.string()), complete: z.literal(false),
})).max(500)

/** Explicit recorded documents, including transitive and detached origins.
 * Empty source IDs remain dependencies so malformed references fail closed. */
export async function retainedParticleDocuments(organizationId: string, actorId: string, recordIds: Iterable<string>) {
  const ids = [...new Set(recordIds)]
  const documents = new Map<string, Set<string>>()
  if (!ids.length) return documents
  const admin = createSupabaseAdminClient({ actorId, requestTimeoutMs: 10000 })
  for (let offset = 0; offset < ids.length; offset += 500) {
    const batch = ids.slice(offset, offset + 500)
    const result = await admin.rpc("read_workspace_particle_ai_documents", {
      p_org_id: organizationId, p_actor_id: actorId, p_record_ids: batch,
    })
    const parsed = documentsSchema.safeParse(result.data)
    if (result.error || !parsed.success || parsed.data.some(row => !batch.includes(row.id)) ||
        new Set(parsed.data.map(row => row.id)).size !== parsed.data.length)
      throw new Error("Particle source access could not be verified. Try again.")
    for (const row of parsed.data) documents.set(row.id, new Set(row.documentIds))
  }
  return documents
}
