import "server-only"

import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { documentCommitSchema, documentCommitReceiptSchema, documentVersionSchema, receiptFromVersion, type DocumentCommitInput } from "../lib/version-contracts"
import { readDocumentRoom, DocumentRoomError, documentRoomError } from "../lib/room-client"
import { requireDocumentRoomActor } from "./room-access"
import { contentHash, versionPath, readVersion, readVersionContent, readVersionedCanonical, VERSION_COLUMNS } from "./version-reader"
import { reserveVersionCommit, abandonVersionStage } from "./version-staging"
import { stageVersionObject } from "./stage-version"
import { serializeDocumentPrefix, prepareRestoredMarkdown } from "./version-serialization"

/** Not exported as a public action until migration, purge and client source
 * advancement are ready. Every invocation still verifies current session/RLS. */
export async function commitDocumentVersion(value: DocumentCommitInput) {
  const input=documentCommitSchema.parse(value)
  const actor=await requireDocumentRoomActor(input.source)
  if(!actor.editable) throw new DocumentRoomError("access","You do not have editing access to this file.")
  const previousReceipt=await readVersion(actor.supabase,actor.source,{requestId:input.requestId})
  if(previousReceipt) return receiptFromVersion(previousReceipt,input,actor.userId)
  const [room,original]=await Promise.all([
    readDocumentRoom(actor.supabase,actor.source),readVersionedCanonical(actor.supabase,actor.source),
  ])
  if(!room || room.generation!==input.generation || room.base_revision!==input.expectedRevision ||
    original.revision!==input.expectedRevision || new Date(original.updatedAt).getTime()!==new Date(input.expectedUpdatedAt).getTime() ||
    new Date(room.base_updated_at).getTime()!==new Date(input.expectedUpdatedAt).getTime() ||
    input.sequence<room.canonical_sequence || input.sequence>room.last_sequence)
    throw new DocumentRoomError("conflict","The file or shared session changed. Keep the draft and refresh before saving.")
  let content: string
  let checkpoint: string | undefined
  if(input.restoreVersionId) {
    if(room.last_sequence!==room.canonical_sequence || input.sequence!==room.last_sequence)
      throw new DocumentRoomError("conflict","Save the shared draft before restoring a previous version.")
    const restored=await readVersion(actor.supabase,actor.source,{id:input.restoreVersionId})
    if(!restored) throw new DocumentRoomError("access","This version is unavailable.")
    content=await readVersionContent(actor.supabase,restored)
    checkpoint=prepareRestoredMarkdown(content)
  } else content=await serializeDocumentPrefix(actor.supabase,room,input.sequence,original.content.startsWith("\uFEFF"))
  const admin=createSupabaseAdminClient({actorId:actor.userId,requestTimeoutMs:15000})
  const path=versionPath(actor.source,input.requestId)
  const previousPath=path.replace(/\.md$/,"-previous.md")
  const args={
    p_file_id:actor.source.fileId,p_actor_id:actor.userId,p_request_id:input.requestId,p_generation:input.generation,
    p_expected_revision:input.expectedRevision,p_expected_updated_at:input.expectedUpdatedAt,p_sequence:input.sequence,
    p_previous_hash:contentHash(original.content),p_new_hash:contentHash(content),p_new_size:new TextEncoder().encode(content).byteLength,
    ...(input.restoreVersionId ? {p_restore_version_id:input.restoreVersionId,p_restore_checkpoint_base64:checkpoint} : {}),
  }
  if(!await reserveVersionCommit(admin,args)) {
    const confirmed=await readVersion(actor.supabase,actor.source,{requestId:input.requestId})
    if(confirmed) return receiptFromVersion(confirmed,input,actor.userId)
    throw new DocumentRoomError("unavailable","The Save receipt is unavailable. Retry the original request.")
  }
  await stageVersionObject(admin,actor.source.organizationId,path,content)
  if(!original.versionId) await stageVersionObject(admin,actor.source.organizationId,previousPath,original.content)
  const result=await admin.rpc("commit_uploaded_document_version",args).abortSignal(AbortSignal.timeout(15000))
  if(result.error) {
    // A timeout/lost response can follow a successful COMMIT. Read its immutable
    // receipt before deleting anything. Unknown outcomes retain staged bytes.
    const committed=await readVersion(actor.supabase,actor.source,{requestId:input.requestId}).catch(()=>undefined)
    if(committed) return receiptFromVersion(committed,input,actor.userId)
    if(committed===null && ["42501","40001","22023","54000","23514"].includes(result.error.code)) {
      // Fence retries before deleting through Storage. A concurrent successful
      // commit prevents abandonment; failed cleanup continues to reserve bytes.
      await abandonVersionStage(admin,args,original.versionId ? [path] : [path,previousPath]).catch(()=>undefined)
    }
    throw documentRoomError(result.error)
  }
  const receipt=documentCommitReceiptSchema.parse(result.data)
  if(receipt.fileId!==actor.source.fileId || receipt.requestId!==input.requestId ||
    (!input.restoreVersionId && (receipt.generation!==input.generation || receipt.sequence!==input.sequence)) ||
    (input.restoreVersionId && (receipt.generation===input.generation || receipt.sequence!==0)) ||
    receipt.restoredFrom!==(input.restoreVersionId ?? null))
    throw new DocumentRoomError("conflict","The Save receipt did not match. Retain the draft and retry the original request.")
  return receipt
}

export async function listDocumentVersions(source: DocumentCommitInput["source"]) {
  const actor=await requireDocumentRoomActor(source)
  const {data,error}=await actor.supabase.from("document_file_versions").select(VERSION_COLUMNS)
    .eq("file_id",actor.source.fileId).eq("org_id",actor.source.organizationId)
    .order("created_at",{ascending:false}).order("id",{ascending:false}).limit(50)
    .abortSignal(AbortSignal.timeout(15000))
  if(error) throw documentRoomError(error)
  return (data ?? []).map(row=>documentVersionSchema.parse(row))
}
