import { beforeEach, expect, it, vi } from "vitest"
import { ID, WORKSPACE, graph, particle } from "./fixtures/particle-fixtures"
const mocks=vi.hoisted(()=>({rpc:vi.fn(),admin:vi.fn(),read:vi.fn(),actor:vi.fn()}))
vi.mock("@/lib/auth/request-context",()=>({resolveAuthenticatedAppContext:mocks.actor}))
vi.mock("@/lib/supabase/admin",()=>({createSupabaseAdminClient:mocks.admin}))
vi.mock("@/features/ai-credits",()=>({readAiRun:mocks.read}))
vi.mock("@/lib/organization/document-storage-access",()=>({resolveOrganizationDocumentStorageAccess:async()=>({hasStorageAccess:true})}))
import { retainedParticleFiles } from "@/lib/organization/particle-ai-origins"
import { filterWorkspaceAiSourceIds } from "@/lib/organization/workspace-ai-source-context"
import { filterAiDocumentCopies } from "@/lib/organization/document-ai-copies"
import { knowledgeLoader } from "@/features/workspace-ai/server/knowledge-records"
import { readConversationHistoryTurn } from "@/features/workspace-ai/server/conversation-history"
import { assertResearchSourcesAccessible } from "@/features/workspace-ai/server/research-result-access"
import { knowledgeFingerprint, researchContextFingerprint } from "@/features/workspace-ai/server/research-dependencies"
import { filterDocumentActivityAudience } from "@/lib/organization/document-activity-audience"
import type { ResearchContext } from "@/features/workspace-ai/server/research-context"
import type { ResearchResult } from "@/features/workspace-ai/research-types"
import { createKnowledgeFreshness } from "@/features/workspace-ai/server/knowledge-freshness"
import { loadResearchContext } from "@/features/workspace-ai/server/research-context"
import { mergeConversationDependencies } from "@/features/workspace-ai/lib/research-conversation"
import { authorizeResearchFileContext, initialResearchParticleIds } from "@/features/workspace-ai/server/knowledge-particle-files"
import { researchContextProjection } from "@/features/workspace-ai/server/research-prompt"
import { knowledgeDisclosure } from "@/features/workspace-ai/server/knowledge-evidence"
const file={id:ID(10),name:"Private source title",mime_type:"text/plain",size_bytes:10,updated_at:"2026-11-06T12:00:00Z"}
const target={organizationId:WORKSPACE,mode:"new_objective" as const,canvasId:null,revision:0}
const query=(data:unknown)=>{const chain:Record<string,unknown>={};for(const k of ["select","eq","is","ilike","order","limit","abortSignal"])chain[k]=()=>chain;chain.single=chain.maybeSingle=async()=>({data,error:null});chain.then=(resolve:(x:unknown)=>unknown)=>Promise.resolve({data,error:null}).then(resolve);return chain}
const context={user:{id:ID(90)},canvasId:null,target,graph:graph([]),supabase:{from:(table:string)=>query(table==="organizations"?{profile:{name:"Organization"},updated_at:"unchanged"}:[file])}} as unknown as ResearchContext
const entry={id:ID(20),rootId:ID(20),turn:1,createdAt:"2026-11-06T12:00:00Z",status:"succeeded"}
let retained: Array<{id:string;fileIds:string[];complete:false}>=[]
let eligibleCanvas: string | null = null
let allowed=true
let blockedSections: string[]=[]
beforeEach(()=>{
 vi.resetAllMocks();eligibleCanvas=null;allowed=true;retained=[];blockedSections=[]
 mocks.admin.mockReturnValue({rpc:mocks.rpc})
 mocks.rpc.mockImplementation(async(name:string,args:{p_file_ids?:string[];p_event_ids?:string[];p_section_ids?:string[];p_canvas_id?:string})=>({error:null,data:name==="filter_workspace_ai_sources"?{fileIds:allowed&&(!eligibleCanvas||args.p_canvas_id===eligibleCanvas)?(args.p_file_ids??[]):[],sectionIds:(!eligibleCanvas||args.p_canvas_id===eligibleCanvas)?(args.p_section_ids??[]).filter(id=>!blockedSections.includes(id)):[]}:name==="read_workspace_particle_ai_documents"?[]:name==="read_workspace_ai_document_copy_sources"?{blockedSectionIds:blockedSections,complete:false}:name==="read_workspace_particle_ai_files"?retained:name==="manage_workspace_research_conversation"?{deleted:false}:allowed?(args.p_file_ids??args.p_event_ids):[]}))
})
it("filters elevated document search and exact selection using the actual actor on every read",async()=>{
 const load=knowledgeLoader(context)
 expect(await load("document","Private")).toEqual([expect.objectContaining({id:`file:${file.id}`,title:file.name})])
 allowed=false
 expect(await load("document","Private")).toEqual([])
 expect(await load("document","",`file:${file.id}`)).toEqual([])
 expect(mocks.admin).toHaveBeenLastCalledWith({actorId:context.user.id,requestTimeoutMs:10000})
 expect(mocks.rpc.mock.calls.filter(([name]) => name === "filter_workspace_ai_sources").at(-1)).toEqual(["filter_workspace_ai_sources", {p_org_id:WORKSPACE,p_canvas_id:"default",p_file_ids:[file.id],p_section_ids:[],p_actor_id:context.user.id}])
})
it.each(["answer","clarify","proposal"] as const)("withholds saved %s text, citations and prompts after uncited source revocation",async responseKind=>{
 const record=(await knowledgeLoader(context)("document","",`file:${file.id}`))[0]
 const result:ResearchResult={runId:entry.id,target,responseKind,title:"Private derived title",summary:"Private derived content",questions:[],sources:[],items:[],dependencies:{version:1,contextFingerprint:researchContextFingerprint(context),records:[{id:record.id,kind:record.kind,fingerprint:knowledgeFingerprint(record)}]}}
 const part=responseKind==="proposal"?{type:"data-plan",data:{runId:entry.id,title:result.title}}:{type:"data-reply",data:{runId:entry.id,title:result.title,kind:responseKind}}
 mocks.read.mockResolvedValue({id:entry.id,status:"succeeded",prompt:"Private request",proposal:JSON.stringify(result),charged_credits:1,cancel_requested_at:null,target:{...target,kind:"particle_research",userId:context.user.id,conversation:{id:entry.id,parentId:null,turn:1,draftRevision:0}},conversation_messages:[{id:`${entry.id}:user`,role:"user",parts:[{type:"text",text:"Private request"}]},{id:`${entry.id}:assistant`,role:"assistant",parts:[{type:"text",text:result.summary},part]}]})
 expect(await readConversationHistoryTurn(context,entry)).toMatchObject({summary:result.summary,prompt:"Private request",unavailable:false})
 allowed=false
 await expect(readConversationHistoryTurn(context,entry)).rejects.toMatchObject({code:"sources_changed"})
 await expect(assertResearchSourcesAccessible(context,result)).rejects.toMatchObject({code:"sources_changed"})
 mocks.rpc.mockResolvedValue({data:null,error:{message:"private transport detail"}})
 await expect(assertResearchSourcesAccessible(context,result,"history")).rejects.toMatchObject({code:"verification_unavailable"})
})
it("bounds elevated activity filtering, preserves order and refuses foreign IDs or failed batches",async()=>{
 const rows=Array.from({length:501},(_,i)=>({id:ID(i+1),title:`Event ${i}`}))
 expect(await filterDocumentActivityAudience(rows,ID(90))).toEqual(rows)
 expect(mocks.rpc.mock.calls.map(call=>call[1].p_event_ids.length)).toEqual([500,1])
 mocks.rpc.mockResolvedValueOnce({data:[ID(9999)],error:null})
 await expect(filterDocumentActivityAudience(rows,ID(90))).rejects.toThrow("could not be verified")
 mocks.rpc.mockResolvedValueOnce({data:rows.slice(0,500).map(row=>row.id),error:null}).mockResolvedValueOnce({data:null,error:{message:"private"}})
 await expect(filterDocumentActivityAudience(rows,ID(90))).rejects.toThrow("could not be verified")
})

