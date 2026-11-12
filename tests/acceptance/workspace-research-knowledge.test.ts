vi.mock("@/lib/organization/document-file-audience",()=>({filterDocumentFileAudience:async (rows:unknown[])=>rows}))
import {beforeEach,describe,it,expect,vi} from "vitest"
vi.mock("@/lib/organization/particle-ai-origins", () => ({ retainedParticleFiles: async () => new Map(), retainedParticleDocuments: async () => new Map() }))
// These reader fixtures have no restricted saved copies. Preserve the real
// projection and provide its service-only transport, not production credentials.
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({
 rpc: async (name: string, args: { p_file_ids: string[]; p_section_ids: string[] }) => {
  if (name === "filter_workspace_ai_sources") return { data: { fileIds: args.p_file_ids, sectionIds: args.p_section_ids }, error: null }
  if (name !== "read_workspace_ai_document_copy_sources") throw new Error(`Unexpected RPC ${name}`)
  return { data: { blockedSectionIds: [], complete: false }, error: null }
 },
}) }))
vi.mock("openai",()=>({default:class { responses={create:mocks.provider} }}))
const mocks=vi.hoisted(()=>({load:vi.fn(),file:vi.fn(),context:vi.fn(),access:vi.fn(),provider:vi.fn()}))
vi.mock("@/features/workspace-ai/server/knowledge-records",async importOriginal=>({...await importOriginal<typeof import("@/features/workspace-ai/server/knowledge-records")>(),knowledgeLoader:()=>mocks.load}))
vi.mock("@/features/workspace-ai/server/knowledge-file",()=>({readKnowledgeFile:mocks.file}))
vi.mock("@/features/workspace-ai/server/research-context",()=>({loadResearchContext:mocks.context}))
vi.mock("@/lib/organization/document-storage-access",()=>({resolveOrganizationDocumentStorageAccess:mocks.access}))
import { knowledgePersonFieldFingerprint, projectKnowledgePerson } from "@/features/workspace-ai/server/knowledge-person"
import { knowledgeFingerprint } from "@/features/workspace-ai/server/research-dependencies"
import {createKnowledgeTools} from "@/features/workspace-ai/server/knowledge-tools"
import type { KnowledgeKind, KnowledgeRecord, ExistingResearchTarget } from "@/features/workspace-ai/research-types"
import type {ResearchContext} from "@/features/workspace-ai/server/research-context"
import {ID,WORKSPACE,graph,particle} from "./fixtures/particle-fixtures"
const context={user:{id:ID(90)},canvasId:null,target:{organizationId:WORKSPACE,objectiveId:ID(1),revision:0},graph:graph(),objective:particle(1,"objective")} as ResearchContext & { target: ExistingResearchTarget }
const record:KnowledgeRecord={id:"person:known",kind:"person",title:"Marketing director",content:"Owns the marketing plan",href:"/workspace",revision:"current",contentAvailable:true,personData:{values:{title:"Owns the marketing plan"},sources:{}}}
beforeEach(()=>{vi.resetAllMocks();mocks.context.mockResolvedValue(context);mocks.access.mockResolvedValue({hasStorageAccess:true});mocks.load.mockResolvedValue([record]);mocks.file.mockImplementation(async(_context,value)=>value)})
describe("workspace knowledge tools",()=>{
 it("reauthorizes repeated searches and withholds unavailable exact references",async()=>{
  const tools=createKnowledgeTools(context)
  await tools.execute("search_workspace",{query:"marketing",kinds:["person"]})
  await tools.execute("search_workspace",{query:"marketing",kinds:["person"]})
  expect(mocks.load).toHaveBeenCalledTimes(2)
  expect(mocks.context).toHaveBeenCalledTimes(2)
  expect(await tools.execute("read_workspace",{ids:["person:other"]})).toMatchObject({results:[{id:"person:other",error:"Contents could not be verified. Retry the read; do not infer their contents."}]})
  expect(mocks.file).not.toHaveBeenCalled()
  await tools.execute("read_workspace",{ids:[record.id]})
  expect(mocks.file).not.toHaveBeenCalled()
  expect(tools.sources.get(record.id)?.revision).toBe("current")
  await createKnowledgeTools(context).execute("search_workspace",{query:"marketing",kinds:["person"]})
  expect(mocks.load).toHaveBeenCalledTimes(5)
 })
 it("keeps failures explicit without discarding accessible sources",async()=>{
  mocks.load.mockImplementation(async kind=>{if(kind==="document")throw Error("denied");return [record]})
  const value=await createKnowledgeTools(context).execute("search_workspace",{query:"marketing",kinds:["person","document"]})
  expect(value).toMatchObject({results:[{id:record.id}],unavailableKinds:["document"]})
 })
 it("rejects arbitrary tools and overlarge retrieval requests",async()=>{
  const tools=createKnowledgeTools(context)
  await expect(tools.execute("send_email",{})).rejects.toThrow(/not available/)
  await expect(tools.execute("read_workspace",{ids:["a","b","c","d","e"]})).rejects.toThrow()
 })
 it("retains available records when another read fails and preserves extraction truncation",async()=>{
  const file={...record,id:"file:known",kind:"document"}, readable={...record,id:"document:known",kind:"document"}
  mocks.load.mockResolvedValue([readable,file])
  mocks.file.mockImplementation(async(_context,value)=>{if(value.id===file.id)throw Error("permission revoked");return {...value,contentTruncated:true}})
  const tools=createKnowledgeTools(context)
  await tools.execute("search_workspace",{query:"marketing",kinds:["document"]})
  expect(await tools.execute("read_workspace",{ids:[readable.id,file.id]})).toMatchObject({results:[{id:readable.id,content:readable.content,truncated:true},{id:file.id,error:expect.any(String)}]})
 })
})

