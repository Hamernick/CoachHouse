import { describe,expect,it,vi } from "vitest"
import * as Y from "yjs"
import { validateCanonicalAdvance } from "@/features/document-editing/lib/canonical-advance"
import { createDocumentRoomSync, type DocumentRoomTransport } from "@/features/document-editing/lib/room-sync"
import type { DocumentRoom } from "@/features/document-editing/lib/room-contracts"
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`
const server=new Y.Doc();server.getText("content").insert(0,"Original")
const checkpoint="\\x"+Buffer.from(Y.encodeStateAsUpdate(server)).toString("hex");server.destroy()
const original:DocumentRoom={id:id(1),org_id:id(2),file_id:id(3),generation:id(4),base_revision:"source",base_updated_at:"2026-10-14T00:00:00Z",checkpoint,checkpoint_sequence:0,last_sequence:0,canonical_sequence:0,recovery_bytes:0}
function canonical(room:DocumentRoom){return{versionId:id(5),orgId:room.org_id,fileId:room.file_id,generation:room.generation,revision:room.base_revision,updatedAt:room.base_updated_at,sequence:room.canonical_sequence}}
async function settle(){for(let i=0;i<30;i++)await Promise.resolve()}
describe("verified canonical advancement",()=>{
  it("requires a matching authoritative receipt for changed source or canonical sequence",()=>{
    const next={...original,base_revision:"saved",base_updated_at:"2026-10-14T01:00:00Z",last_sequence:2,canonical_sequence:1}
    expect(()=>validateCanonicalAdvance(original,next)).toThrow("without a verified version")
    expect(()=>validateCanonicalAdvance(original,next,canonical(next))).not.toThrow()
    for(const patch of [{orgId:id(8)},{fileId:id(8)},{generation:id(8)},{revision:"wrong"},{sequence:2},{updatedAt:original.base_updated_at}])
      expect(()=>validateCanonicalAdvance(original,next,{...canonical(next),...patch})).toThrow()
  })
  it("rejects restore generations and backwards sequences even with a receipt",()=>{
    const saved={...original,last_sequence:3,canonical_sequence:2}
    const stale={...saved,last_sequence:2,canonical_sequence:1}
    expect(()=>validateCanonicalAdvance(saved,stale,canonical(stale))).toThrow("backwards")
    const restored={...original,generation:id(9)}
    expect(()=>validateCanonicalAdvance(original,restored,canonical(restored))).toThrow("generation changed")
  })
  it("allows same-prefix canonical re-save and multiple missed saves without reseeding",async()=>{
    let current={...original}
    let handlers!:Parameters<DocumentRoomTransport["subscribe"]>[0]
    const state=vi.fn()
    const transport:DocumentRoomTransport={subscribe:value=>{handlers=value;return()=>{}},read:async()=>({room:current,editable:true,canonical:canonical(current)}),tail:async()=>[]}
    const sync=createDocumentRoomSync({expected:original,transport,onState:state})
    sync.resume();handlers.connected();await settle()
    const replica=sync.replica!
    replica.document.getText("content").insert(0,"Local draft ")
    const pending=replica.prepare()!
    current={...current,base_revision:"saved-twice",base_updated_at:"2026-10-14T02:00:00Z"}
    handlers.changed?.();await settle()
    expect(sync.state.status).toBe("ready");expect(sync.replica).toBe(replica)
    expect(replica.document.getText("content").toString()).toContain("Local draft")
    expect(replica.prepare()).toEqual(pending)
    expect(sync.room.base_revision).toBe("saved-twice")
    expect(state.mock.calls.at(-1)?.[0].status).toBe("ready")
    sync.pause();sync.resume();handlers.connected();await settle()
    expect(sync.replica).toBe(replica);expect(replica.prepare()).toEqual(pending)
    replica.releaseAfterRecovery(replica.captureRecovery());sync.dispose()
  })
  it("retains pending native operations when an external source or restored generation is rejected",async()=>{
    let current={...original}
    let handlers!:Parameters<DocumentRoomTransport["subscribe"]>[0]
    const read=vi.fn(async()=>({room:current,editable:true}))
    const sync=createDocumentRoomSync({expected:original,transport:{read,tail:async()=>[],subscribe:value=>{handlers=value;return()=>{}}},onState:vi.fn()})
    sync.resume();handlers.connected();await settle()
    const replica=sync.replica!;replica.document.getText("content").insert(0,"Recover me")
    const batch=replica.prepare()
    current={...current,base_revision:"external"};handlers.changed?.();await settle()
    expect(sync.state.status).toBe("blocked");expect(replica.prepare()).toEqual(batch)
    expect(read).toHaveBeenCalledTimes(3) // open plus one bounded conflict retry
    replica.releaseAfterRecovery(replica.captureRecovery());sync.dispose()
  })
  it("supports explicit refresh and does not poll idle sessions",async()=>{
    let handlers!:Parameters<DocumentRoomTransport["subscribe"]>[0]
    const read=vi.fn(async()=>({room:original,editable:true}))
    const sync=createDocumentRoomSync({expected:original,transport:{read,tail:async()=>[],subscribe:value=>{handlers=value;return()=>{}}},onState:vi.fn()})
    await expect(sync.refresh()).rejects.toThrow("Reconnect")
    sync.resume();handlers.connected();await settle()
    await sync.refresh();await settle();expect(read).toHaveBeenCalledTimes(2)
    sync.dispose();sync.replica!.dispose()
  })
})