function filePlanContext(): ResearchContext {
 const objective=particle(1,"objective"),document=particle(11),note=particle(12),unrelated=particle(13)
 if(objective.type!=="objective"||document.type!=="activity")throw new Error("Invalid fixture")
 document.title="Private document card"
 document.data.widget={kind:"document",fileId:file.id,name:file.name,format:"txt",size:10}
 note.title="Private derived note"
 objective.data.planning={plans:[{id:ID(30),revision:0,title:"Private plan",summary:"Private summary",particleIds:[document.id,note.id],researchRunId:ID(20),sources:[{id:`file:${file.id}`,kind:"workspace",title:file.name,href:"/workspace",revision:null,checkedAt:entry.createdAt}]}],proposals:[]}
 return {...context,graph:graph([objective,document,note,unrelated])}
}

it("reauthorizes particle metadata, generated members and plan summaries without changing the canonical board",async()=>{
 const current=filePlanContext(),objective=current.graph.particles[0]
 if(objective.type!=="objective")throw new Error("Invalid fixture")
 objective.data.planning!.plans.push({id:ID(31),revision:0,title:"Other plan",particleIds:[]})
 const before=JSON.stringify(current.graph),load=knowledgeLoader(current)
 expect(await load("particle","")).toHaveLength(6)
 allowed=false
 expect((await load("particle","")).map(record=>record.id)).toEqual([`particle:${ID(13)}`])
 for(const id of [`particle:${ID(1)}`,`particle:${ID(11)}`,`particle:${ID(12)}`,`particle:${ID(1)}:plan:${ID(30)}`,`particle:${ID(1)}:plan:${ID(31)}`])
  expect(await load("particle","",id)).toEqual([])
 expect(JSON.stringify(current.graph)).toBe(before)
 allowed=true
 expect(await load("particle","",`particle:${ID(12)}`)).toHaveLength(1)
 mocks.rpc.mockResolvedValue({data:null,error:{message:"private failure"}})
 await expect(load("particle","")).rejects.toThrow("could not be verified")
})