describe("direct authorized workspace reads",()=>{
 it.each([
  ["organization","organization"], ["person","person"], ["document","document"],
  ["file","document"], ["particle","particle"], ["calendar","calendar"], ["opportunity","opportunity"],
 ] as const)("reads a known %s reference without search and retains revalidation evidence",async(prefix,kind)=>{
  const known={...record,id:`${prefix}:${ID(80)}`,kind}
  mocks.load.mockResolvedValue([known])
  const tools=createKnowledgeTools(context)
  expect(await tools.execute("read_workspace",{ids:[known.id,known.id]})).toMatchObject({results:[{id:known.id,content:kind === "person" ? projectKnowledgePerson(known,null).content : known.content,evidence:{coverage:"complete",readAt:expect.any(String)}}]})
  expect(mocks.load).toHaveBeenCalledExactlyOnceWith(kind,"",known.id)
  expect(mocks.file).toHaveBeenCalledTimes(kind === "person" ? 0 : 1)
  expect(tools.sources.get(known.id)?.revision).toBe("current")
  expect(tools.dependencies().records).toEqual([{id:known.id,kind,fingerprint:knowledgeFingerprint(known),...(kind === "person" ? { contactFields:[{field:"title",fingerprint:knowledgePersonFieldFingerprint(known,"title")}] } : {detailFingerprint:knowledgeFingerprint(known)})}])
  mocks.load.mockResolvedValue([])
  expect(await tools.revalidate()).toBe(false)
  expect(await tools.execute("read_workspace",{ids:[known.id]})).toMatchObject({results:[{id:known.id,error:expect.any(String)}]})
  expect(mocks.file).toHaveBeenCalledTimes(kind === "person" ? 0 : 1)
 })

 it("makes missing, denied, wrong-ID and wrong-kind results indistinguishable",async()=>{
  const id=`person:${ID(80)}`
  const results: unknown[]=[]
  for(const outcome of [[],[{...record,id:`person:${ID(81)}`}],[{...record,id,kind:"organization"}],new Error("Private provider detail")]) {
   if(outcome instanceof Error)mocks.load.mockRejectedValue(outcome)
   else mocks.load.mockResolvedValue(outcome)
   const tools=createKnowledgeTools(context)
   results.push(await tools.execute("read_workspace",{ids:[id]}))
   expect(tools.sources.size).toBe(0)
   expect(tools.dependencies().records).toEqual([])
  }
  expect(results.every(result=>JSON.stringify(result)===JSON.stringify(results[0]))).toBe(true)
  expect(results[0]).toMatchObject({results:[{id,error:"Contents could not be verified. Retry the read; do not infer their contents."}]})
  expect(mocks.file).not.toHaveBeenCalled()
 })

 it("never dispatches URL, path, unknown or prototype-property references",async()=>{
  const tools=createKnowledgeTools(context)
  for(const id of ["https://example.org/private","/private/file","unknown:123","constructor:123","__proto__:123","person:","person"]) {
   expect(await tools.execute("read_workspace",{ids:[id]})).toMatchObject({results:[{id,error:expect.any(String)}]})
  }
  expect(mocks.load).not.toHaveBeenCalled()
  expect(mocks.file).not.toHaveBeenCalled()
 })

 it("does not extract or retain a direct read that finishes after cancellation",async()=>{
  const controller=new AbortController(),known={...record,id:`person:${ID(80)}`}
  mocks.load.mockImplementation(async()=>{controller.abort();return [known]})
  const tools=createKnowledgeTools(context,controller.signal)
  await expect(tools.execute("read_workspace",{ids:[known.id]})).rejects.toThrow()
  expect(mocks.file).not.toHaveBeenCalled()
  expect(tools.sources.size).toBe(0)
  expect(tools.dependencies().records).toEqual([])
 })

 it("uses the actual organization, canvas and document entitlement boundaries",async()=>{
  const {knowledgeLoader,readKnowledgeRecord}=await vi.importActual<typeof import("@/features/workspace-ai/server/knowledge-records")>("@/features/workspace-ai/server/knowledge-records")
  const query={select:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),abortSignal:vi.fn().mockReturnThis(),maybeSingle:vi.fn().mockResolvedValue({data:{profile:{name:"Our organization",org_people:[{id:ID(80),name:"Our contact"}]},updated_at:"current"},error:null})}
  const current={...context,supabase:{from:()=>query}} as unknown as ResearchContext
  const load=knowledgeLoader(current)
  for(const [id,kind] of [[`organization:${WORKSPACE}`,"organization"],[`person:${ID(80)}`,"person"],[`particle:${ID(1)}`,"particle"]] as [string,KnowledgeKind][]) {
   expect(await readKnowledgeRecord(load,id)).toMatchObject({id,kind})
  }
  for(const prefix of ["organization","person","particle"])expect(await readKnowledgeRecord(load,`${prefix}:${ID(99)}`)).toBeUndefined()
  expect(query.eq).toHaveBeenCalledWith("user_id",WORKSPACE)
  mocks.access.mockResolvedValue({hasStorageAccess:false})
  expect(await readKnowledgeRecord(load,`file:${ID(80)}`)).toBeUndefined()
  expect(await readKnowledgeRecord(load,"document:vision")).toBeUndefined()
 })
})

