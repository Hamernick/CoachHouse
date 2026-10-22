import { beforeEach,describe,expect,it,vi } from "vitest"
import { saveRoadmapSectionAction } from "@/actions/roadmap"
import { resolveRoadmapSections } from "@/lib/roadmap"

const mocks=vi.hoisted(()=>({client:vi.fn(),org:vi.fn(),rpc:vi.fn(),directWrite:vi.fn()}))
vi.mock("@/lib/supabase/server",()=>({createSupabaseServerClient:mocks.client}))
vi.mock("@/lib/supabase/admin",()=>({createSupabaseAdminClient:()=>({rpc:mocks.rpc})}))
vi.mock("@/lib/organization/active-org",()=>({resolveActiveOrganization:mocks.org,canEditOrganization:(role:string)=>role==="owner"}))
vi.mock("@/lib/organization/document-storage-access",()=>({resolveOrganizationDocumentStorageAccess:async()=>({hasStorageAccess:true})}))
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`
const baseline="2026-10-21T00:00:00.000Z"
const input={aiRunId:id(3),expectedUserId:id(2),expectedOrganizationId:id(1),expectedLastUpdated:baseline,sectionId:"vision",content:"<p>A reviewed vision</p>",isPublic:true,status:"complete" as const}
let profile:Record<string,unknown>,organizationRevision:string,application:Record<string,unknown> | null,loseResponse:boolean
beforeEach(()=>{
  vi.clearAllMocks();application=null;loseResponse=false;organizationRevision=baseline
  profile={roadmap:{sections:[{id:"vision",title:"Vision",content:"<p>Original</p>",lastUpdated:baseline,isPublic:true,status:"complete"}]}}
  const reader={select:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),maybeSingle:vi.fn(async()=>({data:{profile:structuredClone(profile),public_slug:null,updated_at:organizationRevision},error:null}))}
  mocks.client.mockResolvedValue({auth:{getUser:async()=>({data:{user:{id:id(2)}},error:null})},from:()=>({...reader,update:mocks.directWrite})})
  mocks.org.mockResolvedValue({orgId:id(1),role:"owner"})
  mocks.rpc.mockImplementation(async(name,args)=>{
    if (name === "read_workspace_ai_run") return {data:{id:id(3),org_id:id(1),actor_id:id(2),status:"succeeded",proposal:input.content,charged_credits:10,max_credits:100,application,
      target:{organizationId:id(1),userId:id(2),sectionId:"vision",title:"Vision",revision:baseline,content:"<p>Original</p>"}},error:null}
    if (name === "commit_workspace_ai_document") {
      if (args.p_expected_updated_at !== organizationRevision) return {data:null,error:{code:"40001"}}
      profile=args.p_profile;organizationRevision="2026-10-22T13:00:00.000Z"
      application={run_id:id(3),section_id:"vision",saved_revision:args.p_section.lastUpdated,content_hash:args.p_content_hash,saved_at:organizationRevision}
      if (loseResponse) {loseResponse=false;return {error:{message:"Response lost"},data:null}}
      return {data:{replayed:false,application},error:null}
    }
    throw new Error(`Unexpected RPC ${name}`)
  })
})
describe("AI saves through the canonical roadmap action",()=>{
  it("saves the reviewed content privately and returns the durable application receipt",async()=>{
    const result=await saveRoadmapSectionAction(input)
    expect(result).toMatchObject({section:{id:"vision",content:input.content,isPublic:false,status:"in_progress"},aiApplication:{run_id:id(3)}})
    expect(resolveRoadmapSections(profile).find(section=>section.id==="vision")).toMatchObject({content:input.content,isPublic:false,status:"in_progress"})
    expect(mocks.directWrite).not.toHaveBeenCalled()
  })
  it("recovers a lost response without another document write or generation",async()=>{
    loseResponse=true
    expect(await saveRoadmapSectionAction(input)).toHaveProperty("error")
    const reopened=resolveRoadmapSections(profile).find(section=>section.id==="vision")
    expect(reopened?.content).toBe(input.content)
    expect(await saveRoadmapSectionAction(input)).toMatchObject({section:{content:input.content},aiReplay:true,aiApplication:{run_id:id(3)}})
    expect(mocks.rpc.mock.calls.filter(call=>call[0]==="commit_workspace_ai_document")).toHaveLength(1)
  })
  it("does not overwrite another editor's changes after an acknowledged save",async()=>{
    await saveRoadmapSectionAction(input)
    profile={roadmap:{sections:[{id:"vision",title:"Vision",content:"<p>Collaborator edit</p>",lastUpdated:"2099-01-01T00:00:00Z"}]}}
    expect(await saveRoadmapSectionAction(input)).toMatchObject({code:"conflict",currentSection:{content:"<p>Collaborator edit</p>"}})
    expect(mocks.rpc.mock.calls.filter(call=>call[0]==="commit_workspace_ai_document")).toHaveLength(1)
  })
  it("rejects a stale baseline before writing",async()=>{
    profile={roadmap:{sections:[{id:"vision",content:"<p>Newer</p>",lastUpdated:"2099-01-01T00:00:00Z"}]}}
    expect(await saveRoadmapSectionAction(input)).toHaveProperty("error")
    expect(mocks.rpc.mock.calls.filter(call=>call[0]==="commit_workspace_ai_document")).toHaveLength(0)
  })
  it("enforces organization scope and editing permission before accessing the proposal",async()=>{
    expect(await saveRoadmapSectionAction({...input,expectedOrganizationId:id(4)})).toMatchObject({code:"scope_changed"})
    mocks.org.mockResolvedValue({orgId:id(1),role:"board"})
    expect(await saveRoadmapSectionAction(input)).toEqual({error:"Forbidden"})
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
})