it("checks implicit objective context before returning it for generation",async()=>{
 const current=filePlanContext()
 current.graph.particles.push(particle(14,"objective"))
 mocks.actor.mockResolvedValue({...current,activeOrg:{orgId:WORKSPACE,role:"owner"},supabase:{from:()=>query({state:{particleGraph:current.graph}})}})
 expect((await loadResearchContext(target,true,{includeDataViewSources:false})).graph).toEqual(current.graph)
 allowed=false
 const projected=await loadResearchContext(target,true,{includeDataViewSources:false})
 expect(projected.graph).toEqual(current.graph)
 expect(researchContextProjection(projected)).toMatchObject({existingObjectives:[{id:`particle:${ID(14)}`}],objectiveCoverage:{shown:1,total:1,omitted:0}})
 expect(createKnowledgeFreshness(projected).dependencies().nativeFileIds).toBeUndefined()
 await expect(loadResearchContext({organizationId:WORKSPACE,objectiveId:ID(1),revision:0},true,{includeDataViewSources:false})).rejects.toThrow("Research context is unavailable")
 // Folder RPC remains authoritative for owner/member decisions, not this flag.
 expect(mocks.rpc.mock.calls.filter(([name]) => name === "filter_workspace_ai_sources").at(-1)).toEqual(["filter_workspace_ai_sources", {p_org_id:WORKSPACE,p_canvas_id:"default",p_file_ids:[file.id],p_section_ids:[],p_actor_id:current.user.id}])
})