it("reads selected-plan members without rediscovery and binds only used baseline evidence",async()=>{
 const objective=particle(1,"objective"), member=particle(2), other=particle(3)
 if(objective.type!=="objective")throw Error()
 member.description="Existing implementation detail"
 objective.data.planning={plans:[{id:ID(50),revision:0,title:"Accepted plan",particleIds:[member.id]}],proposals:[]}
 const selected={...context,objective,graph:graph([objective,member,other]),target:{...context.target,plan:{id:ID(50),revision:0}}}
 mocks.context.mockResolvedValue(selected)
 mocks.load.mockResolvedValue([{id:`particle:${member.id}`,kind:"particle",title:member.title,content:member.description,href:"/workspace",revision:"0",contentAvailable:true}])
 const tools=createKnowledgeTools(selected)
 expect(tools.sources.size).toBe(0)
 expect(await tools.execute("read_workspace",{ids:[`particle:${member.id}`]})).toMatchObject({results:[{content:"Existing implementation detail",revision:"0"}]})
 expect(mocks.load).toHaveBeenCalledWith("particle","",`particle:${member.id}`)
 expect(await tools.execute("read_workspace",{ids:[`particle:${other.id}`]})).toMatchObject({results:[{error:"Contents could not be verified. Retry the read; do not infer their contents."}]})
 expect(tools.evidence([`particle:${member.id}`])).toMatchObject([{id:`particle:${member.id}`,revision:"0"}])
})


it("withholds changed or revoked records instead of replaying cached private content",async()=>{
 const tools=createKnowledgeTools(context)
 await tools.execute("search_workspace",{query:"marketing",kinds:["person"]})
 await tools.execute("read_workspace",{ids:[record.id]})
 mocks.load.mockResolvedValue([{...record,revision:"new",content:"Changed private content"}])
 expect(await tools.execute("read_workspace",{ids:[record.id]})).toMatchObject({results:[{id:record.id,status:"changed",recovery:"restart_research",error:expect.any(String)}]})
 expect(await tools.revalidate()).toBe(false)
 mocks.load.mockResolvedValue([])
 expect(await tools.execute("read_workspace",{ids:[record.id]})).toMatchObject({results:[{id:record.id,status:"unavailable",recovery:"retry_read"}]})
 expect(await tools.revalidate()).toBe(false)
 expect(mocks.file).not.toHaveBeenCalled()
})
it("does not let repeat searches overwrite evidence already disclosed to the model",async()=>{
 const tools=createKnowledgeTools(context)
 await tools.execute("search_workspace",{query:"marketing",kinds:["person"]})
 mocks.load.mockResolvedValue([{...record,content:"Changed without updating the revision"}])
 await expect(tools.execute("search_workspace",{query:"marketing",kinds:["person"]})).rejects.toThrow(/context/)
 expect(await tools.revalidate()).toBe(false)
})
it("fails closed when actor, canvas or editing access changes",async()=>{
 const tools=createKnowledgeTools(context)
 await tools.execute("search_workspace",{query:"marketing",kinds:["person"]})
 for(const changed of [{...context,user:{id:ID(91)}},{...context,canvasId:ID(92)}]) {
  mocks.context.mockResolvedValue(changed)
  expect(await tools.revalidate()).toBe(false)
  await expect(tools.execute("read_workspace",{ids:[record.id]})).rejects.toThrow(/context/)
 }
 mocks.context.mockRejectedValue(Error("Access denied"))
 expect(await tools.revalidate()).toBe(false)
 expect(mocks.file).not.toHaveBeenCalled()
})
it("stops aborted checks before another source lookup",async()=>{
 const controller=new AbortController(),tools=createKnowledgeTools(context,controller.signal)
 controller.abort()
 expect(await tools.revalidate()).toBe(false)
 expect(mocks.context).not.toHaveBeenCalled();expect(mocks.load).not.toHaveBeenCalled()
})
it("rechecks selected-plan members even if the model never explicitly reads them",async()=>{
 const objective=particle(1,"objective"),member=particle(2)
 if(objective.type!=="objective")throw Error()
 objective.data.planning={plans:[{id:ID(50),revision:0,title:"Plan",particleIds:[member.id]}],proposals:[]}
 const selected={...context,objective,graph:graph([objective,member]),target:{...context.target,plan:{id:ID(50),revision:0}}}
 mocks.context.mockResolvedValue(selected);mocks.load.mockResolvedValue([])
 expect(await createKnowledgeTools(selected).revalidate()).toBe(false)
})


