import { describe,expect,it,vi } from "vitest"
import * as Y from "yjs"
import { createClient,type SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase"
import { createSupabaseDocumentTransport } from "@/features/document-editing/lib/room-realtime"
import { readCanonicalReceipt } from "@/features/document-editing/lib/canonical-read"
import { readGenerationAnchor } from "@/features/document-editing/server/generation-anchor"
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`
const doc=new Y.Doc();doc.getText("content").insert(0,"Original")
const checkpoint="\\x"+Buffer.from(Y.encodeStateAsUpdate(doc)).toString("hex");doc.destroy()
const room={id:id(1),org_id:id(2),file_id:id(3),generation:id(4),base_revision:"saved",base_updated_at:"2026-10-14T01:00:00Z",checkpoint,checkpoint_sequence:0,last_sequence:2,canonical_sequence:1,recovery_bytes:0}
const source={provider:"coach_house" as const,organizationId:room.org_id,fileId:room.file_id}
const row={id:id(5),org_id:room.org_id,file_id:room.file_id,generation:room.generation,revision:room.base_revision,source_updated_at:room.base_updated_at,sequence:1}
function database(result:unknown){
  const network=vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(result),{status:200,headers:{"content-type":"application/json"}}))
  const client=createClient<Database>("https://fixture.invalid","fixture-only",{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:network}})
  return{client,network}
}
describe("small canonical version metadata",()=>{
  it("reads only a current, scoped receipt rather than full files or checkpoints",async()=>{
    const f=database(row)
    expect(await readCanonicalReceipt(f.client,room)).toMatchObject({versionId:id(5),revision:"saved",sequence:1})
    const request=String(f.network.mock.calls[0][0])
    expect(request).toContain("document_file_versions")
    expect(request).toContain("generation=eq."+room.generation)
    expect(decodeURIComponent(request)).not.toContain("checkpoint")
    expect(f.network).toHaveBeenCalledOnce()
  })
  it("refuses a receipt whose time or source identity differs",async()=>{
    await expect(readCanonicalReceipt(database({...row,source_updated_at:"2026-10-13T00:00:00Z"}).client,room)).rejects.toThrow("timestamp")
    await expect(readCanonicalReceipt(database({...row,file_id:id(9)}).client,room)).rejects.toThrow("another source")
  })
  it("keeps the original generation revision as recovery scope after Save",async()=>{
    const f=database({org_id:room.org_id,file_id:room.file_id,generation:room.generation,revision:"generation-original",sequence:0})
    expect(await readGenerationAnchor(f.client,room)).toBe("generation-original")
    expect(decodeURIComponent(String(f.network.mock.calls[0][0]))).toContain("request_id.asc.nullsfirst")
  })
  it("uses an unsaved room's original source but rejects missing history after a canonical Save",async()=>{
    expect(await readGenerationAnchor(database(null).client,{...room,canonical_sequence:0})).toBe(room.base_revision)
    await expect(readGenerationAnchor(database(null).client,room)).rejects.toThrow("no verified recovery anchor")
    await expect(readGenerationAnchor(database({org_id:room.org_id,file_id:room.file_id,generation:id(9),revision:"wrong",sequence:0}).client,room)).rejects.toThrow()
  })
  it("coalesces saved-version hints and stops them when hidden without fetching inside the event callback",async()=>{
    type Hint={new:{file_id?:string;org_id?:string;request_id?:string|null}}
    const listeners=new Map<string,(payload:Hint)=>void>()
    const channel={on:vi.fn((_kind:string,filter:{table:string},callback:(payload:Hint)=>void)=>{listeners.set(filter.table,callback);return channel}),subscribe:vi.fn(()=>channel)}
    const from=vi.fn(),changed=vi.fn(),remove=vi.fn(async()=>"ok")
    const client={channel:()=>channel,from,removeChannel:remove,auth:{onAuthStateChange:()=>({data:{subscription:{unsubscribe:vi.fn()}}})}} as unknown as SupabaseClient<Database>
    const transport=createSupabaseDocumentTransport({client,source,room,actorId:id(6),watchVersions:true})
    const stop=transport.subscribe({changed,update:vi.fn(),connected:vi.fn(),offline:vi.fn(),locked:vi.fn()})
    const event=listeners.get("document_file_versions")!
    event({new:{file_id:room.file_id,org_id:room.org_id,request_id:null}})
    expect(changed).not.toHaveBeenCalled()
    event({new:{file_id:room.file_id,org_id:room.org_id,request_id:id(7)}})
    event({new:{file_id:room.file_id,org_id:room.org_id,request_id:id(8)}})
    await Promise.resolve();expect(changed).toHaveBeenCalledOnce();expect(from).not.toHaveBeenCalled()
    expect(channel.on).toHaveBeenCalledWith("postgres_changes",expect.objectContaining({table:"document_file_versions",event:"INSERT",filter:`file_id=eq.${room.file_id}`}),expect.any(Function))
    event({new:{file_id:room.file_id,org_id:room.org_id,request_id:id(8)}});stop();await Promise.resolve()
    expect(changed).toHaveBeenCalledOnce();expect(remove).toHaveBeenCalledOnce()
  })
})