it("retains implicit uncited files across turns and denies history after the board reference disappears",async()=>{
 const current=filePlanContext()
 const dependencies=createKnowledgeFreshness(current).dependencies()
 expect(dependencies.nativeFileIds).toEqual([file.id])
 expect(dependencies.records).toEqual([])
 const inherited=mergeConversationDependencies([{...dependencies,nativeFileIds:[ID(40)]},dependencies])
 expect(inherited.nativeFileIds).toEqual([file.id,ID(40)])
 const result:ResearchResult={runId:entry.id,target,responseKind:"answer",title:"Private answer",summary:"Private derived text",questions:[],sources:[],items:[],dependencies}
 await expect(assertResearchSourcesAccessible(current,result,"history")).resolves.toBeUndefined()
 allowed=false
 await expect(assertResearchSourcesAccessible(context,result,"history")).rejects.toMatchObject({code:"sources_changed"})
 mocks.rpc.mockResolvedValue({data:null,error:{message:"private failure"}})
 await expect(assertResearchSourcesAccessible(context,result,"history")).rejects.toMatchObject({code:"verification_unavailable"})
})

it("retains files from explicitly selected particles outside implicit objective context",async()=>{
 const current=filePlanContext()
 current.graph.particles=current.graph.particles.filter(item=>item.type!=="objective")
 const knowledge=createKnowledgeFreshness(current)
 expect(knowledge.dependencies().nativeFileIds).toBeUndefined()
 knowledge.observe((await knowledgeLoader(current)("particle","",`particle:${ID(11)}`))[0])
 expect(knowledge.dependencies().nativeFileIds).toEqual([file.id])
})

it("captures newly observed lineage outside the original graph without adding it to model text",async()=>{
 const knowledge=createKnowledgeFreshness(context)
 const record=(await knowledgeLoader(filePlanContext())("particle","",`particle:${ID(11)}`))[0]
 knowledge.observe(record)
 expect(knowledge.dependencies().nativeFileIds).toEqual([file.id])
 expect(knowledgeDisclosure(record,"read",1000)).not.toHaveProperty("nativeFileIds")
})

it("does not call the file authority for an unrelated plain workspace",async()=>{
 await authorizeResearchFileContext(context)
 expect(await knowledgeLoader(context)("particle","")).toEqual([])
 expect(mocks.rpc).not.toHaveBeenCalled()
})


it("keeps uncited generated-note dependencies after its objective and chat have disappeared",async()=>{
 const note=particle(12),current={...context,graph:graph([note])}
 retained=[{id:`particle:${note.id}`,fileIds:[file.id],complete:false}]
 const before=structuredClone(current.graph)
 const record=(await knowledgeLoader(current)("particle","",`particle:${note.id}`))[0]
 expect(record.nativeFileIds).toEqual([file.id])
 const knowledge=createKnowledgeFreshness(context)
 knowledge.observe(record)
 expect(knowledge.dependencies().nativeFileIds).toEqual([file.id])
 allowed=false
 expect(await knowledgeLoader(current)("particle","")).toEqual([])
 expect(current.graph).toEqual(before)
 allowed=true
 expect(await knowledgeLoader(current)("particle","")).toHaveLength(1)
})

it("propagates retained inputs through objective overview and parent plan titles",async()=>{
 const current=filePlanContext()
 // No visible citation or direct widget reference remains.
 const objective=current.graph.particles[0]
 if(objective.type!=="objective")throw new Error("Invalid fixture")
 objective.data.planning!.plans[0].sources=[]
 current.graph.particles=current.graph.particles.filter(item=>item.id!==ID(11))
 retained=[{id:`particle:${ID(12)}`,fileIds:[file.id],complete:false}]
 const authorized=await authorizeResearchFileContext(current)
 expect(createKnowledgeFreshness(authorized).dependencies().nativeFileIds).toEqual([file.id])
 allowed=false
 const denied=await authorizeResearchFileContext(current)
 expect(denied.inaccessibleParticleIds?.has(`particle:${objective.id}`)).toBe(true)
 expect((await knowledgeLoader(current)("particle","")).map(row=>row.id)).toEqual([`particle:${ID(13)}`])
})