it("looks up discovered file, event and opportunity IDs directly inside the organization",async()=>{
 const {knowledgeLoader}=await vi.importActual<typeof import("@/features/workspace-ai/server/knowledge-records")>("@/features/workspace-ai/server/knowledge-records")
 for(const [kind,prefix,table] of [["document","file","organization_document_files"],["calendar","calendar","roadmap_calendar_internal_events"],["opportunity","opportunity","organization_finance_opportunities"]] as const) {
  const query={select:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),is:vi.fn().mockReturnThis(),neq:vi.fn().mockReturnThis(),ilike:vi.fn().mockReturnThis(),order:vi.fn().mockReturnThis(),limit:vi.fn().mockReturnThis(),abortSignal:vi.fn().mockReturnThis(),then:vi.fn((resolve: (value:unknown)=>unknown)=>resolve({data:[],error:null})),maybeSingle:vi.fn().mockResolvedValue({data:{profile:{},updated_at:"current"},error:null})}
  const from=vi.fn(()=>query),current={...context,supabase:{from}} as unknown as ResearchContext
  await knowledgeLoader(current)(kind,"",`${prefix}:${ID(80)}`)
  expect(from).toHaveBeenCalledWith(table)
  expect(query.eq).toHaveBeenCalledWith("org_id",WORKSPACE)
  expect(query.eq).toHaveBeenCalledWith("id",ID(80))
  expect(query.limit).toHaveBeenCalledWith(1)
  expect(query.ilike).not.toHaveBeenCalled()
  if(kind==="document") {expect(query.is).toHaveBeenCalledWith("deleted_at",null);expect(query.is).toHaveBeenCalledWith("document_kind",null)}
  if(kind==="opportunity") expect(query.neq).toHaveBeenCalledWith("status","dismissed")
 }
})
it("coalesces profile reads inside one check, but uses a fresh profile for the next check",async()=>{
 const {knowledgeLoader}=await vi.importActual<typeof import("@/features/workspace-ai/server/knowledge-records")>("@/features/workspace-ai/server/knowledge-records")
 const single=vi.fn().mockResolvedValue({data:{profile:{name:"Organization"},updated_at:"first"},error:null})
 const query={select:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),abortSignal:vi.fn().mockReturnThis(),maybeSingle:single}
 const current={...context,supabase:{from:()=>query}} as unknown as ResearchContext
 const load=knowledgeLoader(current)
 await Promise.all([load("organization",""),load("person","")])
 expect(single).toHaveBeenCalledTimes(1)
 single.mockResolvedValue({data:{profile:{name:"Updated"},updated_at:"second"},error:null})
 expect(await knowledgeLoader(current)("organization","")).toMatchObject([{title:"Updated",revision:"second"}])
 expect(single).toHaveBeenCalledTimes(2)
})

it("keeps contact search to names and roles, then reads selected contact details",async()=>{
 const {knowledgeLoader}=await vi.importActual<typeof import("@/features/workspace-ai/server/knowledge-records")>("@/features/workspace-ai/server/knowledge-records")
 const query={select:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),abortSignal:vi.fn().mockReturnThis(),maybeSingle:vi.fn().mockResolvedValue({data:{profile:{org_people:[{id:ID(80),name:"Jordan",title:"Marketing director",email:"private@example.org",phone:"555-0100",notes:"Confidential background"}]},updated_at:"current"},error:null})}
 const current={...context,supabase:{from:()=>query}} as unknown as ResearchContext
 const records=await knowledgeLoader(current)("person","marketing")
 mocks.load.mockResolvedValue(records)
 const tools=createKnowledgeTools(context)
 const search=await tools.execute("search_workspace",{query:"marketing",kinds:["person"]})
 expect(search).toMatchObject({results:[{content:"Marketing director",evidence:{coverage:"excerpt",readAt:null}}]})
 expect(JSON.stringify(search)).not.toMatch(/private@example|555-0100|Confidential|searchContent/)
 expect(await tools.execute("search_workspace",{query:"Confidential",kinds:["person"]})).toMatchObject({results:[]})
 const read=await tools.execute("read_workspace",{ids:[records[0].id],personFields:["email"]})
 expect(JSON.stringify(read)).toContain("private@example.org")
 expect(read).toMatchObject({results:[{evidence:{coverage:"complete",scope:"record",readAt:expect.any(String)}}]})
})

