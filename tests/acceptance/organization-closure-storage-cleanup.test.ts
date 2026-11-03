import { beforeEach, describe, expect, it, vi } from "vitest"
import { purgeExpiredFiles } from "@/app/api/account/organization-document-files/file-cleanup"
import type { createSupabaseRouteHandlerClient } from "@/lib/supabase/route"
const mocks=vi.hoisted(()=>({purge:vi.fn(),stages:vi.fn()}))
vi.mock("@/features/document-editing/server",()=>({permanentlyPurgeDocument:mocks.purge,reconcileAbandonedDocumentStages:mocks.stages}))
const actor={actorId:"verified-actor",support:false}
beforeEach(()=>{vi.resetAllMocks();mocks.purge.mockResolvedValue({ok:true});mocks.stages.mockResolvedValue(undefined)})
function fixture(admission: { data: unknown; error: unknown }) {
 const rpc=vi.fn().mockResolvedValue(admission), remove=vi.fn().mockResolvedValue({ error: null })
 const query={select:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),is:vi.fn().mockReturnThis(),lt:vi.fn().mockReturnThis(),limit:vi.fn().mockReturnThis(),returns:vi.fn().mockResolvedValue({data:[{id:"file",storage_path:"org/library/old.txt"}],error:null}),delete:vi.fn().mockReturnThis(),in:vi.fn().mockResolvedValue({error:null})}
 const from=vi.fn(()=>query)
 const client={rpc,from,storage:{from:vi.fn(()=>({remove}))}} as unknown as ReturnType<typeof createSupabaseRouteHandlerClient>
 return {client,rpc,from,query,remove}
}
describe("opportunistic document cleanup closure admission",()=>{
 it.each([{data:false,error:null},{data:null,error:null},{data:true,error:{message:"unavailable"}}])("does not reconcile stages or purge without active admission",async admission=>{
  const f=fixture(admission);await purgeExpiredFiles(f.client,"org",actor)
  expect(f.rpc).toHaveBeenCalledWith("organization_storage_write_admitted",{p_org:"org"})
  expect(f.from).not.toHaveBeenCalled();expect(f.remove).not.toHaveBeenCalled();expect(mocks.stages).not.toHaveBeenCalled();expect(mocks.purge).not.toHaveBeenCalled()
 })
 it("passes verified actor and expiry intent to the version-aware owner within bounded30day cleanup",async()=>{
  const f=fixture({data:true,error:null}),before=Date.now();await purgeExpiredFiles(f.client,"org",actor)
  expect(mocks.stages).toHaveBeenCalledWith("org",actor);expect(mocks.purge).toHaveBeenCalledWith("org","file",actor,true)
  expect(f.query.eq).toHaveBeenCalledWith("org_id","org");expect(f.query.is).toHaveBeenCalledWith("document_kind",null);expect(f.query.limit).toHaveBeenCalledWith(2)
  const [column,cutoff]=f.query.lt.mock.calls[0];expect(column).toBe("deleted_at");expect(Date.parse(cutoff)).toBeGreaterThanOrEqual(before-30*86400000);expect(Date.parse(cutoff)).toBeLessThanOrEqual(Date.now()-30*86400000)
  expect(f.remove).not.toHaveBeenCalled();expect(f.query.delete).not.toHaveBeenCalled()
 })
 it("leaves metadata to the durable reservation when physical deletion is unconfirmed",async()=>{
  const f=fixture({data:true,error:null});mocks.purge.mockResolvedValue({ok:false,status:503,error:"Retry same file"})
  await purgeExpiredFiles(f.client,"org",actor);expect(mocks.purge).toHaveBeenCalledTimes(1);expect(f.query.delete).not.toHaveBeenCalled()
 })
 it("never forwards a foreign or traversing path for organization cleanup",async()=>{
  const f=fixture({data:true,error:null});f.query.returns.mockResolvedValue({data:[{id:"foreign",storage_path:"other/library/old.txt"},{id:"traversing",storage_path:"org/library/../old.txt"}],error:null})
  await purgeExpiredFiles(f.client,"org",actor);expect(mocks.purge).not.toHaveBeenCalled();expect(f.remove).not.toHaveBeenCalled();expect(f.query.delete).not.toHaveBeenCalled()
 })
})
