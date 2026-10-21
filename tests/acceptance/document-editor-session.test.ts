import { afterEach, describe, expect, it, vi } from "vitest"
import * as Y from "yjs"
import { createDocumentEditorSession } from "@/features/document-editing/lib/editor-session"
import { createDocumentReplica } from "@/features/document-editing/lib/document-replica"
import type { DocumentRoomTransport } from "@/features/document-editing/lib/room-sync"
import type { DocumentRoom,DocumentRoomUpdate } from "@/features/document-editing/lib/room-contracts"
import type { DocumentRecoveryState } from "@/features/document-editing/lib/document-recovery"

const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`
const hex=(bytes:Uint8Array)=>"\\x"+Buffer.from(bytes).toString("hex")
function fixture({allowEditing=true,editable=true,storeAvailable=true,recovery}: {allowEditing?:boolean;editable?:boolean;storeAvailable?:boolean;recovery?:DocumentRecoveryState}={}) {
  const server=new Y.Doc();server.getText("content").insert(0,"Original")
  let room:DocumentRoom={id:id(1),org_id:id(2),file_id:id(3),generation:id(4),base_revision:"original",base_updated_at:"2026-10-14T00:00:00Z",checkpoint:hex(Y.encodeStateAsUpdate(server)),checkpoint_sequence:0,last_sequence:0,canonical_sequence:0,recovery_bytes:0}
  let handlers!:Parameters<DocumentRoomTransport["subscribe"]>[0]
  const save=vi.fn(async(_value:DocumentRecoveryState)=>{}),close=vi.fn(),unsubscribe=vi.fn()
  const read=vi.fn(async()=>({room,editable})),tail=vi.fn(async()=>[] as DocumentRoomUpdate[])
  const transport:DocumentRoomTransport={read,tail,subscribe:value=>{handlers=value;return unsubscribe}}
  const commit=vi.fn(async(batch:{id:string;update:Uint8Array})=>{
    Y.applyUpdate(server,batch.update);room={...room,last_sequence:room.last_sequence+1}
    const update:DocumentRoomUpdate={room_id:room.id,generation:room.generation,sequence:room.last_sequence,batch_id:batch.id,actor_id:id(6),payload:hex(batch.update)}
    handlers.update(update)
    return{batchId:batch.id,generation:room.generation,sequence:room.last_sequence}
  })
  const session=createDocumentEditorSession({expected:room,transport,store:storeAvailable?{save,close}:null,commit,allowEditing,recovery})
  return{session,server,save,close,commit,read,unsubscribe,get handlers(){return handlers},async ready(){session.start();handlers.connected();await settle()},async cleanup(){await session.close();server.destroy()}}
}
async function settle(){for(let i=0;i<40;i++)await Promise.resolve()}
afterEach(()=>{vi.useRealTimers()})
describe("shared editor lifecycle ownership",()=>{
  it("waits for authenticated sync and local recovery before enabling input",async()=>{
    const f=fixture();let finish!:()=>void
    f.save.mockImplementationOnce(()=>new Promise<void>(resolve=>{finish=resolve}))
    f.session.start();f.handlers.connected();await settle()
    expect(f.session.getSnapshot().editable).toBe(false);expect(f.commit).not.toHaveBeenCalled()
    finish();await settle();expect(f.session.getSnapshot().editable).toBe(true);await f.cleanup()
  })
  it("retains the same replica when hidden, resumed or viewport presentation changes",async()=>{
    const f=fixture();await f.ready();const replica=f.session.getSnapshot().replica
    f.session.setActive(false);expect(f.session.getSnapshot()).toMatchObject({status:"paused",editable:false,replica})
    f.session.setActive(true);f.handlers.connected();await settle()
    expect(f.session.getSnapshot()).toMatchObject({status:"ready",editable:true,replica});await f.cleanup()
  })
  it("never calls source Saved when a working draft is acknowledged",async()=>{
    const f=fixture();await f.ready();const replica=f.session.getSnapshot().replica!
    replica.document.getText("content").insert(0,"edited")
    await f.session.flush();expect(f.commit).toHaveBeenCalledOnce()
    expect(replica.pendingBytes).toBe(0);expect(f.session.getSnapshot().dirty).toBe(true)
    await f.cleanup()
  })
  it("batches typing without publishing a React snapshot for every transaction",async()=>{
    vi.useFakeTimers();const f=fixture();await f.ready();const changed=vi.fn();f.session.subscribe(changed)
    for(let i=0;i<60;i++)f.session.getSnapshot().replica!.document.getText("content").insert(0,"x")
    expect(changed.mock.calls.length).toBeLessThan(8)
    await vi.advanceTimersByTimeAsync(750);expect(f.commit).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(10000);expect(f.commit).toHaveBeenCalledOnce();await f.cleanup()
  })
  it("closes with an exact locally durable outbox without pretending a server acknowledgement",async()=>{
    const f=fixture();await f.ready();const replica=f.session.getSnapshot().replica!
    replica.document.getText("content").insert(0,"pending")
    f.session.setActive(false);await f.session.close()
    expect(f.commit).not.toHaveBeenCalled();expect(f.close).toHaveBeenCalledOnce()
    const saved=f.save.mock.calls.at(-1)![0]
    expect(saved.tail).not.toBeNull();expect(f.session.getSnapshot().status).toBe("closed")
    const restored=createDocumentReplica(Y.encodeStateAsUpdate(f.server),saved)
    expect(restored.document.getText("content").toString()).toContain("pending")
    restored.releaseAfterRecovery(restored.captureRecovery());f.server.destroy()
  })
  it("keeps the document in memory when quota failure prevents safe close",async()=>{
    const f=fixture();await f.ready();const replica=f.session.getSnapshot().replica!
    replica.document.getText("content").insert(0,"keep me")
    f.save.mockRejectedValueOnce(new Error("quota"))
    await expect(f.session.close()).rejects.toThrow("quota")
    expect(f.session.getSnapshot()).toMatchObject({status:"blocked",replica})
    expect(replica.pendingBytes).toBeGreaterThan(0);expect(f.close).not.toHaveBeenCalled()
    await f.session.retry();f.handlers.connected();await settle();await f.cleanup()
  })
  it("locks editing on account changes and cannot retry with the replacement account",async()=>{
    const f=fixture();await f.ready();const replica=f.session.getSnapshot().replica!
    replica.document.getText("content").insert(0,"private draft")
    f.handlers.locked();expect(f.session.getSnapshot().editable).toBe(false)
    expect(f.session.getSnapshot().status).toBe("blocked")
    const reads=f.read.mock.calls.length;await f.session.retry();expect(f.read.mock.calls.length).toBe(reads)
    expect(f.session.getSnapshot()).toMatchObject({status:"blocked",locked:true,editable:false})
    // The injected test store remains accessible to its original owner. Actual
    // account-scoped storage has its own logout lock and refuses these writes.
    await f.cleanup()
  })
  it.each([{allowEditing:false},{editable:false},{storeAvailable:false}])("gates writes for %j",async options=>{
    const f=fixture(options);await f.ready();expect(f.session.getSnapshot().editable).toBe(false)
    await f.session.flush();expect(f.commit).not.toHaveBeenCalled();await f.cleanup()
  })
  it("refuses to release a draft which changed after its recovery snapshot",()=>{
    const seed=new Y.Doc();const initial=Y.encodeStateAsUpdate(seed);seed.destroy()
    const replica=createDocumentReplica(initial);replica.document.getText("content").insert(0,"one")
    const recovered=replica.captureRecovery();replica.document.getText("content").insert(0,"two")
    expect(()=>replica.releaseAfterRecovery(recovered)).toThrow("changed after recovery")
    expect(replica.pendingBytes).toBeGreaterThan(0);replica.releaseAfterRecovery(replica.captureRecovery())
  })
})