it("deduplicates reads and preserves read coverage through later searches and citation binding",async()=>{
 const tools=createKnowledgeTools(context)
 await tools.execute("search_workspace",{query:"marketing",kinds:["person"]})
 expect(tools.sources.get(record.id)?.evidence).toMatchObject({coverage:"excerpt",readAt:null})
 await tools.execute("read_workspace",{ids:[record.id,record.id]})
 expect(mocks.file).not.toHaveBeenCalled()
 const source=structuredClone(tools.sources.get(record.id))
 expect(source?.evidence).toMatchObject({coverage:"complete",characters:projectKnowledgePerson(record,null).content.length,readAt:expect.any(String)})
 await tools.execute("search_workspace",{query:"marketing",kinds:["person"]})
 expect(tools.evidence([record.id])).toEqual([source])
})

it("marks metadata-only and unsupported file reads without inventing body evidence",async()=>{
 const file={...record,id:"file:known",kind:"document",contentAvailable:false,content:"File metadata only"}
 mocks.load.mockResolvedValue([file])
 const tools=createKnowledgeTools(context)
 expect(await tools.execute("search_workspace",{query:"marketing",kinds:["document"]})).toMatchObject({results:[{evidence:{coverage:"metadata_only",characters:0,readAt:null}}]})
 expect(await tools.execute("read_workspace",{ids:[file.id]})).toMatchObject({results:[{evidence:{coverage:"unavailable",characters:0,readAt:expect.any(String)}}]})
 // A failed extraction does not upgrade the earlier metadata citation to body evidence.
 expect(tools.evidence([file.id])[0].evidence?.coverage).toBe("unavailable")
})


describe("server-owned research dependency capture",()=>{
 it("retains uncited search inputs separately from visible citations without storing their text",async()=>{
  const tools=createKnowledgeTools(context)
  await tools.execute("search_workspace",{query:"marketing",kinds:["person"]})
  const manifest=tools.dependencies()
  expect(manifest.records).toEqual([{id:record.id,kind:"person",fingerprint:knowledgeFingerprint({...record,kind:"person"})}])
  expect(JSON.stringify(manifest)).not.toContain(record.content)
  expect(JSON.stringify(manifest)).not.toContain(record.title)
  expect(manifest.contextFingerprint).toMatch(/^[a-f0-9]{64}$/)
 })
 it("retains extracted file fingerprints after later metadata searches",async()=>{
  const file={...record,id:`file:${ID(70)}`,kind:"document" as const,contentAvailable:false}
  const detail={...file,content:"Private extracted body",contentAvailable:true}
  mocks.load.mockResolvedValue([file]);mocks.file.mockResolvedValue(detail)
  const tools=createKnowledgeTools(context)
  await tools.execute("search_workspace",{query:"marketing",kinds:["document"]})
  await tools.execute("read_workspace",{ids:[file.id]})
  await tools.execute("search_workspace",{query:"marketing",kinds:["document"]})
  expect(tools.dependencies().records).toEqual([{id:file.id,kind:"document",fingerprint:knowledgeFingerprint(file),detailFingerprint:knowledgeFingerprint(detail)}])
 })
 it("captures uncited selected members and rejects initial-context changes without revision changes",async()=>{
  const objective=particle(1,"objective"),member=particle(2)
  if(objective.type!=="objective")throw Error()
  objective.data.planning={plans:[{id:ID(50),revision:0,title:"Existing",particleIds:[member.id]}],proposals:[]}
  const initial={...context,objective,graph:graph([objective,member]),target:{...context.target,plan:{id:ID(50),revision:0}}}
  const tools=createKnowledgeTools(initial)
  expect(tools.dependencies().records.map(item=>item.id)).toEqual([`particle:${member.id}`])
  mocks.context.mockResolvedValue({...initial,objective:{...objective,description:"Changed purpose"}})
  expect(await tools.revalidate()).toBe(false)
  expect(mocks.load).not.toHaveBeenCalled()
 })
})


