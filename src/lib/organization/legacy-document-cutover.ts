import "server-only"
import { createHash, randomUUID } from "node:crypto"
import { isDeepStrictEqual } from "node:util"
import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { isLegacyDocumentPath, readableLegacyDocumentBindings } from "./legacy-document-bindings"
import { mutateOrganizationProfile } from "./profile-mutation"
import { reconcileLegacyDocumentUploadStages, uploadLegacyDocumentStage } from "./legacy-document-upload-stage"

const documentSchema = z.object({
  path: z.string(), name: z.string().min(1), mime: z.string().min(1),
  size: z.number().int().positive().max(15 * 1024 * 1024), updatedAt: z.string(),
}).passthrough()
const fileSchema = z.object({
  id: z.string().uuid(), org_id: z.string().uuid(), document_kind: z.string(),
  storage_path: z.string(), size_bytes: z.number(), deleted_at: z.null(),
})
const record = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value)
const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex")
type Client = SupabaseClient<Database>
type Scope = { supabase: Client; orgId: string; documentKind: string }
export type LegacyCutoverSource = {
  orgId: string; documentKind: string; fileId: string
  document: z.infer<typeof documentSchema>
}
export type LegacyCutoverRecovery = { source: LegacyCutoverSource; bytes: Buffer; sha256: string }

function documentAt(profile: Record<string, unknown>, kind: string) {
  if (!kind.startsWith("policy:")) {
    if (!record(profile.documents)) throw new Error("Legacy document unavailable")
    return documentSchema.parse(profile.documents[kind])
  }
  if (!Array.isArray(profile.policies)) throw new Error("Legacy policy unavailable")
  const matches = profile.policies.filter(policy => record(policy) && policy.id === kind.slice(7))
  if (matches.length !== 1 || !record(matches[0])) throw new Error("Legacy policy identity is ambiguous")
  return documentSchema.parse(matches[0].document)
}

async function actorFor(supabase: Client) {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) throw new Error("Authenticated operator required")
  return data.user.id
}

/** Read through current source authority; this never infers ownership from a path. */
export async function readLegacyCutoverSource(scope: Scope): Promise<LegacyCutoverSource> {
  const actorId = await actorFor(scope.supabase)
  const organization = await scope.supabase.from("organizations").select("profile").eq("user_id", scope.orgId).single()
  if (organization.error || !record(organization.data?.profile)) throw new Error("Organization unavailable")
  const document = documentAt(organization.data.profile, scope.documentKind)
  if (!isLegacyDocumentPath(document.path, scope.orgId, scope.documentKind)) throw new Error("Invalid legacy path")
  const result = await scope.supabase.from("organization_document_files")
    .select("id,org_id,document_kind,storage_path,size_bytes,deleted_at")
    .eq("org_id", scope.orgId).eq("document_kind", scope.documentKind).single()
  const file = fileSchema.safeParse(result.data)
  if (result.error || !file.success || file.data.org_id !== scope.orgId || file.data.document_kind !== scope.documentKind ||
    file.data.storage_path !== document.path || file.data.size_bytes !== document.size)
    throw new Error("Legacy identity requires reconciliation")
  const binding = (await readableLegacyDocumentBindings(
    [{ kind: scope.documentKind, path: document.path }], scope.orgId, actorId,
  )).get(scope.documentKind)
  if (binding?.id !== file.data.id) throw new Error("Legacy document access unavailable")
  return { orgId: scope.orgId, documentKind: scope.documentKind, fileId: file.data.id, document }
}

async function readBytes(source: LegacyCutoverSource, actorId: string) {
  const client = createSupabaseAdminClient({ actorId, requestTimeoutMs: 10000 })
  const result = await client.storage.from("org-documents").download(source.document.path)
  if (result.error || !result.data || result.data.size !== source.document.size) throw new Error("Recovery bytes unavailable")
  return Buffer.from(await result.data.arrayBuffer())
}

/** Caller saves this in its existing private evidence snapshot and independently
 * reads it back before replacement. An in-memory capture alone is not recovery. */
