import { describe, expect, it, vi } from "vitest"
import * as Y from "yjs"
import { createDocumentRoomSync, type DocumentRoomTransport } from "@/features/document-editing/lib/room-sync"
import { DocumentRoomError } from "@/features/document-editing/lib/room-client"
import type { DocumentRoom, DocumentRoomUpdate } from "@/features/document-editing/lib/room-contracts"

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12,"0")}`
const hex = (bytes: Uint8Array) => "\\x" + Buffer.from(bytes).toString("hex")
function fixture() {
  const server = new Y.Doc()
  server.getText("content").insert(0,"Seed")
  let room: DocumentRoom = { id:id(1),org_id:id(2),file_id:id(3),generation:id(4),base_revision:"source",base_updated_at:"2026-10-14T00:00:00Z",checkpoint:hex(Y.encodeStateAsUpdate(server)),checkpoint_sequence:0,last_sequence:0,canonical_sequence:0,recovery_bytes:0 }
  const ledger: DocumentRoomUpdate[] = []
  const order: string[] = []
  let callbacks: Parameters<DocumentRoomTransport["subscribe"]>[0]
  const unsubscribe = vi.fn()
  const read = vi.fn(async () => { order.push("read"); return {room:{...room},editable:true} })
  const tail = vi.fn(async (snapshot: DocumentRoom, after: number) => ledger.filter(v => v.sequence > after && v.sequence <= snapshot.last_sequence))
  const transport: DocumentRoomTransport = { read,tail,subscribe: value => { order.push("subscribe");callbacks=value;return unsubscribe } }
  const sync = createDocumentRoomSync({expected:room,transport,onState:vi.fn()})
  function edit(text = "x") {
    let payload: Uint8Array = new Uint8Array()
    const capture = (bytes: Uint8Array) => { payload=bytes }
    server.on("update",capture);server.getText("content").insert(0,text);server.off("update",capture)
    room={...room,last_sequence:room.last_sequence+1}
    const update: DocumentRoomUpdate = {room_id:room.id,generation:room.generation,sequence:room.last_sequence,batch_id:crypto.randomUUID(),actor_id:id(6),payload:hex(payload)}
    ledger.push(update);return update
  }
  function compact() { room={...room,checkpoint:hex(Y.encodeStateAsUpdate(server)),checkpoint_sequence:room.last_sequence};ledger.length=0 }
  function commit(batch:{id:string;update:Uint8Array}) {
    Y.applyUpdate(server,batch.update)
    room={...room,last_sequence:room.last_sequence+1}
    const update:DocumentRoomUpdate={room_id:room.id,generation:room.generation,sequence:room.last_sequence,batch_id:batch.id,actor_id:id(6),payload:hex(batch.update)}
    ledger.push(update);return update
  }
  function cleanup() {
    sync.dispose()
    const batch=sync.replica?.prepare();if(batch)sync.replica?.acknowledge(batch.id)
    sync.replica?.dispose();server.destroy()
  }
  return {sync,read,tail,order,edit,commit,compact,cleanup,unsubscribe,get handlers(){return callbacks},set room(value:DocumentRoom){room=value},get room(){return room}}
}
async function settle() { for(let i=0;i<12;i++) await Promise.resolve() }

describe("durable live document reconciliation", () => {
  it("converges simultaneous clients without remote echo or a second plain-text seed", async () => {
    const f=fixture();let second!:Parameters<DocumentRoomTransport["subscribe"]>[0]
    const other=createDocumentRoomSync({expected:f.room,transport:{read:f.read,tail:f.tail,subscribe:handlers=>{second=handlers;return()=>{}}},onState:vi.fn()})
    f.sync.resume();other.resume();f.handlers.connected();second.connected();await settle()
    f.sync.replica!.document.getText("content").insert(0,"Alpha")
    other.replica!.document.getText("content").insert(0,"Beta")
    const a=f.sync.replica!.prepare()!,b=other.replica!.prepare()!
    const first=f.commit(a),last=f.commit(b)
    // One client receives a gap; the other receives normal commit order.
    f.handlers.update(last);f.handlers.update(first);second.update(first);second.update(last);await settle()
    expect(f.sync.replica!.document.getText("content").toString()).toBe(other.replica!.document.getText("content").toString())
    expect(f.sync.replica!.prepare()).toEqual(a);expect(other.replica!.prepare()).toEqual(b)
    f.sync.replica!.acknowledge(a.id);other.replica!.acknowledge(b.id)
    expect(f.sync.replica!.prepare()).toBeNull();expect(other.replica!.prepare()).toBeNull()
    expect(f.sync.state.sequence).toBe(2);expect(other.state.sequence).toBe(2)
    other.dispose();other.replica!.dispose();f.cleanup()
  })
  it("subscribes before the first read and buffers inserts during startup", async () => {
    const f=fixture();const update=f.edit()
    f.sync.resume();expect(f.read).not.toHaveBeenCalled()
    f.handlers.update(update);f.handlers.connected();await settle()
    expect(f.order.slice(0,2)).toEqual(["subscribe","read"])
    expect(f.sync.state).toMatchObject({status:"ready",sequence:1,editable:true})
    expect(f.sync.replica?.document.getText("content").toString()).toBe("xSeed")
    expect(f.sync.replica?.pendingBytes).toBe(0)
    f.cleanup()
  })
  it("applies contiguous events without reads and ignores repeated receipts", async () => {
    const f=fixture();f.sync.resume();f.handlers.connected();await settle()
    const update=f.edit();f.handlers.update(update);f.handlers.update(update)
    expect(f.sync.state.sequence).toBe(1);expect(f.read).toHaveBeenCalledOnce()
    expect(f.sync.replica?.document.getText("content").toString()).toBe("xSeed")
    expect(f.sync.replica?.prepare()).toBeNull();f.cleanup()
  })
  it("recovers missing/out-of-order events from one durable prefix", async () => {
    const f=fixture();f.sync.resume();f.handlers.connected();await settle()
    const first=f.edit("a"),second=f.edit("b")
    f.handlers.update(second);f.handlers.update(first);await settle()
    expect(f.sync.state).toMatchObject({status:"ready",sequence:2})
    expect(f.sync.replica?.document.getText("content").toString()).toBe("baSeed")
    expect(f.read).toHaveBeenCalledTimes(2);f.cleanup()
  })
  it("reconnects after compaction into the same replica with pending edits intact", async () => {
    const f=fixture();f.sync.resume();f.handlers.connected();await settle()
    const replica=f.sync.replica!;replica.document.getText("content").insert(0,"local")
    const batch=replica.prepare()!;f.handlers.offline();f.edit("remote");f.compact()
    f.handlers.connected();await settle()
    expect(f.sync.replica).toBe(replica);expect(replica.prepare()).toEqual(batch)
    const text=replica.document.getText("content").toString()
    expect(text).toContain("local");expect(text).toContain("remote");expect(text).toContain("Seed")
    expect(f.sync.state).toMatchObject({status:"ready",sequence:1});f.cleanup()
  })
  it("re-reads once when compaction races with a tail request", async () => {
    const f=fixture();f.edit()
    f.tail.mockImplementationOnce(async () => { f.compact();throw new DocumentRoomError("conflict","compacted") })
    f.sync.resume();f.handlers.connected();await settle()
    expect(f.read).toHaveBeenCalledTimes(2);expect(f.sync.state.status).toBe("ready")
    expect(f.sync.replica?.document.getText("content").toString()).toBe("xSeed");f.cleanup()
  })
  it("ignores late reads after pause and reuses the replica when resumed", async () => {
    const f=fixture();let resolve!: (value:{room:DocumentRoom;editable:boolean})=>void
    f.read.mockImplementationOnce(() => new Promise(r => {resolve=r}))
    f.sync.resume();f.handlers.connected();f.sync.pause()
    resolve({room:f.room,editable:true});await settle()
    expect(f.sync.replica).toBeNull();expect(f.sync.state.status).toBe("paused")
    f.sync.resume();f.handlers.connected();await settle()
    expect(f.sync.state.status).toBe("ready");f.cleanup()
  })
  it("locks pending edits when the account changes, without another read", async () => {
    const f=fixture();f.sync.resume();f.handlers.connected();await settle()
    f.sync.replica!.document.getText("content").insert(0,"private")
    const batch=f.sync.replica!.prepare();f.handlers.locked()
    f.sync.retry();f.sync.resume();f.handlers.update(f.edit())
    expect(f.sync.state.status).toBe("blocked");expect(f.sync.replica!.prepare()).toEqual(batch)
    expect(f.unsubscribe).toHaveBeenCalledOnce();expect(f.read).toHaveBeenCalledOnce();f.cleanup()
  })
  it("stops on malformed/wrong-generation events and retains the local outbox", async () => {
    const f=fixture();f.sync.resume();f.handlers.connected();await settle()
    f.sync.replica!.document.getText("content").insert(0,"pending")
    f.handlers.update({...f.edit(),generation:id(9)})
    expect(f.sync.state.status).toBe("blocked");expect(f.sync.replica!.pendingBytes).toBeGreaterThan(0)
    expect(f.unsubscribe).toHaveBeenCalledOnce();f.cleanup()
  })
  it("bounds repeated conflict reads instead of polling", async () => {
    const f=fixture();f.room={...f.room,base_revision:"changed"}
    f.sync.resume();f.handlers.connected();await settle()
    expect(f.sync.state.status).toBe("blocked");expect(f.read).toHaveBeenCalledTimes(2)
    await settle();expect(f.read).toHaveBeenCalledTimes(2);f.cleanup()
  })
  it("revalidates edit access on reconnect while retaining readable shared content", async () => {
    const f=fixture();f.sync.resume();f.handlers.connected();await settle()
    f.handlers.offline();f.read.mockResolvedValueOnce({room:f.room,editable:false})
    f.handlers.connected();await settle()
    expect(f.sync.state).toMatchObject({status:"ready",editable:false})
    expect(f.sync.replica?.document.getText("content").toString()).toBe("Seed");f.cleanup()
  })
})
