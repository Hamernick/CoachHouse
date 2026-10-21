import { afterEach, describe, expect, it, vi } from "vitest"
import { createDocumentFileReader } from "@/features/document-editing/lib/file-reader"
import type { DocumentSnapshot } from "@/features/document-editing/types"
import { getDocumentDownload } from "@/features/document-editing/lib/download-file"
import { createAccountScopedFileReader } from "@/features/document-editing/lib/file-owner"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase"

const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`
const source={provider:"coach_house" as const,organizationId:id(1),fileId:id(2)}
const snapshot:DocumentSnapshot={source,name:"full.md",format:"markdown",revision:"original",updatedAt:"2026-10-14T00:00:00Z",content:"\uFEFF"+"full content ".repeat(15000)+"end",collaboration:{state:"unavailable",canCommit:false}}
afterEach(()=>vi.unstubAllGlobals())
describe("complete file window reader",()=>{
  it("coalesces repeated opens and retains the complete result across hide/show",async()=>{
    const load=vi.fn(async()=>snapshot),reader=createDocumentFileReader({source,load})
    await Promise.all([reader.open(),reader.open(),reader.open()]);expect(load).toHaveBeenCalledOnce()
    expect(reader.getSnapshot()).toEqual({status:"ready",snapshot})
    await reader.open();expect(load).toHaveBeenCalledOnce();expect(reader.getSnapshot().snapshot!.content.endsWith("end")).toBe(true)
    reader.close()
  })
  it("does not expose another file's response or retry continuously",async()=>{
    const load=vi.fn(async():Promise<DocumentSnapshot>=>({...snapshot,source:{...source,fileId:id(9)}})),reader=createDocumentFileReader({source,load})
    await reader.open();expect(reader.getSnapshot()).toEqual({status:"error",snapshot:null})
    await reader.open();expect(load).toHaveBeenCalledOnce()
    load.mockResolvedValue(snapshot);await reader.retry();expect(reader.getSnapshot().status).toBe("ready");reader.close()
  })
  it("ignores a late completion after the window has been removed",async()=>{
    let finish!:(value:DocumentSnapshot)=>void
    const reader=createDocumentFileReader({source,load:()=>new Promise(resolve=>{finish=resolve})})
    const changed=vi.fn();reader.subscribe(changed);const flight=reader.open();await Promise.resolve()
    reader.close();finish(snapshot);await flight
    expect(reader.getSnapshot().snapshot).toBeNull();expect(changed).toHaveBeenCalledOnce()
  })
  it("rejects malformed/oversized snapshots while retaining the original provider file",async()=>{
    const reader=createDocumentFileReader({source,load:async()=>({...snapshot,content:"x".repeat(1048577)})})
    await reader.open();expect(reader.getSnapshot()).toEqual({status:"error",snapshot:null});reader.close()
  })
})
describe("canonical file download",()=>{
  it("signs one explicitly selected file without fetching/serializing its content",async()=>{
    const fetch=vi.fn(async()=>new Response(JSON.stringify({url:"https://storage.example.test/original.md?token=test"})))
    vi.stubGlobal("fetch",fetch)
    expect(await getDocumentDownload(source)).toContain("/original.md?")
    expect(fetch).toHaveBeenCalledWith(`/api/account/organization-document-files?organizationId=${source.organizationId}&id=${source.fileId}&download=true`,expect.objectContaining({cache:"no-store",signal:expect.any(AbortSignal)}))
    expect(fetch).toHaveBeenCalledOnce()
  })
  it("rejects unsafe/unavailable links and does not route Drive through local storage",async()=>{
    const fetch=vi.fn(async()=>new Response(JSON.stringify({url:"javascript:alert(1)"})))
    vi.stubGlobal("fetch",fetch)
    await expect(getDocumentDownload(source)).rejects.toThrow()
    fetch.mockResolvedValue(new Response("unavailable",{status:403}));await expect(getDocumentDownload(source)).rejects.toThrow("Could not download")
    const count=fetch.mock.calls.length
    await expect(getDocumentDownload({provider:"google_drive",organizationId:source.organizationId,attachmentId:source.fileId})).rejects.toThrow("Drive")
    expect(fetch).toHaveBeenCalledTimes(count)
  })
})
function authenticatedReader(load=vi.fn(async()=>({viewerId:id(3),snapshot}))) {
  let changed!:(event:string,session:{user:{id:string}}|null)=>void
  const unsubscribe=vi.fn(),getSession=vi.fn(async()=>({data:{session:{user:{id:id(3)}}},error:null}))
  const client={auth:{getSession,onAuthStateChange:(callback:typeof changed)=>{changed=callback;return{data:{subscription:{unsubscribe}}}}}} as unknown as SupabaseClient<Database>
  const reader=createAccountScopedFileReader({source,client,load})
  return{reader,load,getSession,unsubscribe,change:(actor:string|null)=>changed("SIGNED_IN",actor?{user:{id:actor}}:null)}
}
describe("retained file account isolation",()=>{
  it("binds one explicit read to the server-verified viewer and clears it on account switch",async()=>{
    const f=authenticatedReader();await f.reader.open()
    expect(f.reader.getSnapshot().snapshot).toEqual(snapshot)
    f.change(id(9));expect(f.reader.getSnapshot()).toEqual({status:"locked",snapshot:null})
    await f.reader.retry();expect(f.load).toHaveBeenCalledOnce();expect(f.unsubscribe).toHaveBeenCalledOnce();f.reader.close()
  })
  it("never displays a response verified for another signed-in viewer",async()=>{
    const f=authenticatedReader(vi.fn(async()=>({viewerId:id(9),snapshot})))
    await f.reader.open();expect(f.reader.getSnapshot()).toEqual({status:"locked",snapshot:null});f.reader.close()
  })
  it("ignores a late response after logout during loading",async()=>{
    let finish!:(result:{viewerId:string;snapshot:DocumentSnapshot})=>void
    const f=authenticatedReader(vi.fn(()=>new Promise(resolve=>{finish=resolve})))
    const pending=f.reader.open();for(let i=0;i<8;i++)await Promise.resolve()
    f.change(null);finish({viewerId:id(3),snapshot});await pending
    expect(f.reader.getSnapshot()).toEqual({status:"locked",snapshot:null});f.reader.close()
  })
  it("survives Strict Mode effect replay, coalesces reads, then releases the actual unmount",async()=>{
    const f=authenticatedReader();const first=f.reader.retain();const a=f.reader.open();first()
    const release=f.reader.retain();const b=f.reader.open();await Promise.all([a,b])
    expect(f.reader.getSnapshot().status).toBe("ready");expect(f.load).toHaveBeenCalledOnce();expect(f.getSession).toHaveBeenCalledOnce()
    release();await Promise.resolve();expect(f.unsubscribe).toHaveBeenCalledOnce();expect(f.reader.getSnapshot().snapshot).toBeNull()
  })
})