describe("native document ranges and board-readiness coverage", () => {
 const native = (content: string, patch: Partial<KnowledgeRecord> = {}): KnowledgeRecord => ({
  id: "document:board-records", kind: "document", title: "Synthetic board records", href: "/workspace",
  revision: "2026-11-11", content, contentAvailable: true, ...patch,
 })
 const readRange = (id: string, start: number, end: number) => ({ ids: [id], documentRanges: [{ id, start, end }] })
 it("reads late dated evidence and separate governance sections without claiming whole-document review", async () => {
  const mission = "Mission: youth education. Strategy: expand tutoring. Governance: quorum is three."
  const dated = "2026-11-12 proposed agenda: consider expansion; not approved minutes. October actuals absent."
  const document = native(mission.padEnd(12000, " ") + dated)
  mocks.load.mockResolvedValue([document])
  const tools = createKnowledgeTools(context)
  const early = await tools.execute("read_workspace", readRange(document.id, 0, mission.length))
  const late = await tools.execute("read_workspace", readRange(document.id, 12000, 12000 + dated.length))
  expect(early).toMatchObject({ results: [{ content: mission, evidence: { coverage: "excerpt" } }] })
  expect(late).toMatchObject({ results: [{ content: dated, revision: document.revision,
   evidence: { location: { kind: "reader_text", start: 12000, end: document.content.length },
    textCoverage: { complete: false, totalCharacters: document.content.length } } }] })
  expect(tools.sources.get(document.id)?.evidence).toMatchObject({ coverage: "excerpt", characters: mission.length + dated.length,
   textCoverage: { complete: false, ranges: [{ start: 0, end: mission.length }, { start: 12000, end: document.content.length }] } })
  expect(tools.dependencies().records).toEqual([{ id: document.id, kind: "document",
   fingerprint: knowledgeFingerprint(document), detailFingerprint: knowledgeFingerprint(document) }])
  expect(await tools.revalidate()).toBe(true)
 })
 it("merges overlaps without double counting and marks complete only after every gap is read", async () => {
  const document = native("x".repeat(9000)); mocks.load.mockResolvedValue([document])
  const tools = createKnowledgeTools(context)
  for (const [start,end] of [[0,3000],[6000,9000],[2000,4000],[2000,4000]]) await tools.execute("read_workspace", readRange(document.id,start,end))
  expect(tools.sources.get(document.id)?.evidence).toMatchObject({ characters: 7000, coverage: "excerpt", textCoverage: { complete: false } })
  await tools.execute("search_workspace", { query: "Synthetic", kinds: ["document"] })
  expect(tools.sources.get(document.id)?.evidence?.characters).toBe(7000)
  await tools.execute("read_workspace",readRange(document.id,4000,6000))
  expect(tools.sources.get(document.id)?.evidence).toMatchObject({ characters: 9000, coverage: "complete",
   textCoverage: { complete: true, ranges: [{ start: 0, end: 9000 }] } })
  expect(tools.sources.get(document.id)?.evidence).not.toHaveProperty("location")
 })
 it("keeps multiple requested sources inside the shared text budget and preserves normalized Unicode offsets", async () => {
  const documents = [native("a".repeat(7000)+"😀".repeat(1000)), native("b".repeat(9000),{id:"document:governance"})]
  mocks.load.mockResolvedValue(documents)
  const value = await createKnowledgeTools(context).execute("read_workspace", {
   ids: documents.map(item=>item.id), documentRanges: documents.map(item=>({id:item.id,start:7000,end:9000})),
  }, 3000)
  expect(value).toMatchObject({ results: documents.map(item=>({ id:item.id, content:item.content.slice(7000,8500),
   evidence:{characters:1500,location:{start:7000,end:8500},textCoverage:{complete:false}} })) })
 })
 it.each([25000,null])("reports the reader ceiling and never claims complete for total %s", async total => {
  const document = native("x".repeat(20000),{contentTruncated:true,...(total === null ? {} : {nativeTextLength:total})})
  mocks.load.mockResolvedValue([document]); const tools=createKnowledgeTools(context)
  for (let start=0;start<20000;start+=5000) await tools.execute("read_workspace",readRange(document.id,start,start+5000))
  expect(tools.sources.get(document.id)?.evidence).toMatchObject({characters:20000,coverage:"excerpt",
   textCoverage:{totalCharacters:total,availableCharacters:20000,complete:false,ranges:[{start:0,end:20000}]}})
 })
 it("reads beyond 20,000 with exact accumulated coverage and unchanged per-call budgets",async()=>{
  const document=native("x".repeat(120000),{nativeTextLength:240000,contentTruncated:true})
  mocks.load.mockResolvedValue([document]);const tools=createKnowledgeTools(context)
  for(const start of [60000,66000,72000,78000]){
   const result=await tools.execute("read_workspace",readRange(document.id,start,start+6000))
   expect(result).toMatchObject({results:[{content:"x".repeat(6000),evidence:{location:{start,end:start+6000}}}]})
  }
  expect(tools.sources.get(document.id)?.evidence).toMatchObject({characters:24000,coverage:"excerpt",textCoverage:{
   totalCharacters:240000,availableCharacters:120000,complete:false,ranges:[{start:60000,end:84000}]}})
 })
 it("returns explicit exhausted coverage rather than an empty successful read", async () => {
  const document=native("short");mocks.load.mockResolvedValue([document])
  expect(await createKnowledgeTools(context).execute("read_workspace",readRange(document.id,10,20))).toMatchObject({results:[{
   contentAvailable:false,status:"exhausted_budget",evidence:{coverage:"unavailable",characters:0,textCoverage:{complete:false,ranges:[],availableCharacters:5}},
  }]})
 })
 it.each(["changed","revoked"])("withholds a later range and invalidates dependencies when the source is %s",async failure=>{
  const document=native("x".repeat(10000));mocks.load.mockResolvedValue([document]);const tools=createKnowledgeTools(context)
  await tools.execute("read_workspace",readRange(document.id,0,100))
  mocks.load.mockResolvedValue(failure==="changed"?[{...document,revision:"new",content:"private changed evidence"}]:[])
  const result=await tools.execute("read_workspace",readRange(document.id,9000,9100))
  expect(result).toMatchObject({results:[{id:document.id,status:failure==="changed"?"changed":"unavailable"}]})
  expect(JSON.stringify(result)).not.toContain("private changed evidence")
  expect(await tools.revalidate()).toBe(false)
 })
 it("checks native content past the reader ceiling in retained dependency fingerprints",async()=>{
  const {knowledgeLoader}=await vi.importActual<typeof import("@/features/workspace-ai/server/knowledge-records")>("@/features/workspace-ai/server/knowledge-records")
  const {resolveRoadmapSections}=await import("@/lib/roadmap/sections")
  const sections=resolveRoadmapSections({})
  expect(sections.length).toBeGreaterThan(0)
  const section=sections[0]
  const load=async (suffix:string,prefix="a".repeat(220000))=>{
   const profile={roadmap:{sections:[{...section,content:"<p>"+prefix+suffix+"</p>"}]}}
   const query={select:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),abortSignal:vi.fn().mockReturnThis(),maybeSingle:vi.fn().mockResolvedValue({data:{profile,updated_at:"same"},error:null})}
   return knowledgeLoader({...context,supabase:{from:()=>query}} as unknown as ResearchContext)("document","",`document:${section.id}`)
  }
  const first=await load("old"), next=await load("new")
  expect(first).toHaveLength(1);expect(next).toHaveLength(1)
  expect(first[0].content).toHaveLength(200000)
  expect(first[0].nativeTextLength).toBe(220003)
  expect(first[0].content).toBe(next[0].content)
  expect(knowledgeFingerprint(first[0])).not.toBe(knowledgeFingerprint(next[0]))
  const unicode=await load("😀ending","a".repeat(199999))
  expect(unicode[0].content).toHaveLength(199999)
  expect(unicode[0].nativeTextLength).toBe(200007)
  expect(unicode[0].contentTruncated).toBe(true)
  const {knowledgeDisclosure}=await import("@/features/workspace-ai/server/knowledge-evidence")
  expect(knowledgeDisclosure(unicode[0],"read",6000,{start:199999,end:200000})).toMatchObject({
   status:"exhausted_budget",evidence:{textCoverage:{availableCharacters:199999,totalCharacters:200007,complete:false}}})
 })
})


