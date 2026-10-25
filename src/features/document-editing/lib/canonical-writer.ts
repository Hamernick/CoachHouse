import type { DocumentEditorSession } from "./editor-session"
import { documentCommitReceiptSchema, type DocumentCommitInput, type DocumentCommitReceipt } from "./version-contracts"

export type DocumentSaveResult={ok:true;receipt:DocumentCommitReceipt}|{ok:false;message:string;retrySameRequest:boolean}
export type DocumentCanonicalWriteState={status:"idle"|"saving"|"saved"|"error";operation:"save"|"restore";message?:string;receipt?:DocumentCommitReceipt}
/** One stable canonical request at a time. Native edits continue through Save;
 * unknown outcomes retry the exact prefix/ID, never a newly serialized draft. */
export function createDocumentCanonicalWriter({session,commit,onRestored}: {
  session:Pick<DocumentEditorSession,"getSnapshot"|"flush"|"refresh"|"room"|"setActive">
  commit:(input:DocumentCommitInput)=>Promise<DocumentSaveResult>
  onRestored?:(receipt:DocumentCommitReceipt)=>void
}) {
  let state:DocumentCanonicalWriteState={status:"idle",operation:"save"}
  const listeners=new Set<()=>void>()
  let request:DocumentCommitInput|null=null
  let retryRestoreId:string|undefined
  let flight:Promise<void>|null=null
  function report(next:DocumentCanonicalWriteState){state=next;for(const notify of listeners)notify()}
  async function perform(restoreVersionId?:string) {
    if(flight)return flight
    const current=session.getSnapshot()
    if(!current.editable || current.locked || current.status!=="ready")
      throw new Error("Reconnect with editing access before saving this file.")
    if(request && (request.restoreVersionId??null)!==(restoreVersionId??null))
      throw new Error("Retry the pending file operation before starting a different one.")
    if(restoreVersionId && !request && (current.dirty || current.pending))
      throw new Error("Save the shared draft before restoring a previous version.")
    retryRestoreId=restoreVersionId
    report({status:"saving",operation:restoreVersionId?"restore":"save"})
    flight=(async()=>{
      try {
        if(!request) {
          await session.flush()
          const room=await session.refresh()
          if(restoreVersionId && (session.getSnapshot().dirty || room.last_sequence!==room.canonical_sequence))
            throw new Error("Save the shared draft before restoring a previous version.")
          request={source:{provider:"coach_house",organizationId:room.org_id,fileId:room.file_id},
            requestId:crypto.randomUUID(),generation:room.generation,expectedRevision:room.base_revision,
            expectedUpdatedAt:room.base_updated_at,sequence:room.last_sequence,
            ...(restoreVersionId?{restoreVersionId}:{})}
        }
        const sent=request
        const result=await commit(sent)
        if(!result.ok) {
          if(!result.retrySameRequest)request=null
          throw new Error(result.message)
        }
        const receipt=documentCommitReceiptSchema.parse(result.receipt)
        if(receipt.fileId!==session.room.file_id || receipt.requestId!==sent.requestId ||
          receipt.restoredFrom!==(sent.restoreVersionId??null) ||
          (!sent.restoreVersionId && (receipt.generation!==sent.generation || receipt.sequence!==sent.sequence)) ||
          (sent.restoreVersionId && (receipt.generation===sent.generation || receipt.sequence!==0)))
          throw new Error("The file receipt did not match. Retry the original operation; your draft is retained.")
        if(session.getSnapshot().locked || session.getSnapshot().status==="closed")
          throw new Error("The document account or session changed. Recover it with the original account.")
        if(sent.restoreVersionId) {
          session.setActive(false)
          request=null
          report({status:"saved",operation:"restore",receipt})
          onRestored?.(receipt)
        } else {
          // The server-confirmed prefix is authoritative. Refresh merges any
          // newer native edits and may legitimately observe another user's Save.
          const room=await session.refresh()
          if(room.generation!==receipt.generation || room.canonical_sequence<receipt.sequence)
            throw new Error("The saved version could not be reconciled. Retry the original operation.")
          request=null
          report({status:"saved",operation:"save",receipt})
        }
      } catch(error) {
        report({status:"error",operation:restoreVersionId?"restore":"save",
          message:error instanceof Error?error.message:"Could not save. Your draft is retained."})
      }
    })().finally(()=>{flight=null})
    return flight
  }
  return {
    subscribe(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener)}},
    getSnapshot:()=>state,
    save:()=>perform(),
    restore:(versionId:string)=>perform(versionId),
    retry:()=>perform(request?.restoreVersionId??retryRestoreId),
    get pendingRequest(){return request},
  }
}
export type DocumentCanonicalWriter=ReturnType<typeof createDocumentCanonicalWriter>
