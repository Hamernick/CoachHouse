import { describe, expect, it, vi } from "vitest"
import * as Y from "yjs"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase"
import { createSupabaseDocumentTransport } from "@/features/document-editing/lib/room-realtime"

const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`
const document=new Y.Doc();document.getText("content").insert(0,"Seed")
const checkpoint="\\x"+Buffer.from(Y.encodeStateAsUpdate(document)).toString("hex");document.destroy()
const room={id:id(1),org_id:id(2),file_id:id(3),generation:id(4),base_revision:"r1",base_updated_at:"2026-10-14T00:00:00Z",checkpoint,checkpoint_sequence:0,last_sequence:0,canonical_sequence:0,recovery_bytes:0}
const source={provider:"coach_house" as const,organizationId:room.org_id,fileId:room.file_id}
function fixture({file={updated_at:room.base_updated_at,deleted_at:null as string|null},editable=true,existing=true}={}){
  let event!: (value:{new:{room_id:string;generation:string;sequence:number;batch_id:string;actor_id:string;payload:string;created_at:string}})=>void
  let status!: (value:string)=>void
  let account!: (event:string,session:{user:{id:string}}|null)=>void
  const channel={on:vi.fn((_kind,_filter,callback:typeof event)=>{event=callback;return channel}),subscribe:vi.fn((callback:typeof status)=>{status=callback;return channel})}
  const from=vi.fn((table:string)=>{
    const query={select:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),abortSignal:vi.fn().mockReturnThis(),maybeSingle:async()=>({data:table==="document_collaboration_rooms"?(existing?room:null):file,error:null})}
    return query
  })
  const rpc=vi.fn(()=>({abortSignal:async()=>({data:editable,error:null})}))
  const unsubscribe=vi.fn(),removeChannel=vi.fn(async()=>"ok")
  const client={channel:vi.fn(()=>channel),from,rpc,removeChannel,auth:{onAuthStateChange:(callback:typeof account)=>{account=callback;return{data:{subscription:{unsubscribe}}}}}} as unknown as SupabaseClient<Database>
  const transport=createSupabaseDocumentTransport({client,source,room,actorId:id(6)})
  return{client,transport,channel,from,rpc,unsubscribe,removeChannel,event:(value:Parameters<typeof event>[0])=>event(value),status:(value:string)=>status(value),account:(actor:string|null)=>account("TOKEN_REFRESHED",actor?{user:{id:actor}}:null)}
}
describe("authenticated Supabase document transport",()=>{
  it("subscribes to only one room's committed INSERTs and strips unrelated row fields",()=>{
    const f=fixture(),handlers={update:vi.fn(),connected:vi.fn(),offline:vi.fn(),locked:vi.fn()}
    const stop=f.transport.subscribe(handlers)
    expect(f.channel.on).toHaveBeenCalledWith("postgres_changes",{event:"INSERT",schema:"public",table:"document_collaboration_updates",filter:`room_id=eq.${room.id}`},expect.any(Function))
    const update={room_id:room.id,generation:room.generation,sequence:1,batch_id:id(7),actor_id:id(6),payload:checkpoint,created_at:"ignored"}
    f.event({new:update});expect(handlers.update.mock.calls[0][0]).not.toHaveProperty("created_at")
    expect(handlers.update).toHaveBeenCalledWith(expect.objectContaining({room_id:room.id,sequence:1}))
    f.status("SUBSCRIBED");expect(handlers.connected).toHaveBeenCalledOnce()
    f.status("CHANNEL_ERROR");expect(handlers.offline).toHaveBeenCalledOnce()
    stop();f.event({new:update});f.status("SUBSCRIBED")
    expect(handlers.update).toHaveBeenCalledOnce();expect(handlers.connected).toHaveBeenCalledOnce()
    expect(f.removeChannel).toHaveBeenCalledOnce();expect(f.unsubscribe).toHaveBeenCalledOnce()
    expect(f.from).not.toHaveBeenCalled();expect(f.rpc).not.toHaveBeenCalled()
  })
  it("locks on logout/account switch, while same-account token refresh is harmless",()=>{
    const f=fixture(),handlers={update:vi.fn(),connected:vi.fn(),offline:vi.fn(),locked:vi.fn()}
    const stop=f.transport.subscribe(handlers)
    f.account(id(6));expect(handlers.locked).not.toHaveBeenCalled()
    f.account(id(9));expect(handlers.locked).toHaveBeenCalledOnce();stop()
    f.account(null);expect(handlers.locked).toHaveBeenCalledOnce()
  })
  it("rechecks source metadata and current edit permission without downloading file bytes",async()=>{
    const f=fixture({editable:false});expect(await f.transport.read()).toEqual({room,editable:false})
    expect(f.from.mock.calls.map(v=>v[0])).toEqual(["document_collaboration_rooms","organization_document_files"])
    expect(f.rpc).toHaveBeenCalledWith("can_edit_document_room",{p_room_id:room.id})
    await expect(fixture({file:{updated_at:"2026-10-14T01:00:00Z",deleted_at:null}}).transport.read()).rejects.toMatchObject({code:"conflict"})
    await expect(fixture({file:{updated_at:room.base_updated_at,deleted_at:room.base_updated_at}}).transport.read()).rejects.toMatchObject({code:"access"})
  })
  it("does no further request if current row permissions hide the room",async()=>{
    const f=fixture({existing:false});await expect(f.transport.read()).rejects.toMatchObject({code:"access"})
    expect(f.rpc).not.toHaveBeenCalled();expect(f.from).toHaveBeenCalledOnce()
  })
})
