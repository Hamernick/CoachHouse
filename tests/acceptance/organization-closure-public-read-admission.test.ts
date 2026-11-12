import { beforeEach, describe, expect, it, vi } from "vitest"
const rpc=vi.hoisted(()=>vi.fn())
const inputs=vi.hoisted(()=>({ from: vi.fn(), cached: undefined as unknown }))
vi.mock("@/lib/env",()=>({env:{SUPABASE_SERVICE_ROLE_KEY:"fixture"}}))
vi.mock("next/cache",()=>({unstable_cache:(load:()=>Promise<unknown>)=>async()=>{
 if(inputs.cached === undefined) inputs.cached=await load()
 return inputs.cached
}}))
vi.mock("@/lib/supabase/admin",()=>({createSupabaseAdminClient:()=>({rpc,from:inputs.from})}))
import { filterPublicDocumentSections, filterPublicOrganizationProfiles } from "@/lib/organization/public-document-audience"
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

describe("public document audience", () => {
  beforeEach(() => rpc.mockReset())
  it("preserves allowed content without modifying canonical candidates", async () => {
    const sections = [{ id: "private", content: "secret" }, { id: "shared", content: "published" }]
    rpc.mockResolvedValue({ data: { blockedSectionIds: ["private"], complete: false }, error: null })
    expect(await filterPublicDocumentSections(sections, "org")).toEqual([sections[1]])
    expect(sections[0].content).toBe("secret")
    expect(rpc).toHaveBeenCalledWith("read_public_document_audience", { p_org_id: "org", p_section_ids: ["private", "shared"], p_audience: "roadmap" })
  })
  it("rechecks publication even for an empty roadmap and does not cache grants", async () => {
    rpc.mockResolvedValueOnce({ data: { blockedSectionIds: [], complete: false }, error: null })
      .mockResolvedValueOnce({ data: null, error: null })
    expect(await filterPublicDocumentSections([], "org")).toEqual([])
    expect(await filterPublicDocumentSections([], "org")).toBeNull()
    expect(rpc).toHaveBeenCalledTimes(2)
  })
  it.each([
    { data: { blockedSectionIds: ["foreign"], complete: false }, error: null },
    { data: { blockedSectionIds: ["shared", "shared"], complete: false }, error: null },
    { data: { blockedSectionIds: [], complete: true }, error: null },
    { data: { blockedSectionIds: [], complete: false, body: "private" }, error: null },
    { data: null, error: { message: "unavailable" } },
  ])("fails closed on invalid or unavailable authority (%j)", async result => {
    rpc.mockResolvedValue(result)
    await expect(filterPublicDocumentSections([{ id: "shared" }], "org")).rejects.toThrow("could not be verified")
  })
  it("discards partial success when a later batch loses publication", async () => {
    const sections = Array.from({ length: 501 }, (_, i) => ({ id: `section-${i}` }))
    rpc.mockResolvedValueOnce({ data: { blockedSectionIds: [], complete: false }, error: null })
      .mockResolvedValueOnce({ data: null, error: null })
    expect(await filterPublicDocumentSections(sections, "org", "profile")).toBeNull()
    expect(rpc.mock.calls.map(call => call[1].p_section_ids.length)).toEqual([500, 1])
    expect(rpc.mock.calls.every(call => call[1].p_audience === "profile")).toBe(true)
  })
})


import { fetchPublicMapOrganizations } from "@/lib/queries/public-map-index"
import { resolvePublicOrganizationProfileNarratives } from "@/lib/roadmap/public-organization-profile"
const publicOrg="10000000-0000-4000-8000-000000000001"
const publicRow={user_id:publicOrg,ein:null,public_slug:"community",location_lat:40,location_lng:-74,
 profile:{name:"Community",mission:"restrictedneedle",vision:"shared vision",originStory:"private origin",need_statement:"private need",theoryOfChange:"private theory"}}
const audience=(blockedSectionIds:string[]=[])=>({data:[{organizationId:publicOrg,blockedSectionIds,complete:false}],error:null})
describe("public profile projection after cache",()=>{
 beforeEach(()=>{rpc.mockReset();inputs.from.mockReset();inputs.cached=undefined})
 it("rechecks cached inputs before deriving descriptions and search text",async()=>{
  inputs.from.mockImplementation((table:string)=>{
   const builder={select:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),in:vi.fn().mockReturnThis(),order:vi.fn().mockReturnThis(),
    returns:async()=>({data:table==="organizations"?[structuredClone(publicRow)]:[],error:null})}
   return builder
  })
  rpc.mockResolvedValueOnce(audience()).mockResolvedValueOnce(audience(["mission_vision_values"]))
   .mockResolvedValueOnce({data:[],error:null})
  const first=await fetchPublicMapOrganizations()
  expect(first[0].mission).toContain("restrictedneedle")
  expect(first[0].description).toContain("restrictedneedle")
  const second=await fetchPublicMapOrganizations()
  expect(second).toHaveLength(1)
  expect(second[0].mission).toBeNull();expect(second[0].description).toBeNull()
  expect(second[0].vision).toContain("shared vision")
  expect(JSON.stringify(second)).not.toContain("restrictedneedle")
  expect(await fetchPublicMapOrganizations()).toEqual([])
  expect(inputs.from).toHaveBeenCalledTimes(2) // organization/program input fetched only once
  expect(rpc).toHaveBeenCalledTimes(3)
  expect(publicRow.profile.mission).toBe("restrictedneedle")
 })
 it("removes legacy aliases and stored bodies without changing canonical input",async()=>{
  const row=structuredClone(publicRow)
  Object.assign(row.profile,{roadmap:{sections:{mission_vision_values:{content:"restrictedneedle",lastUpdated:"2026-11-07"}}}})
  rpc.mockResolvedValue(audience(["mission_vision_values","origin_story","need","theory_of_change"]))
  const [projected]=await filterPublicOrganizationProfiles([row])
  const narratives=resolvePublicOrganizationProfileNarratives(projected.profile)
  expect(narratives).toMatchObject({mission:"",originStory:"",needStatement:"",theoryOfChange:""})
  expect(narratives.vision).toContain("shared vision")
  expect(row.profile.mission).toBe("restrictedneedle")
 })
 it.each([
  {data:null,error:null}, {data:[],error:{message:"unavailable"}},
  {data:[{organizationId:"10000000-0000-4000-8000-000000000002",blockedSectionIds:[],complete:false}],error:null},
  audience(["unknown"]),audience(["vision","vision"]),
  {data:[...audience().data,...audience().data],error:null},
 ])("rejects invalid or unavailable batch authority (%j)",async result=>{
  rpc.mockResolvedValue(result)
  await expect(filterPublicOrganizationProfiles([publicRow])).rejects.toThrow("could not be verified")
 })
 it("batches requests and never returns partial success after a later failure",async()=>{
  const rows=Array.from({length:501},(_,i)=>({...publicRow,user_id:`10000000-0000-4000-8000-${String(i).padStart(12,"0")}`}))
  rpc.mockResolvedValueOnce({data:rows.slice(0,500).map(row=>({organizationId:row.user_id,blockedSectionIds:[],complete:false})),error:null})
   .mockResolvedValueOnce({data:null,error:{message:"failed"}})
  await expect(filterPublicOrganizationProfiles(rows)).rejects.toThrow("could not be verified")
  expect(rpc.mock.calls.map(call=>call[1].p_org_ids.length)).toEqual([500,1])
 })
})