it("completes a controlled board-readiness range-to-answer turn through the actual tool and evidence owners", async () => {
 const {runResearchProvider}=await import("@/features/workspace-ai/server/research-provider")
 const mission="Mission: youth education. Governance: quorum three."
 const dated="November 12 agenda proposes expansion; no vote recorded. October actuals are missing."
 const document:KnowledgeRecord={id:"document:board",kind:"document",title:"Synthetic board packet",href:"/workspace",revision:"2026-11-11",content:mission.padEnd(12000," ")+dated,contentAvailable:true}
 mocks.load.mockResolvedValue([document]);const tools=createKnowledgeTools(context)
 const response=(id:string,output:unknown[]) => (async function*(){yield {type:"response.completed",response:{id,status:"completed",output,usage:{input_tokens:100,output_tokens:20,input_tokens_details:{cached_tokens:0}}}}})()
 const call=(round:number,start:number,end:number)=>response(`r${round}`,[{type:"function_call",id:`t${round}`,call_id:`c${round}`,name:"read_workspace",arguments:JSON.stringify({ids:[document.id],personFields:null,documentRanges:[{id:document.id,start,end}]})}])
 mocks.provider.mockImplementationOnce(()=>call(1,0,mission.length)).mockImplementationOnce(()=>call(2,12000,document.content.length))
 const summary="Expansion is proposed, not approved. Quorum is three. October actuals and full packet review remain missing."
 mocks.provider.mockImplementationOnce(()=>response("answer",[{type:"message",role:"assistant",status:"completed",content:[{type:"output_text",text:JSON.stringify({responseKind:"answer",answerEvidenceIds:[document.id],title:"Board readiness",summary,questions:[],unfulfilled:["October actuals","Unread packet sections"],decisions:[],removeReferences:[],items:[]})}]}]))
 const result=await runResearchProvider({context,preparedContext:{tools,records:[]},request:{id:ID(91),parentRunId:ID(92),target:context.target,prompt:"Assess readiness for the November 12 board meeting",skill:"planning",tariffVersion:"fixture",maximumCredits:20},
  config:{tariff:{version:"fixture",model:"fixture",inputMicrodollarsPerMillion:1,cachedMicrodollarsPerMillion:0,outputMicrodollarsPerMillion:1,microdollarsPerCredit:2000},maxSearchCalls:0,maxRounds:3,maxOutputTokens:1500,maxInputBytes:20000,maxCredits:20,maxCost:40000},onResponse:async()=>{},isCanceled:async()=>false})
 expect(mocks.provider).toHaveBeenCalledTimes(3)
 expect(result.result).toMatchObject({responseKind:"answer",summary,unfulfilled:["October actuals","Unread packet sections"],sources:[{id:document.id,revision:document.revision,evidence:{coverage:"excerpt",textCoverage:{complete:false,ranges:[{start:0,end:mission.length},{start:12000,end:document.content.length}]}}}]})
 expect(JSON.stringify(mocks.provider.mock.calls[2][0].input)).toContain(dated)
 expect(result.result?.dependencies?.records[0].fingerprint).toBe(knowledgeFingerprint(document))
 for(const [params] of mocks.provider.mock.calls) expect(Buffer.byteLength(JSON.stringify(params))).toBeLessThanOrEqual(20000)
 expect(result.usage).toMatchObject({input:300,output:60,webSearchCalls:0})
 expect(result.usage.embeddingInput).toBeUndefined()
})

