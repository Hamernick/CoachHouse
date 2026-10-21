import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { IDBFactory, IDBKeyRange } from "fake-indexeddb"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase"
import * as Y from "yjs"
import { createDocumentReplica } from "@/features/document-editing/lib/document-replica"
import { openDocumentRecoveryStore } from "@/features/document-editing/lib/recovery-storage"
import { createDocumentRecoveryJournal } from "@/features/document-editing/lib/recovery-journal"
import { encodeDocumentRecovery, decodeDocumentRecovery, type DocumentRecoveryScope } from "@/features/document-editing/lib/document-recovery"

const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`
const scope:DocumentRecoveryScope={actorId:id(1),organizationId:id(2),fileId:id(3),generation:id(4),sessionId:id(5),baseRevision:"original"}
function authFixture(actorId=scope.actorId) {
  let changed: (event:string,session:{user:{id:string}}|null)=>void
  const unsubscribe=vi.fn()
  const getUser=vi.fn(async()=>({data:{user:{id:actorId}},error:null}))
  const client={auth:{getUser,onAuthStateChange:(callback:typeof changed)=>{changed=callback;return{data:{subscription:{unsubscribe}}}}}} as unknown as SupabaseClient<Database>
  return {client,getUser,unsubscribe,logout:()=>changed("SIGNED_OUT",null)}
}
function replicaFixture() {
  const seed=new Y.Doc();seed.getText("content").insert(0,"Seed")
  const initial=Y.encodeStateAsUpdate(seed);seed.destroy()
  const replica=createDocumentReplica(initial)
  const edit=(text="x")=>replica.document.getText("content").insert(0,text)
  const dispose=()=>{let batch=replica.prepare();while(batch){replica.acknowledge(batch.id);batch=replica.prepare()}replica.dispose()}
  return {initial,replica,edit,dispose}
}
beforeEach(()=>{vi.stubGlobal("indexedDB",new IDBFactory());vi.stubGlobal("IDBKeyRange",IDBKeyRange)})
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals()})
async function settle(){for(let i=0;i<12;i++)await Promise.resolve()}

describe("native edit recovery",()=>{
  it("restores prepared retry identity and later edits without duplicating already shared text",()=>{
    const f=replicaFixture();f.edit("first");const batch=f.replica.prepare()!;f.edit("later")
    const recovered=decodeDocumentRecovery(encodeDocumentRecovery(f.replica.captureRecovery()))
    const restored=createDocumentReplica(Y.encodeStateAsUpdate(f.replica.document),recovered)
    expect(restored.document.getText("content").toString()).toBe(f.replica.document.getText("content").toString())
    expect(restored.prepare()).toEqual(batch);restored.acknowledge(batch.id)
    expect(restored.prepare()!.id).not.toBe(batch.id)
    restored.acknowledge(restored.prepare()!.id);restored.dispose();f.dispose()
  })
  it("rejects damaged/oversized recovery updates instead of silently dropping them",()=>{
    expect(()=>decodeDocumentRecovery(new TextEncoder().encode('{"version":1,"batch":null,"tail":"/w=="}'))).toThrow("invalid")
    expect(()=>encodeDocumentRecovery({batch:null,tail:new Uint8Array(2097153)})).toThrow("budget")
  })
})
describe("account-scoped encrypted IndexedDB outbox",()=>{
  it("survives reopen with the exact pending bytes and immutable retry ID",async()=>{
    const auth=authFixture(),f=replicaFixture();const store=await openDocumentRecoveryStore({client:auth.client,scope})
    f.edit("private text");const batch=f.replica.prepare()!;f.edit("more")
    await store.save(f.replica.captureRecovery());store.close()
    const reopened=await openDocumentRecoveryStore({client:auth.client,scope:{...scope,sessionId:id(7)}})
    const records=await reopened.list();expect(records).toHaveLength(1)
    expect(records[0].sessionId).toBe(scope.sessionId);expect(records[0].recovery.batch).toEqual(batch)
    const restored=createDocumentReplica(f.initial,records[0].recovery)
    expect(restored.document.getText("content").toString()).toBe(f.replica.document.getText("content").toString())
    await reopened.remove(scope.sessionId);expect(await reopened.list()).toEqual([])
    reopened.close();restored.acknowledge(batch.id);const tail=restored.prepare();if(tail)restored.acknowledge(tail.id);restored.dispose();f.dispose()
  })
  it("isolates actor, organization, file and generation; locks immediately on logout",async()=>{
    const auth=authFixture(),f=replicaFixture();const store=await openDocumentRecoveryStore({client:auth.client,scope})
    f.edit();await store.save(f.replica.captureRecovery())
    for(const changed of [{organizationId:id(8)},{fileId:id(8)},{generation:id(8)}]){
      const other=await openDocumentRecoveryStore({client:authFixture().client,scope:{...scope,...changed,sessionId:crypto.randomUUID()}})
      expect(await other.list()).toEqual([]);await expect(other.remove(scope.sessionId)).rejects.toThrow();other.close()
    }
    const otherActor=await openDocumentRecoveryStore({client:authFixture(id(8)).client,scope:{...scope,actorId:id(8),sessionId:id(9)}})
    expect(await otherActor.list()).toEqual([]);otherActor.close()
    await expect(openDocumentRecoveryStore({client:authFixture(id(8)).client,scope})).rejects.toThrow("original account")
    auth.logout();await expect(store.list()).rejects.toThrow("locked");await expect(store.save(f.replica.captureRecovery())).rejects.toThrow("locked")
    store.close();f.dispose()
  })
  it("chooses one persistent encryption key for concurrent tabs",async()=>{
    const f=replicaFixture();f.edit()
    const [a,b]=await Promise.all([openDocumentRecoveryStore({client:authFixture().client,scope}),openDocumentRecoveryStore({client:authFixture().client,scope:{...scope,sessionId:id(7)}})])
    await Promise.all([a.save(f.replica.captureRecovery()),b.save(f.replica.captureRecovery())])
    expect(await a.list()).toHaveLength(2);expect(await b.list()).toHaveLength(2)
    a.close();b.close();f.dispose()
  })
  it("retains pending records if the canonical source revision changes",async()=>{
    const f=replicaFixture();f.edit();const store=await openDocumentRecoveryStore({client:authFixture().client,scope})
    await store.save(f.replica.captureRecovery());store.close()
    const changed=await openDocumentRecoveryStore({client:authFixture().client,scope:{...scope,baseRevision:"changed"}})
    await expect(changed.list()).rejects.toThrow("source revision")
    await expect(changed.save(f.replica.captureRecovery())).rejects.toThrow();changed.close()
    const original=await openDocumentRecoveryStore({client:authFixture().client,scope})
    expect(await original.list()).toHaveLength(1);original.close();f.dispose()
  })
})
describe("local journal durability barriers",()=>{
  it("coalesces native edits and remains idle without polling",async()=>{
    vi.useFakeTimers();const f=replicaFixture(),save=vi.fn(async()=>{}),close=vi.fn(),onState=vi.fn()
    const journal=createDocumentRecoveryJournal({replica:f.replica,store:{save,close},onState})
    for(let i=0;i<60;i++)f.edit()
    await vi.advanceTimersByTimeAsync(100);expect(save).toHaveBeenCalledOnce();expect(journal.ready).toBe(true)
    await vi.advanceTimersByTimeAsync(10000);expect(save).toHaveBeenCalledOnce()
    journal.lock();f.dispose()
  })
  it("persists a newly prepared retry ID even when an earlier write is in flight",async()=>{
    vi.useFakeTimers();const f=replicaFixture();let finish!:()=>void
    const save=vi.fn().mockImplementationOnce(()=>new Promise<void>(r=>{finish=r})).mockResolvedValue(undefined)
    const journal=createDocumentRecoveryJournal({replica:f.replica,store:{save,close:vi.fn()},onState:vi.fn()})
    f.edit();const first=journal.flush();await settle()
    const batch=f.replica.prepare()!;const barrier=journal.flush();finish();await Promise.all([first,barrier])
    expect(save).toHaveBeenCalledTimes(2);expect(save.mock.calls[1][0].batch).toEqual(batch)
    journal.lock();f.dispose()
  })
  it("retains edits made during a commit and does not starve the captured durability barrier",async()=>{
    vi.useFakeTimers();const f=replicaFixture();let finish!:()=>void
    const save=vi.fn().mockImplementationOnce(()=>new Promise<void>(r=>{finish=r})).mockResolvedValue(undefined)
    const journal=createDocumentRecoveryJournal({replica:f.replica,store:{save,close:vi.fn()},onState:vi.fn()})
    f.edit("first");const first=journal.flush();await settle();f.edit("later");finish();await first
    expect(journal.ready).toBe(false);await journal.flush();expect(journal.ready).toBe(true)
    expect(save).toHaveBeenCalledTimes(2);journal.lock();f.dispose()
  })
  it("blocks close on quota failure and retains edits for explicit retry",async()=>{
    vi.useFakeTimers();const f=replicaFixture();const close=vi.fn(),save=vi.fn().mockRejectedValueOnce(new Error("quota")).mockResolvedValue(undefined)
    const journal=createDocumentRecoveryJournal({replica:f.replica,store:{save,close},onState:vi.fn()})
    f.edit();await expect(journal.close()).rejects.toThrow("quota")
    expect(close).not.toHaveBeenCalled();expect(f.replica.pendingBytes).toBeGreaterThan(0)
    await journal.retry();await journal.close();expect(close).toHaveBeenCalledOnce();f.dispose()
  })
  it("refuses close if new edits arrive during its recovery write",async()=>{
    vi.useFakeTimers();const f=replicaFixture();let finish!:()=>void
    const close=vi.fn(),save=vi.fn().mockImplementationOnce(()=>new Promise<void>(r=>{finish=r})).mockResolvedValue(undefined)
    const journal=createDocumentRecoveryJournal({replica:f.replica,store:{save,close},onState:vi.fn()})
    f.edit();const closing=journal.close();await settle();f.edit("during close");finish()
    await expect(closing).rejects.toThrow("changed while closing");expect(close).not.toHaveBeenCalled()
    await journal.close();expect(close).toHaveBeenCalledOnce();f.dispose()
  })
})
