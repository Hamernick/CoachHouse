import "server-only"

import { createHash } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase"
import type { DocumentSource } from "../types"
import { documentVersionSchema, type DocumentVersion } from "../lib/version-contracts"
import { documentRoomError, DocumentRoomError } from "../lib/room-client"
import { decodeCompleteDocument } from "../lib/contracts"
import { readLocalDocumentWithLocation, readCompleteBytes } from "./read-local-document"

export const VERSION_COLUMNS = "id,file_id,org_id,request_id,actor_id,storage_path,name,mime_type,size_bytes,content_hash,revision,source_updated_at,generation,sequence,restored_from,request_context,created_at"
export function contentHash(content: string) { return createHash("sha256").update(content).digest("hex") }
export function versionPath(source: Extract<DocumentSource, {provider:"coach_house"}>, requestId: string) {
  return `${source.organizationId}/library/versions/${source.fileId}/${requestId}.md`
}
export async function readVersion(client: SupabaseClient<Database>, source: Extract<DocumentSource, {provider:"coach_house"}>, filter: {id:string} | {requestId:string}) {
  let query = client.from("document_file_versions").select(VERSION_COLUMNS)
    .eq("file_id",source.fileId).eq("org_id",source.organizationId)
  query = "id" in filter ? query.eq("id",filter.id) : query.eq("request_id",filter.requestId)
  const {data,error} = await query.abortSignal(AbortSignal.timeout(15000)).maybeSingle()
  if(error) throw documentRoomError(error)
  return data ? documentVersionSchema.parse(data) : null
}

/** Version lookup is used by the new Save adapter only until its migration is
 * enabled. Existing readonly loaders have no dependency on the pending table. */
export async function readVersionedCanonical(client: SupabaseClient<Database>, source: Extract<DocumentSource,{provider:"coach_house"}>) {
  const {snapshot,storagePath} = await readLocalDocumentWithLocation(client,source)
  const {data,error} = await client.from("document_file_versions").select(VERSION_COLUMNS)
    .eq("file_id",source.fileId).eq("org_id",source.organizationId)
    .eq("storage_path",storagePath).eq("source_updated_at",snapshot.updatedAt).order("created_at",{ascending:false}).limit(1)
    .abortSignal(AbortSignal.timeout(15000)).maybeSingle()
  if(error) throw documentRoomError(error)
  if(!data) return {...snapshot,versionId:null}
  const version=documentVersionSchema.parse(data)
  if(contentHash(snapshot.content)!==version.content_hash)
    throw new DocumentRoomError("conflict","The original bytes no longer match their saved version. Preserve the draft.")
  return {...snapshot,revision:version.revision,versionId:version.id}
}
export async function readVersionContent(client: SupabaseClient<Database>, version: Pick<DocumentVersion,"storage_path" | "org_id" | "size_bytes" | "content_hash">) {
  if(!version.storage_path.startsWith(`${version.org_id}/library/`) || version.storage_path.split("/").includes(".."))
    throw new DocumentRoomError("access","This version is outside the document library.")
  const signed=await client.storage.from("org-documents").createSignedUrl(version.storage_path,60)
  if(signed.error || !signed.data?.signedUrl) throw new DocumentRoomError("unavailable","Could not open this version.")
  const response=await fetch(signed.data.signedUrl,{cache:"no-store",redirect:"error",signal:AbortSignal.timeout(15000)})
  if(!response.ok) throw new DocumentRoomError("unavailable","Could not download this version.")
  const bytes=await readCompleteBytes(response)
  const content=decodeCompleteDocument(bytes)
  if(bytes.byteLength!==version.size_bytes || contentHash(content)!==version.content_hash)
    throw new DocumentRoomError("conflict","The version bytes failed verification. The original is unchanged.")
  return content
}
