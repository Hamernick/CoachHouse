import { beforeEach, describe, expect, it, vi } from "vitest"
const rpc=vi.hoisted(()=>vi.fn())
vi.mock("@/lib/supabase/admin",()=>({createSupabaseAdminClient:()=>({rpc})}))
import { currentlyPublicOrganizationIds } from "@/lib/organization/public-read-admission"
describe("fresh public organization admission",()=>{
 beforeEach(()=>rpc.mockReset())
 it("deduplicates and accepts only currently admitted scope",async()=>{
  rpc.mockResolvedValue({data:["active"],error:null})
  expect(await currentlyPublicOrganizationIds(["active","closing","active"])).toEqual(new Set(["active"]))
  expect(rpc).toHaveBeenCalledWith("filter_public_organization_ids",{p_ids:["active","closing"],p_audience:"profile"})
 })
 it("checks again for every call even when cached projections are unchanged",async()=>{
  rpc.mockResolvedValueOnce({data:["org"],error:null}).mockResolvedValueOnce({data:[],error:null})
  expect((await currentlyPublicOrganizationIds(["org"])).has("org")).toBe(true)
  expect((await currentlyPublicOrganizationIds(["org"])).has("org")).toBe(false)
 })
 it("keeps roadmap publication authority separate",async()=>{
  rpc.mockResolvedValue({data:[],error:null})
  expect(await currentlyPublicOrganizationIds(["org"],"roadmap")).toEqual(new Set())
  expect(rpc).toHaveBeenCalledWith("filter_public_organization_ids",{p_ids:["org"],p_audience:"roadmap"})
 })
 it.each([{data:["foreign"],error:null},{data:null,error:null},{data:[],error:{message:"private"}},{data:[7],error:null}])("fails closed for unavailable or invalid authority",async result=>{
  rpc.mockResolvedValue(result)
  expect(await currentlyPublicOrganizationIds(["org"])).toEqual(new Set())
 })
 it("bounds each admission to 500 IDs and discards partial success after failure",async()=>{
  const ids=Array.from({length:501},(_,index)=>`org-${index}`)
  rpc.mockResolvedValueOnce({data:ids.slice(0,500),error:null}).mockResolvedValueOnce({data:null,error:{message:"timeout"}})
  expect(await currentlyPublicOrganizationIds(ids)).toEqual(new Set())
  expect(rpc.mock.calls.map(call=>call[1].p_ids.length)).toEqual([500,1])
 })
 it("does no admission for a projection with no organizations",async()=>{
  expect(await currentlyPublicOrganizationIds([])).toEqual(new Set())
  expect(rpc).not.toHaveBeenCalled()
 })
})
