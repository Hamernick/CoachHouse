import "server-only"

import { createHash } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase"
import { z } from "zod"
import { decodeCompleteDocument, DOCUMENT_EDIT_BYTES, documentSnapshotSchema } from "../lib"
import type { DocumentSource, DocumentSnapshot } from "../types"

const rowSchema = z.object({
  name: z.string(), mime_type: z.string(), size_bytes: z.number().int().nonnegative(),
  storage_path: z.string(), updated_at: z.string(), deleted_at: z.string().nullable(),
})

export async function readLocalDocument(
  supabase: SupabaseClient<Database>,
  source: Extract<DocumentSource, { provider: "coach_house" }>
): Promise<DocumentSnapshot> {
  return (await readLocalDocumentWithLocation(supabase, source)).snapshot
}

/** Private storage location stays server-side; public snapshots expose no paths. */
export async function readLocalDocumentWithLocation(
  supabase: SupabaseClient<Database>,
  source: Extract<DocumentSource, { provider: "coach_house" }>
) {
  const { data, error } = await supabase.from("organization_document_files")
    .select("name, mime_type, size_bytes, storage_path, updated_at, deleted_at")
    .eq("org_id", source.organizationId).eq("id", source.fileId)
    .is("document_kind", null).abortSignal(AbortSignal.timeout(15000)).maybeSingle()
  if (error) throw new Error("Could not load this document.")
  if (!data) throw new Error("Document not found.")
  const row = rowSchema.parse(data)
  if (row.deleted_at) throw new Error("Restore this document before opening it.")
  if (!row.storage_path.startsWith(`${source.organizationId}/library/`) || row.storage_path.split("/").includes(".."))
    throw new Error("Document not found.")
  if (!/\.(md|markdown)$/i.test(row.name)) throw new Error("This format does not have a complete-content editing adapter yet.")
  if (row.size_bytes > DOCUMENT_EDIT_BYTES) throw new Error("This file exceeds the current editing limit.")
  const { data: signed, error: signingError } = await supabase.storage.from("org-documents").createSignedUrl(row.storage_path, 60)
  if (signingError || !signed?.signedUrl) throw new Error("Could not open this document.")
  const response = await fetch(signed.signedUrl, {
    cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) throw new Error("Could not download this document.")
  const content = decodeCompleteDocument(await readCompleteBytes(response))
  return { storagePath: row.storage_path, snapshot: documentSnapshotSchema.parse({
    source, name: row.name, format: "markdown", content, updatedAt: row.updated_at,
    revision: createHash("sha256").update(`${row.storage_path}\0${row.updated_at}\0${content}`).digest("hex"),
    collaboration: { state: "unavailable", canCommit: false },
  }) }
}

export async function readCompleteBytes(response: Response) {
  if (Number(response.headers.get("content-length")) > DOCUMENT_EDIT_BYTES)
    throw new Error("This file exceeds the current editing limit.")
  const reader = response.body?.getReader()
  if (!reader) throw new Error("The document response is incomplete.")
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > DOCUMENT_EDIT_BYTES) throw new Error("This file exceeds the current editing limit.")
      chunks.push(value)
    }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
    return bytes
  } catch (error) {
    await reader.cancel().catch(() => undefined)
    throw error
  } finally { reader.releaseLock() }
}
