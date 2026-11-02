import { describe, expect, it, vi } from "vitest"
import { purgeExpiredFiles } from "@/app/api/account/organization-document-files/file-cleanup"
import type { createSupabaseRouteHandlerClient } from "@/lib/supabase/route"
function fixture(admission: { data: unknown; error: unknown }) {
 const rpc=vi.fn().mockResolvedValue(admission), remove=vi.fn().mockResolvedValue({ error: null })
 const query={select:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),is:vi.fn().mockReturnThis(),lt:vi.fn().mockReturnThis(),limit:vi.fn().mockReturnThis(),returns:vi.fn().mockResolvedValue({data:[{id:"file",storage_path:"org/library/old.txt"}],error:null}),delete:vi.fn().mockReturnThis(),in:vi.fn().mockResolvedValue({error:null})}
 const from=vi.fn(()=>query)
 const client={rpc,from,storage:{from:vi.fn(()=>({remove}))}} as unknown as ReturnType<typeof createSupabaseRouteHandlerClient>
 return {client,rpc,from,query,remove}
}
describe("opportunistic document cleanup closure admission",()=>{
 it.each([{data:false,error:null},{data:null,error:null},{data:true,error:{message:"unavailable"}}])("does not query or delete files without active admission",async admission=>{
  const f=fixture(admission);await purgeExpiredFiles(f.client,"org")
  expect(f.rpc).toHaveBeenCalledWith("organization_storage_write_admitted",{p_org:"org"})
  expect(f.from).not.toHaveBeenCalled();expect(f.remove).not.toHaveBeenCalled()
 })
 it("retains scoped active cleanup and constrains the metadata effect to the original organization and expiry",async()=>{
  const f=fixture({data:true,error:null});await purgeExpiredFiles(f.client,"org")
  expect(f.remove).toHaveBeenCalledWith(["org/library/old.txt"])
  expect(f.query.eq).toHaveBeenCalledTimes(2);expect(f.query.eq).toHaveBeenLastCalledWith("org_id","org")
  expect(f.query.lt).toHaveBeenCalledTimes(2);expect(f.query.lt.mock.calls[1]).toEqual(f.query.lt.mock.calls[0])
  expect(f.query.in).toHaveBeenCalledWith("id",["file"])
 })
 it("does not remove metadata after provider deletion fails",async()=>{
  const f=fixture({data:true,error:null});f.remove.mockResolvedValue({error:{message:"unavailable"}} as never)
  await purgeExpiredFiles(f.client,"org");expect(f.query.delete).not.toHaveBeenCalled()
 })
 it("never treats a foreign or traversing path as organization cleanup",async()=>{
  const f=fixture({data:true,error:null});f.query.returns.mockResolvedValue({data:[{id:"foreign",storage_path:"other/library/old.txt"},{id:"traversing",storage_path:"org/library/../old.txt"}],error:null})
  await purgeExpiredFiles(f.client,"org");expect(f.remove).not.toHaveBeenCalled();expect(f.query.delete).not.toHaveBeenCalled()
 })
})