it("bounds provenance reads and fails on unavailable, duplicate or foreign records",async()=>{
 const ids=Array.from({length:501},(_,index)=>`particle:${ID(index+1)}`)
 expect((await retainedParticleFiles(WORKSPACE,ID(90),ids)).size).toBe(0)
 expect(mocks.rpc.mock.calls.map(call=>call[1].p_record_ids.length)).toEqual([500,1])
 expect(mocks.rpc).toHaveBeenCalledWith("read_workspace_particle_ai_files",expect.objectContaining({p_org_id:WORKSPACE,p_actor_id:ID(90)}))
 for(const data of [null,[{id:`particle:${ID(900)}`,fileIds:[],complete:false}],[{id:ids[0],fileIds:[],complete:false},{id:ids[0],fileIds:[],complete:false}]]) {
  mocks.rpc.mockResolvedValueOnce({data,error:null})
  await expect(retainedParticleFiles(WORKSPACE,ID(90),ids.slice(0,1))).rejects.toThrow("could not be verified")
 }
 mocks.rpc.mockResolvedValueOnce({data:null,error:{message:"private"}})
 await expect(knowledgeLoader({...context,graph:graph([particle(12)])})("particle","")).rejects.toThrow("could not be verified")
})


it("retains implicit identities across turns and permits ordinary edits while withholding revoked or missing context",async()=>{
 const current=filePlanContext()
 const dependencies=createKnowledgeFreshness(current).dependencies()
 expect(dependencies.contextParticleIds).toEqual([`particle:${ID(1)}`])
 const result:ResearchResult={runId:entry.id,target,responseKind:"answer",title:"Answer",summary:"Derived text",questions:[],sources:[],items:[],dependencies}
 const changed=structuredClone(current.graph)
 changed.particles[0].title="Ordinary rename"
 changed.particles[0].revision++
 await expect(assertResearchSourcesAccessible({...current,graph:changed},result,"history")).resolves.toBeUndefined()
 await expect(assertResearchSourcesAccessible({...current,graph:changed},result,"apply")).rejects.toMatchObject({code:"sources_changed"})
 await expect(assertResearchSourcesAccessible(context,result,"history")).rejects.toMatchObject({code:"sources_changed"})
 allowed=false
 await expect(assertResearchSourcesAccessible(current,result,"history")).rejects.toMatchObject({code:"sources_changed"})
 allowed=true
 expect(mergeConversationDependencies([dependencies,{...dependencies,contextParticleIds:[`particle:${ID(14)}`]}]).contextParticleIds).toEqual([`particle:${ID(1)}`,`particle:${ID(14)}`])
})

it("records only the bounded prompt overview and selected plan identities, including pending proposals",()=>{
 const current=filePlanContext(),objective=current.graph.particles[0]
 if(objective.type!=="objective")throw new Error("Invalid fixture")
 const planning=objective.data.planning!
 planning.plans=Array.from({length:6},(_,i)=>({...planning.plans[0],id:ID(30+i)}))
 planning.proposals=Array.from({length:6},(_,i)=>({id:ID(50+i),title:`Proposal ${i}`,status:"pending" as const,particleIds:[ID(12)],createdAt:entry.createdAt,authorId:ID(90),planId:ID(70+i),baseRevision:null}))
 const selected={...current,objective,target:{organizationId:WORKSPACE,objectiveId:objective.id,revision:0}}
 expect(initialResearchParticleIds(selected)).toEqual([`particle:${objective.id}`,...[30,31,32,33].map(id=>`particle:${objective.id}:plan:${ID(id)}`),...[50,51,52,53].map(id=>`particle:${objective.id}:proposal:${ID(id)}`)])
 const planTarget={...selected,target:{...selected.target,plan:{id:ID(35),revision:0}}}
 expect(createKnowledgeFreshness(planTarget).dependencies().contextParticleIds).toEqual([`particle:${objective.id}`,`particle:${objective.id}:plan:${ID(35)}`,`particle:${ID(11)}`,`particle:${ID(12)}`,...[50,51,52,53].map(id=>`particle:${objective.id}:proposal:${ID(id)}`)])
 const overview={...current,graph:graph(Array.from({length:10},(_,i)=>particle(i+1,"objective"))),inaccessibleParticleIds:new Set([`particle:${ID(1)}`])}
 expect(initialResearchParticleIds(overview)).toEqual(Array.from({length:8},(_,i)=>`particle:${ID(i+2)}`))
})

