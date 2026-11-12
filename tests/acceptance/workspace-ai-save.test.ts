import { beforeEach,describe,expect,it,vi } from "vitest"
import { saveRoadmapSectionAction } from "@/actions/roadmap"
import { resolveRoadmapSections } from "@/lib/roadmap"

const mocks=vi.hoisted(()=>({client:vi.fn(),org:vi.fn(),rpc:vi.fn(),directWrite:vi.fn(),admin:vi.fn()}))
vi.mock("@/lib/supabase/server",()=>({createSupabaseServerClient:mocks.client}))
vi.mock("@/lib/supabase/admin",()=>({createSupabaseAdminClient:mocks.admin}))
vi.mock("@/lib/organization/active-org",()=>({resolveActiveOrganization:mocks.org,canEditOrganization:(role:string)=>role==="owner"}))
vi.mock("@/lib/organization/document-storage-access",()=>({resolveOrganizationDocumentStorageAccess:async()=>({hasStorageAccess:true}),requireOrganizationDocumentStorage:async()=>({allowed:true})}))
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`
const baseline="2026-10-21T00:00:00.000Z"
const driveSource={provider:"google_drive",fileId:"retained_file_123",name:"Linked source",webViewLink:"https://docs.google.com/document/d/retained_file_123/edit"}
const input={aiRunId:id(3),expectedUserId:id(2),expectedOrganizationId:id(1),expectedLastUpdated:baseline,sectionId:"vision",content:"<p>A reviewed vision</p>",isPublic:true,status:"complete" as const}
let profile:Record<string,unknown>,organizationRevision:string,application:Record<string,unknown> | null,loseResponse:boolean
beforeEach(()=>{
  vi.clearAllMocks();mocks.admin.mockReturnValue({rpc: (name: string, args: unknown) => name === "read_workspace_ai_document_copy_sources" ? Promise.resolve({ data: { blockedSectionIds: [], complete: false }, error: null }) : mocks.rpc(name, args)});application=null;loseResponse=false;organizationRevision=baseline
  profile={roadmap:{sections:[{id:"vision",title:"Vision",content:"<p>Original</p>",lastUpdated:baseline,isPublic:true,status:"complete"}]}}
  const reader={select:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),single:vi.fn(async()=>({data:{profile:structuredClone(profile)},error:null})),maybeSingle:vi.fn(async()=>({data:{profile:structuredClone(profile),public_slug:null,updated_at:organizationRevision},error:null}))}
  mocks.client.mockResolvedValue({auth:{getUser:async()=>({data:{user:{id:id(2)}},error:null})},from:()=>({...reader,update:mocks.directWrite})})
  mocks.org.mockResolvedValue({orgId:id(1),role:"owner"})
  mocks.rpc.mockImplementation(async(name,args)=>{
    if (name === "read_workspace_ai_document_sources") return {data:{sources:[{runId:id(3),sectionId:"vision",kind:"editor"}],complete:false},error:null}
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
  it("saves and recovers an explicitly selected editor while retaining its inactive Drive reference",async()=>{
    profile={unrelated:{keep:true},roadmap:{sections:[{id:"vision",title:"Vision",content:"<p>Original</p>",lastUpdated:baseline,documentSource:"editor",driveSource}]}}
    loseResponse=true
    expect(await saveRoadmapSectionAction(input)).toHaveProperty("error")
    expect(await saveRoadmapSectionAction(input)).toMatchObject({aiReplay:true,section:{content:input.content,documentSource:"editor",driveSource},aiApplication:{run_id:id(3)}})
    expect(profile.unrelated).toEqual({keep:true})
    expect(mocks.rpc.mock.calls.filter(call=>call[0]==="commit_workspace_ai_document")).toHaveLength(1)
  })
  it.each([
    {documentSource:"google_drive",driveSource},
    {documentSource:"google_drive",driveSource:null},
    {documentSource:"google_drive",driveSource:{...driveSource,webViewLink:"https://example.com/untrusted"}},
    {driveSource},
  ])("rejects an active Drive source before reading or applying an editor proposal: %j",async source=>{
    profile={roadmap:{sections:[{id:"vision",content:"<p>Inactive editor</p>",lastUpdated:baseline,...source}]}}
    const original=structuredClone(profile)
    expect(await saveRoadmapSectionAction(input)).toHaveProperty("error")
    expect(mocks.rpc).not.toHaveBeenCalled()
    expect(profile).toEqual(original)
  })
  it("preserves a concurrent switch to Drive through the existing organization revision guard",async()=>{
    const original=mocks.rpc.getMockImplementation()!
    mocks.rpc.mockImplementation(async(name,args)=>{
      if (name === "commit_workspace_ai_document") {
        profile={roadmap:{sections:[{id:"vision",content:"<p>Original</p>",lastUpdated:baseline,documentSource:"google_drive",driveSource}]}}
        organizationRevision="2026-10-22T12:00:00.000Z"
      }
      return original(name,args)
    })
    expect(await saveRoadmapSectionAction(input)).toMatchObject({code:"conflict",currentSection:{documentSource:"google_drive",driveSource}})
    expect(application).toBeNull()
    expect(resolveRoadmapSections(profile).find(section=>section.id==="vision")?.content).toBe("<p>Original</p>")
  })
  it("saves the reviewed content privately and returns the durable application receipt",async()=>{
    const result=await saveRoadmapSectionAction(input)
    expect(result).toMatchObject({section:{id:"vision",content:input.content,isPublic:false,status:"in_progress"},aiApplication:{run_id:id(3)}})
    expect(resolveRoadmapSections(profile).find(section=>section.id==="vision")).toMatchObject({content:input.content,isPublic:false,status:"in_progress"})
    expect(mocks.directWrite).not.toHaveBeenCalled()
    expect(mocks.admin).toHaveBeenCalledWith({actorId:id(2),requestTimeoutMs:15000})
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
  it("requires explicit review of the exact newer revision before rebasing an unapplied AI draft",async()=>{
    const revision="2026-10-22T12:00:00.000Z"
    profile={roadmap:{sections:[{id:"vision",content:"<p>Newer collaborator version</p>",lastUpdated:revision}]}}
    expect(await saveRoadmapSectionAction({...input,expectedLastUpdated:revision})).toMatchObject({code:"conflict",currentSection:{lastUpdated:revision}})
    expect(await saveRoadmapSectionAction({...input,expectedLastUpdated:revision,reviewedAiRevision:baseline})).toMatchObject({code:"conflict"})
    const result=await saveRoadmapSectionAction({...input,expectedLastUpdated:revision,reviewedAiRevision:revision})
    expect(result).toMatchObject({section:{content:input.content,isPublic:false,status:"in_progress"},aiApplication:{run_id:id(3)}})
    expect(mocks.rpc.mock.calls.find(call=>call[0]==="commit_workspace_ai_document")?.[1].p_reviewed_revision).toBe(revision)
  })
  it("rejects another intervening edit after review",async()=>{
    profile={roadmap:{sections:[{id:"vision",content:"<p>Even newer</p>",lastUpdated:"2099-01-01T00:00:00Z"}]}}
    const reviewed="2026-10-22T12:00:00.000Z"
    expect(await saveRoadmapSectionAction({...input,expectedLastUpdated:reviewed,reviewedAiRevision:reviewed})).toMatchObject({code:"conflict",currentSection:{content:"<p>Even newer</p>"}})
    expect(mocks.rpc.mock.calls.filter(call=>call[0]==="commit_workspace_ai_document")).toHaveLength(0)
  })
  it("returns the current section after an atomic organization CAS race",async()=>{
    const original=mocks.rpc.getMockImplementation()!
    mocks.rpc.mockImplementation(async(name,args)=>{
      if (name === "commit_workspace_ai_document") {
        profile={roadmap:{sections:[{id:"vision",content:"<p>Racing collaborator</p>",lastUpdated:"2099-01-01T00:00:00Z"}]}}
        return {data:null,error:{code:"40001"}}
      }
      return original(name,args)
    })
    expect(await saveRoadmapSectionAction(input)).toMatchObject({code:"conflict",currentSection:{content:"<p>Racing collaborator</p>"}})
  })
  it("withholds success when edit permission is revoked during save", async()=>{
    const original=mocks.rpc.getMockImplementation()!
    mocks.rpc.mockImplementation(async(name,args)=>name === "commit_workspace_ai_document"
      ? {data:null,error:{code:"42501",message:"Document editor access required."}}
      : original(name,args))
    expect(await saveRoadmapSectionAction(input)).toEqual({error:"Unable to confirm this AI document save. Retry to recover its status."})
    expect(resolveRoadmapSections(profile).find(section=>section.id==="vision")?.content).toBe("<p>Original</p>")
    expect(application).toBeNull()
    expect(mocks.directWrite).not.toHaveBeenCalled()
  })

  it.each([false,true])("withholds save or receipt recovery when retained sources cannot be verified (saved=%s)",async saved=>{
    if (saved) await saveRoadmapSectionAction(input)
    const before=structuredClone(profile),oldApplication=structuredClone(application)
    mocks.rpc.mockClear()
    const original=mocks.rpc.getMockImplementation()!
    mocks.rpc.mockImplementation(async(name,args)=>name === "read_workspace_ai_document_sources"
      ? {data:null,error:{code:"42501"}} : original(name,args))
    expect(await saveRoadmapSectionAction(input)).toEqual({error:"Document sources could not be verified. Reopen the document."})
    expect(profile).toEqual(before)
    expect(application).toEqual(oldApplication)
    expect(mocks.rpc.mock.calls.some(call=>call[0] === "commit_workspace_ai_document")).toBe(false)
  })

})
