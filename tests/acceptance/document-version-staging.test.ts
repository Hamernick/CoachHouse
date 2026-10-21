import { describe, expect, it, vi } from "vitest"
import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase"
import { reserveVersionCommit, abandonVersionStage } from "@/features/document-editing/server/version-staging"
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`
const args={p_file_id:id(1),p_actor_id:id(2),p_request_id:id(3),p_generation:id(4),p_expected_revision:"original",
  p_expected_updated_at:"2026-10-14T00:00:00Z",p_sequence:1,p_previous_hash:"a".repeat(64),p_new_hash:"b".repeat(64),p_new_size:10}
function fixture() {
  const network=vi.fn<typeof fetch>()
  const client=createClient<Database>("https://fixture.invalid","fixture-only",{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:network}})
  return {network,client}
}
const response=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json"}})
describe("reserved Storage commit and deletion ordering",()=>{
  it("registers the immutable request before uploads without sending restore bytes to the reservation RPC",async()=>{
    const f=fixture();f.network.mockResolvedValue(response(true))
    expect(await reserveVersionCommit(f.client,{...args,p_restore_checkpoint_base64:"large-checkpoint"})).toBe(true)
    const request=f.network.mock.calls[0]
    expect(String(request[0])).toContain("reserve_uploaded_document_version")
    expect(JSON.parse(String(request[1]?.body))).toEqual(args)
    expect(request[1]?.signal).toBeInstanceOf(AbortSignal)
  })
  it("never deletes bytes for a committed request",async()=>{
    const f=fixture();f.network.mockResolvedValue(response(false))
    expect(await abandonVersionStage(f.client,args,["reserved.md"])).toBe(false)
    expect(f.network).toHaveBeenCalledOnce()
    expect(String(f.network.mock.calls[0][0])).toContain("abandon_uploaded_document_version")
  })
  it("fences first, deletes second, and releases capacity only after successful Storage cleanup",async()=>{
    const f=fixture();f.network.mockResolvedValueOnce(response(true)).mockResolvedValueOnce(response([])).mockResolvedValueOnce(response(true))
    expect(await abandonVersionStage(f.client,args,["reserved.md"])).toBe(true)
    expect(f.network.mock.calls.map(call=>String(call[0]))).toEqual([
      expect.stringContaining("abandon_uploaded_document_version"),
      expect.stringContaining("/storage/v1/object/org-documents"),
      expect.stringContaining("finish_abandoned_document_version"),
    ])
    expect(f.network.mock.calls[1][1]?.method).toBe("DELETE")
  })
  it("retains reserved capacity when Storage cannot confirm deletion",async()=>{
    const f=fixture();f.network.mockResolvedValueOnce(response(true)).mockResolvedValueOnce(response({message:"Unavailable"},503))
    expect(await abandonVersionStage(f.client,args,["reserved.md"])).toBe(false)
    expect(f.network).toHaveBeenCalledTimes(2)
  })
  it("retains capacity when cleanup completion cannot be acknowledged",async()=>{
    const f=fixture();f.network.mockResolvedValueOnce(response(true)).mockResolvedValueOnce(response([])).mockResolvedValueOnce(response({message:"Unavailable",code:"TIMEOUT"},503))
    expect(await abandonVersionStage(f.client,args,["reserved.md"])).toBe(false)
    expect(f.network).toHaveBeenCalledTimes(3)
  })
})