it("keeps unknown legacy implicit inputs unknown instead of rebuilding them from today's board",()=>{
 const legacy={version:1 as const,contextFingerprint:researchContextFingerprint(context),records:[]}
 expect(mergeConversationDependencies([legacy,legacy])).not.toHaveProperty("contextParticleIds")
 expect(createKnowledgeFreshness(context).dependencies().contextParticleIds).toEqual([])
})


it("keeps reviewed proposal context readable without returning it in search or bypassing file authority",async()=>{
 const current=filePlanContext(),objective=current.graph.particles[0]
 if(objective.type!=="objective")throw new Error("Invalid fixture")
 objective.data.planning!.proposals=[{id:ID(50),planId:ID(30),baseRevision:0,title:"Proposed title",particleIds:[ID(12)],authorId:ID(90),createdAt:entry.createdAt,status:"pending"}]
 const selected={...current,objective,target:{organizationId:WORKSPACE,objectiveId:objective.id,revision:0}}
 const result:ResearchResult={runId:entry.id,target:selected.target,responseKind:"answer",title:"Answer",summary:"Text",questions:[],sources:[],items:[],dependencies:createKnowledgeFreshness(selected).dependencies()}
 objective.data.planning!.proposals[0]={...objective.data.planning!.proposals[0],status:"accepted",reviewedBy:ID(90),reviewedAt:entry.createdAt}
 const id=`particle:${objective.id}:proposal:${ID(50)}`
 expect((await knowledgeLoader(selected)("particle","")).some(record=>record.id===id)).toBe(false)
 await expect(assertResearchSourcesAccessible(selected,result,"history")).resolves.toBeUndefined()
 allowed=false
 await expect(assertResearchSourcesAccessible(selected,result,"history")).rejects.toMatchObject({code:"sources_changed"})
})

const driveSource = { provider: "google_drive", fileId: "drive-document-123", name: "Drive source", webViewLink: "https://docs.google.com/document/d/drive-document-123/edit" }
function coreContext(source: Record<string, unknown>): ResearchContext {
 const profile = { roadmap: { sections: [{ id: "vision", title: "Vision", content: "Editor body", lastUpdated: file.updated_at, ...source }] } }
 return { ...context, supabase: { from: (table: string) => query(table === "organizations" ? { profile, updated_at: file.updated_at } : []) } } as unknown as ResearchContext
}
it.each([
 ["legacy editor", {}, true],
 ["explicit editor with retained Drive", { documentSource: "editor", driveSource }, true],
 ["legacy Drive", { driveSource }, false],
 ["explicit Drive", { documentSource: "google_drive", driveSource }, false],
 ["missing Drive", { documentSource: "google_drive" }, false],
 ["invalid Drive", { documentSource: "google_drive", driveSource: { ...driveSource, webViewLink: "https://example.com/private" } }, false],
] as const)("research search and exact reads respect %s", async (_name, source, available) => {
 const load = knowledgeLoader(coreContext(source))
 for (const id of [undefined, "document:vision"]) {
  const records = await load("document", "", id)
  expect(records.some(record => record.id === "document:vision")).toBe(available)
  expect(JSON.stringify(records).includes("Editor body")).toBe(available)
 }
})
it.each(["history", "apply"] as const)("withholds derived %s after the selected document source changes without a revision change", async purpose => {
 const current = coreContext({ documentSource: "editor", driveSource })
 const record = (await knowledgeLoader(current)("document", "", "document:vision"))[0]
 const result: ResearchResult = { runId: entry.id, target, responseKind: "answer", title: "Derived", summary: "Editor body summary", questions: [], sources: [], items: [], dependencies: { version: 1, contextFingerprint: researchContextFingerprint(current), records: [{ id: record.id, kind: record.kind, fingerprint: knowledgeFingerprint(record) }] } }
 await expect(assertResearchSourcesAccessible(current, result, purpose)).resolves.toBeUndefined()
 await expect(assertResearchSourcesAccessible(coreContext({ documentSource: "google_drive" }), result, purpose)).rejects.toMatchObject({ code: "sources_changed" })
})

