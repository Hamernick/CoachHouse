import "server-only"
import { z } from "zod"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { DOCUMENTS } from "./core-document-definitions"
import { filterDocumentFileAudience } from "./document-file-audience"
import type { WorkspaceAiSourceScope } from "./workspace-ai-source-context"

const coreKinds = new Set<string>(DOCUMENTS.map(document => document.key))
const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value)
const rowSchema = z.object({
  id: z.string().uuid(), org_id: z.string(), document_kind: z.string(),
  storage_path: z.string(), deleted_at: z.string().nullable(),
})
export type LegacyDocumentReference = { kind: string; path: string }

export function isLegacyDocumentPath(path: string, organizationId: string, kind: string) {
  const policyId = kind.startsWith("policy:") ? kind.slice(7) : null
  if (!coreKinds.has(kind) && (!policyId || !/^[a-zA-Z0-9_-]+$/.test(policyId))) return false
  const prefix = policyId ? `${organizationId}/policies/${policyId}/` : `${organizationId}/${kind}/`
  return path.startsWith(prefix) && path.length > prefix.length && !/[\\\u0000-\u001f]/.test(path) &&
    path.split("/").every(segment => segment !== "" && segment !== "." && segment !== "..")
}

/** Additive to authenticated parent access. Profile paths never grant file access.
 * Existing core and policy tracking rows are the only canonical identities. */
export async function readableLegacyDocumentBindings(
  references: LegacyDocumentReference[], organizationId: string, actorId: string, scope?: WorkspaceAiSourceScope,
) {
  if (scope && scope.organizationId !== organizationId) throw new Error("Document scope changed.")
  const requested = new Map<string, string>()
  for (const reference of references) {
    if (!isLegacyDocumentPath(reference.path, organizationId, reference.kind)) continue
    if (requested.has(reference.kind) && requested.get(reference.kind) !== reference.path)
      throw new Error("Document bindings are ambiguous.")
    requested.set(reference.kind, reference.path)
  }
  const readable = new Map<string, { id: string; path: string }>()
  if (!requested.size) return readable
  const client = createSupabaseAdminClient({ actorId, requestTimeoutMs: 10000 })
  const kinds = [...requested.keys()]
  for (let offset = 0; offset < kinds.length; offset += 100) {
    const batch = kinds.slice(offset, offset + 100)
    const result = await client.from("organization_document_files")
      .select("id,org_id,document_kind,storage_path,deleted_at").eq("org_id", organizationId)
      .in("document_kind", batch).abortSignal(AbortSignal.timeout(10000))
    const parsed = z.array(rowSchema).safeParse(result.data)
    if (result.error || !parsed.success || parsed.data.some(row => row.org_id !== organizationId || !batch.includes(row.document_kind)) ||
      new Set(parsed.data.map(row => row.document_kind)).size !== parsed.data.length ||
      new Set(parsed.data.map(row => row.id)).size !== parsed.data.length)
      throw new Error("Document bindings could not be verified. Try again.")
    const matches = parsed.data.filter(row => row.deleted_at === null && requested.get(row.document_kind) === row.storage_path)
    for (const row of await filterDocumentFileAudience(matches, actorId, scope))
      readable.set(row.document_kind, { id: row.id, path: row.storage_path })
  }
  return readable
}

/** Display projection only. Never write the filtered result back to a profile. */
export async function projectLegacyDocumentBindings(
  profile: Record<string, unknown>, organizationId: string, actorId: string, scope?: WorkspaceAiSourceScope,
) {
  const documents = record(profile.documents) ? profile.documents : {}
  const policies = Array.isArray(profile.policies) ? profile.policies : []
  const references: LegacyDocumentReference[] = []
  for (const [kind, document] of Object.entries(documents))
    if (record(document) && typeof document.path === "string") references.push({ kind, path: document.path })
  for (const policy of policies)
    if (record(policy) && typeof policy.id === "string" && record(policy.document) && typeof policy.document.path === "string")
      references.push({ kind: `policy:${policy.id}`, path: policy.document.path })
  const bindings = await readableLegacyDocumentBindings(references, organizationId, actorId, scope)
  return {
    ...profile,
    ...(profile.documents !== undefined ? { documents: Object.fromEntries(Object.entries(documents).filter(([kind, document]) =>
      record(document) && typeof document.path === "string" && bindings.get(kind)?.path === document.path)) } : {}),
    ...(profile.policies !== undefined ? { policies: policies.filter(policy => {
      if (!record(policy) || !policy.document) return true
      return record(policy.document) && typeof policy.document.path === "string" && bindings.get(`policy:${policy.id}`)?.path === policy.document.path
    }) } : {}),
  }
}
