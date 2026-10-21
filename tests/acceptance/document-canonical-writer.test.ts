import { describe,expect,it,vi } from "vitest"
import * as Y from "yjs"
import { createDocumentCanonicalWriter, type DocumentSaveResult } from "@/features/document-editing/lib/canonical-writer"
import { createDocumentEditorSession } from "@/features/document-editing/lib/editor-session"
import type { DocumentRoomTransport } from "@/features/document-editing/lib/room-sync"
import type { DocumentCommitInput, DocumentCommitReceipt } from "@/features/document-editing/lib/version-contracts"
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`
async function settle(){for(let i=0;i<40;i++)await Promise.resolve()}
async function fixture(){
  const server=new Y.Doc();server.getText("content").insert(0,"Original")
  const checkpoint="\\x"+Buffer.from(Y.encodeStateAsUpdate(server)).toString("hex")
  let room={id:id(1),org_id:id(2),file_id:id(3),generation:id(4),base_revision:"original",base_updated_at:"2026-10-14T00:00:00Z",checkpoint,checkpoint_sequence:0,last_sequence:0,canonical_sequence:0,recovery_bytes:0}
  let callbacks!:Parameters<DocumentRoomTransport["subscribe"]>[0]
  const session=createDocumentEditorSession({expected:room,allowEditing:true,store:{save:async()=>{},close:()=>{}},
    transport:{subscribe:value=>{callbacks=value;return()=>{}},read:async()=>({room,editable:true,
      canonical:{versionId:id(5),orgId:room.org_id,fileId:room.file_id,generation:room.generation,revision:room.base_revision,updatedAt:room.base_updated_at,sequence:room.canonical_sequence}}),tail:async()=>[]},
    commit:async batch=>{
      Y.applyUpdate(server,batch.update);room={...room,last_sequence:room.last_sequence+1}
      callbacks.update({room_id:room.id,generation:room.generation,sequence:room.last_sequence,batch_id:batch.id,actor_id:id(6),payload:"\\x"+Buffer.from(batch.update).toString("hex")})
      return{batchId:batch.id,generation:room.generation,sequence:room.last_sequence}
    }})
  session.start();callbacks.connected();await settle()
  function saved(input:DocumentCommitInput):DocumentCommitReceipt {
    const generation=input.restoreVersionId?id(9):room.generation
    const sequence=input.restoreVersionId?0:input.sequence
    room={...room,base_revision:"saved-"+input.requestId,base_updated_at:"2026-10-14T01:00:00Z",generation,canonical_sequence:sequence}
    return{versionId:id(5),requestId:input.requestId,fileId:room.file_id,generation,sequence,
      revision:room.base_revision,updatedAt:room.base_updated_at,restoredFrom:input.restoreVersionId??null}
  }
  const commit=vi.fn(async(input:DocumentCommitInput):Promise<DocumentSaveResult>=>({ok:true,receipt:saved(input)}))
  const restored=vi.fn()
  const writer=createDocumentCanonicalWriter({session,commit,onRestored:restored})
  return{session,writer,commit,saved,restored,async close(){await session.close();server.destroy()}}
}
describe("canonical Save command lifecycle",()=>{
  it("flushes native edits and reconciles the saved prefix without replacing the editor",async()=>{
    const f=await fixture();const replica=f.session.getSnapshot().replica!
    replica.document.getText("content").insert(0,"Edited")
    await f.writer.save()
    expect(f.commit.mock.calls[0][0].sequence).toBe(1)
    expect(f.session.getSnapshot().replica).toBe(replica)
    expect(f.session.getSnapshot().dirty).toBe(false)
    expect(f.writer.getSnapshot().status).toBe("saved");await f.close()
  })
  it("keeps edits arriving during Save as a new dirty draft",async()=>{
    const f=await fixture();const replica=f.session.getSnapshot().replica!
    replica.document.getText("content").insert(0,"First")
    f.commit.mockImplementationOnce(async input=>{
      replica.document.getText("content").insert(0,"Later")
      return{ok:true,receipt:f.saved(input)}
    })
    await f.writer.save()
    expect(f.session.getSnapshot().dirty).toBe(true)
    expect(replica.pendingBytes).toBeGreaterThan(0)
    expect(replica.document.getText("content").toString()).toContain("Later")
    await f.close()
  })
  it("retries a lost response with the exact request while retaining subsequent edits",async()=>{
    const f=await fixture();f.session.getSnapshot().replica!.document.getText("content").insert(0,"First")
    let receipt!:DocumentCommitReceipt
    f.commit.mockImplementationOnce(async input=>{receipt=f.saved(input);throw new Error("Lost response")})
    await f.writer.save();const request=f.writer.pendingRequest
    f.session.getSnapshot().replica!.document.getText("content").insert(0,"Later")
    f.commit.mockResolvedValueOnce({ok:true,receipt})
    await f.writer.retry()
    expect(f.commit.mock.calls[1][0]).toEqual(request)
    expect(f.writer.pendingRequest).toBeNull();expect(f.session.getSnapshot().dirty).toBe(true)
    await f.close()
  })
  it("permits a new request only after a confirmed failure",async()=>{
    const f=await fixture();f.commit.mockResolvedValueOnce({ok:false,message:"Source conflict",retrySameRequest:false})
    await f.writer.save();expect(f.writer.pendingRequest).toBeNull()
    expect(f.writer.getSnapshot()).toMatchObject({status:"error",message:"Source conflict"})
    await f.writer.save();expect(f.commit.mock.calls[0][0].requestId).not.toBe(f.commit.mock.calls[1][0].requestId)
    await f.close()
  })
  it("does not restore over unsaved shared work",async()=>{
    const f=await fixture();f.session.getSnapshot().replica!.document.getText("content").insert(0,"Keep")
    await expect(f.writer.restore(id(8))).rejects.toThrow("Save the shared draft")
    expect(f.commit).not.toHaveBeenCalled();await f.close()
  })
  it("pauses the old generation after Restore and returns its receipt to the window owner",async()=>{
    const f=await fixture();await f.writer.restore(id(8))
    expect(f.writer.getSnapshot()).toMatchObject({status:"saved",operation:"restore"})
    expect(f.restored).toHaveBeenCalledWith(expect.objectContaining({generation:id(9),restoredFrom:id(8)}))
    expect(f.session.getSnapshot().status).toBe("paused");await f.close()
  })
})