it.each(["history", "apply"] as const)("withholds derived %s when a saved document's retained sources cannot be verified", async purpose => {
 const current=coreContext({documentSource:"editor"}),load=knowledgeLoader(current)
 const record=(await load("document","","document:vision"))[0]
 const result: ResearchResult={runId:entry.id,target,responseKind:"answer",title:"Derived",summary:"Editor body summary",questions:[],sources:[],items:[],dependencies:{version:1,contextFingerprint:researchContextFingerprint(current),records:[{id:record.id,kind:record.kind,fingerprint:knowledgeFingerprint(record)}]}}
 await expect(assertResearchSourcesAccessible(current,result,purpose)).resolves.toBeUndefined()
 blockedSections=["vision"]
 expect(await load("document","","document:vision")).toEqual([])
 expect(await load("document","")).toEqual([])
 await expect(assertResearchSourcesAccessible(current,result,purpose)).rejects.toMatchObject({code:"sources_changed"})
 expect(mocks.rpc).toHaveBeenLastCalledWith("filter_workspace_ai_sources",{p_org_id:WORKSPACE,p_canvas_id:"default",p_actor_id:current.user.id,p_file_ids:[],p_section_ids:["vision"]})
 blockedSections=[]
 expect(await load("document","","document:vision")).toEqual([record])
 mocks.rpc.mockResolvedValue({data:null,error:{message:"private failure"}})
 await expect(assertResearchSourcesAccessible(current,result,purpose)).rejects.toMatchObject({code:"verification_unavailable"})
})

it("batches copy checks, preserves source records and rejects malformed or foreign responses",async()=>{
 const sections=Array.from({length:501},(_,i)=>({id:`section-${i}`,content:`body ${i}`}))
 expect(await filterAiDocumentCopies(sections,WORKSPACE,ID(90))).toEqual(sections)
 expect(mocks.rpc.mock.calls.map(call=>call[1].p_section_ids.length)).toEqual([500,1])
 for(const data of [null,{blockedSectionIds:["foreign"],complete:false},{blockedSectionIds:["section-0","section-0"],complete:false},{blockedSectionIds:[],complete:true}]) {
  mocks.rpc.mockResolvedValueOnce({data,error:null})
  await expect(filterAiDocumentCopies(sections,WORKSPACE,ID(90))).rejects.toThrow("could not be verified")
 }
 mocks.rpc.mockClear()
 expect(await filterAiDocumentCopies([],WORKSPACE,ID(90))).toEqual([])
 expect(mocks.rpc).not.toHaveBeenCalled()
})


it.each(["history", "apply"] as const)("prevents organization narrative aliases from bypassing revoked document sources in %s", async purpose => {
 const profile = { name: "Organization", mission: "Private mission copy", vision: "Private vision copy", programs: "Readable programs" }
 const current = { ...context, supabase: { from: () => query({ profile, updated_at: "unchanged" }) } } as unknown as ResearchContext
 const load = knowledgeLoader(current)
 const record = (await load("organization", ""))[0]
 const result: ResearchResult = { runId: entry.id, target, responseKind: "answer", title: "Derived", summary: "Private organization summary", questions: [], sources: [], items: [], dependencies: { version: 1, contextFingerprint: researchContextFingerprint(current), records: [{ id: record.id, kind: record.kind, fingerprint: knowledgeFingerprint(record) }] } }
 await expect(assertResearchSourcesAccessible(current, result, purpose)).resolves.toBeUndefined()
 blockedSections = ["mission_vision_values", "vision"]
 const redacted = await load("organization", "")
 expect(JSON.stringify(redacted)).not.toContain("Private")
 expect(JSON.stringify(redacted)).toContain("Readable programs")
 await expect(assertResearchSourcesAccessible(current, result, purpose)).rejects.toMatchObject({ code: "sources_changed" })
 expect(profile.mission).toBe("Private mission copy")
 blockedSections = []
 expect(await load("organization", "")).toEqual([record])
 mocks.rpc.mockResolvedValue({ data: null, error: { message: "private failure" } })
 await expect(assertResearchSourcesAccessible(current, result, purpose)).rejects.toMatchObject({ code: "verification_unavailable" })
})