it("pages canonical uploaded metadata with stable server-only keysets and unchanged access filters",async()=>{
 const {knowledgeLoader}=await vi.importActual<typeof import("@/features/workspace-ai/server/knowledge-records")>("@/features/workspace-ai/server/knowledge-records")
 const rows=Array.from({length:20},(_,i)=>({id:ID(100+i),name:`Packet ${i}`,mime_type:"text/plain",size_bytes:20,updated_at:"2026-11-11T12:00:00.000Z"}))
 const query={select:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),is:vi.fn().mockReturnThis(),ilike:vi.fn().mockReturnThis(),or:vi.fn().mockReturnThis(),order:vi.fn().mockReturnThis(),limit:vi.fn().mockReturnThis(),abortSignal:vi.fn().mockReturnThis(),then:vi.fn((resolve:(value:unknown)=>unknown)=>resolve({data:rows,error:null})),maybeSingle:vi.fn().mockResolvedValue({data:{profile:{},updated_at:"current"},error:null})}
 const from=vi.fn(()=>query),current={...context,supabase:{from}} as unknown as ResearchContext,next=vi.fn()
 const after={id:ID(99),updatedAt:"2026-11-12T12:00:00.000Z"}
 const result=await knowledgeLoader(current)("document","governance",undefined,{after,next})
 expect(result).toHaveLength(20)
 expect(query.eq).toHaveBeenCalledWith("org_id",WORKSPACE)
 expect(query.is).toHaveBeenCalledWith("deleted_at",null);expect(query.is).toHaveBeenCalledWith("document_kind",null)
 expect(query.order.mock.calls).toEqual([["updated_at",{ascending:false}],["id",{ascending:false}]])
 expect(query.limit).toHaveBeenCalledWith(20)
 expect(query.or).toHaveBeenCalledWith(`updated_at.lt.${after.updatedAt},and(updated_at.eq.${after.updatedAt},id.lt.${after.id})`)
 expect(next).toHaveBeenCalledWith({id:rows[19].id,updatedAt:rows[19].updated_at})
 expect(JSON.stringify(result)).not.toMatch(/storage_path|after|nextPage/)
 await expect(knowledgeLoader(current)("document","",undefined,{after:{...after,id:"x),org_id.neq.any"},next})).rejects.toThrow()
 await expect(knowledgeLoader(current)("document","",undefined,{after:{...after,updatedAt:"now),org_id.neq.any"},next})).rejects.toThrow()
 rows.pop();next.mockClear()
 await knowledgeLoader(current)("document","",undefined,{next})
 expect(next).toHaveBeenCalledWith(null)
})