export async function captureLegacyCutoverRecovery(scope: Scope): Promise<LegacyCutoverRecovery> {
  const source = await readLegacyCutoverSource(scope)
  const bytes = await readBytes(source, await actorFor(scope.supabase))
  if (!isDeepStrictEqual(source, await readLegacyCutoverSource(scope))) throw new Error("Legacy document changed; recapture")
  return { source, bytes, sha256: digest(bytes) }
}

/** Internal preparation/forward recovery only; no route, cutover-marker or folder
 * writer. The backup reader must read the independently saved private snapshot.
 * A fresh path avoids resurrecting old signed capabilities. Existing SQL owns
 * identity, authorization, upload accounting, retained versions and cleanup.
 * Outgoing cleanup is deliberately left to its existing owner after readback. */
export async function replaceLegacyDocumentFromRecovery({
  supabase, expected, readRecovery,
}: {
  supabase: Client; expected: LegacyCutoverSource
  readRecovery: () => Promise<LegacyCutoverRecovery>
}) {
  const recovery = await readRecovery()
  const document = documentSchema.parse(recovery.source.document)
  if (recovery.source.orgId !== expected.orgId || recovery.source.documentKind !== expected.documentKind ||
    recovery.source.fileId !== expected.fileId || !isLegacyDocumentPath(document.path, expected.orgId, expected.documentKind) ||
    !Buffer.isBuffer(recovery.bytes) || recovery.bytes.length !== document.size || digest(recovery.bytes) !== recovery.sha256)
    throw new Error("Recovery snapshot does not match the canonical file")
  // This is relocation/recovery, not an editor: never overwrite a later user's
  // content or metadata with an older backup, even if the caller supplies it.
  const withoutPath = ({ path: _path, ...rest }: typeof document) => rest
  if (!isDeepStrictEqual(withoutPath(document), withoutPath(expected.document)))
    throw new Error("Recovery metadata changed; reconcile before replacement")
  const scope = { supabase, orgId: expected.orgId, documentKind: expected.documentKind }
  if (!isDeepStrictEqual(expected, await readLegacyCutoverSource(scope))) throw new Error("Legacy document changed; recapture")
  const actorId = await actorFor(supabase)
  const path = `${expected.document.path.slice(0, expected.document.path.lastIndexOf("/") + 1)}${randomUUID()}-cutover`
  const stage = { orgId: expected.orgId, documentKind: expected.documentKind, actorId, path }
  try {
    await uploadLegacyDocumentStage(stage, recovery.bytes, document.mime)
    const next = { ...document, path }
    const uploaded = await readBytes({ ...expected, document: next }, actorId)
    if (digest(uploaded) !== recovery.sha256) throw new Error("Replacement bytes did not verify")
    const mutation = await mutateOrganizationProfile({
      supabase, orgId: expected.orgId,
      mutate: profile => {
        if (!isDeepStrictEqual(documentAt(profile, expected.documentKind), expected.document))
          return { error: "Legacy document changed; recapture", status: 409 }
        const nextProfile = expected.documentKind.startsWith("policy:")
          ? { ...profile, policies: (profile.policies as Record<string, unknown>[]).map(policy =>
            policy.id === expected.documentKind.slice(7) ? { ...policy, document: next } : policy) }
          : { ...profile, documents: { ...(profile.documents as Record<string, unknown>), [expected.documentKind]: next } }
        return { changed: true, nextProfile, value: null }
      },
    })
    if ("error" in mutation) throw new Error(mutation.error)
    const current = await readLegacyCutoverSource(scope)
    if (!isDeepStrictEqual(current, { ...expected, document: next }) || digest(await readBytes(current, actorId)) !== recovery.sha256)
      throw new Error("Replacement requires independent reconciliation; retain recovery snapshot")
    return { current, oldPath: expected.document.path, sha256: recovery.sha256, activationAllowed: false as const }
  } finally {
    // Exact staged-path recovery resolves lost commit replies; it cannot delete
    // a committed/current path. No retry of the content mutation occurs here.
    await reconcileLegacyDocumentUploadStages(stage)
  }
}