it("intersects personal access with chat workspace for discovery, retained particles, history and application", async () => {
 const finance = { ...filePlanContext(), canvasId: ID(80) }
 const comms = { ...finance, canvasId: ID(81) }
 eligibleCanvas = finance.canvasId
 const canonical = JSON.stringify(finance.graph)
 const load = knowledgeLoader(finance)
 const record = (await load("document", "", `file:${file.id}`))[0]
 expect(record).toBeDefined()
 expect(await knowledgeLoader(comms)("document", "")).toEqual([])
 expect(await knowledgeLoader(comms)("document", "", record.id)).toEqual([])
 expect((await knowledgeLoader(comms)("particle", "")).map(row => row.id)).toEqual([`particle:${ID(13)}`])
 const filtered = await authorizeResearchFileContext(comms)
 expect(initialResearchParticleIds(filtered)).toEqual([])
 const result: ResearchResult = { runId: entry.id, target, responseKind: "answer", title: "Private", summary: "Private derived answer", questions: [], sources: [], items: [], dependencies: { version: 1, contextFingerprint: researchContextFingerprint(finance), nativeFileIds: [file.id], records: [{ id: record.id, kind: record.kind, fingerprint: knowledgeFingerprint(record) }] } }
 await expect(assertResearchSourcesAccessible(finance, result)).resolves.toBeUndefined()
 eligibleCanvas = ID(82) // Access remains, but the workspace grant was revoked.
 for (const purpose of ["history", "apply"] as const)
  await expect(assertResearchSourcesAccessible(finance, result, purpose)).rejects.toMatchObject({ code: "sources_changed" })
 expect(JSON.stringify(finance.graph)).toBe(canonical)
})

it("withholds core documents and organization aliases in another chat workspace without changing the profile", async () => {
 const finance = { ...coreContext({}), canvasId: ID(80) }
 const comms = { ...finance, canvasId: ID(81) }
 eligibleCanvas = finance.canvasId
 expect(await knowledgeLoader(finance)("document", "", "document:vision")).toHaveLength(1)
 expect(await knowledgeLoader(comms)("document", "", "document:vision")).toEqual([])
 const profile = { name: "Organization", vision: "Finance only" }
 const organization = { ...comms, supabase: { from: () => query({ profile, updated_at: "same" }) } } as unknown as ResearchContext
 expect(JSON.stringify(await knowledgeLoader(organization)("organization", ""))).not.toContain("Finance only")
 expect(profile.vision).toBe("Finance only")
})


it("fails closed on invalid workspace responses and batches without caching eligibility", async () => {
 const scope = { organizationId: WORKSPACE, canvasId: ID(80) }
 const ids = Array.from({ length: 501 }, (_, i) => ID(i + 1))
 expect(await filterWorkspaceAiSourceIds(ids, "file", ID(90), scope)).toEqual(ids)
 expect(mocks.rpc.mock.calls.map(call => call[1].p_file_ids.length)).toEqual([500, 1])
 for (const data of [null, { fileIds: [ID(9999)], sectionIds: [] }, { fileIds: [ids[0], ids[0]], sectionIds: [] }, { fileIds: [], sectionIds: ["vision"] }]) {
  mocks.rpc.mockResolvedValueOnce({ data, error: null })
  await expect(filterWorkspaceAiSourceIds(ids, "file", ID(90), scope)).rejects.toThrow("could not be verified")
 }
 mocks.rpc.mockResolvedValueOnce({ data: { fileIds: ids.slice(0, 500), sectionIds: [] }, error: null })
  .mockResolvedValueOnce({ data: null, error: { message: "private" } })
 await expect(filterWorkspaceAiSourceIds(ids, "file", ID(90), scope)).rejects.toThrow("could not be verified")
})
