import {beforeEach,describe,it,expect,vi} from "vitest"
const mocks=vi.hoisted(()=>({load:vi.fn(),file:vi.fn(),context:vi.fn(),access:vi.fn()}))
vi.mock("@/features/workspace-ai/server/knowledge-records",async importOriginal=>({...await importOriginal<typeof import("@/features/workspace-ai/server/knowledge-records")>(),knowledgeLoader:()=>mocks.load}))
vi.mock("@/features/workspace-ai/server/knowledge-file",()=>({readKnowledgeFile:mocks.file}))
vi.mock("@/features/workspace-ai/server/research-context",()=>({loadResearchContext:mocks.context}))
vi.mock("@/lib/organization/document-storage-access",()=>({resolveOrganizationDocumentStorageAccess:mocks.access}))
import { knowledgeFingerprint } from "@/features/workspace-ai/server/research-dependencies"
import {createKnowledgeTools} from "@/features/workspace-ai/server/knowledge-tools"
import type { KnowledgeKind, ExistingResearchTarget } from "@/features/workspace-ai/research-types"
import type {ResearchContext} from "@/features/workspace-ai/server/research-context"
import {ID,WORKSPACE,graph,particle} from "./fixtures/particle-fixtures"
const context={user:{id:ID(90)},canvasId:null,target:{organizationId:WORKSPACE,objectiveId:ID(1),revision:0},graph:graph(),objective:particle(1,"objective")} as ResearchContext & { target: ExistingResearchTarget }
const record={id:"person:known",kind:"person",title:"Marketing director",content:"Owns the marketing plan",href:"/workspace",revision:"current",contentAvailable:true}
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
  expect(mocks.file).toHaveBeenCalledTimes(1)
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
  const file={...record,id:"file:known",kind:"document"}
  mocks.load.mockResolvedValue([record,file])
  mocks.file.mockImplementation(async(_context,value)=>{if(value.id===file.id)throw Error("permission revoked");return {...value,contentTruncated:true}})
  const tools=createKnowledgeTools(context)
  await tools.execute("search_workspace",{query:"marketing",kinds:["person","document"]})
  expect(await tools.execute("read_workspace",{ids:[record.id,file.id]})).toMatchObject({results:[{id:record.id,content:record.content,truncated:true},{id:file.id,error:expect.any(String)}]})
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
  expect(await tools.execute("read_workspace",{ids:[known.id,known.id]})).toMatchObject({results:[{id:known.id,content:known.content,evidence:{coverage:"complete",readAt:expect.any(String)}}]})
  expect(mocks.load).toHaveBeenCalledExactlyOnceWith(kind,"",known.id)
  expect(mocks.file).toHaveBeenCalledTimes(1)
  expect(tools.sources.get(known.id)?.revision).toBe("current")
  expect(tools.dependencies().records).toEqual([{id:known.id,kind,fingerprint:knowledgeFingerprint(known),detailFingerprint:knowledgeFingerprint(known)}])
  mocks.load.mockResolvedValue([])
  expect(await tools.revalidate()).toBe(false)
  expect(await tools.execute("read_workspace",{ids:[known.id]})).toMatchObject({results:[{id:known.id,error:expect.any(String)}]})
  expect(mocks.file).toHaveBeenCalledTimes(1)
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
  const query={select:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),abortSignal:vi.fn().mockReturnThis(),single:vi.fn().mockResolvedValue({data:{profile:{name:"Our organization",org_people:[{id:ID(80),name:"Our contact"}]},updated_at:"current"},error:null})}
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
 expect(mocks.file).toHaveBeenCalledTimes(1)
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
  const query={select:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),is:vi.fn().mockReturnThis(),neq:vi.fn().mockReturnThis(),ilike:vi.fn().mockReturnThis(),order:vi.fn().mockReturnThis(),limit:vi.fn().mockReturnThis(),abortSignal:vi.fn().mockReturnThis(),then:vi.fn((resolve: (value:unknown)=>unknown)=>resolve({data:[],error:null})),single:vi.fn().mockResolvedValue({data:{profile:{},updated_at:"current"},error:null})}
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
 const query={select:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),abortSignal:vi.fn().mockReturnThis(),single}
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
 const query={select:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),abortSignal:vi.fn().mockReturnThis(),single:vi.fn().mockResolvedValue({data:{profile:{org_people:[{id:ID(80),name:"Jordan",title:"Marketing director",email:"private@example.org",phone:"555-0100",notes:"Confidential background"}]},updated_at:"current"},error:null})}
 const current={...context,supabase:{from:()=>query}} as unknown as ResearchContext
 const records=await knowledgeLoader(current)("person","marketing")
 mocks.load.mockResolvedValue(records)
 const tools=createKnowledgeTools(context)
 const search=await tools.execute("search_workspace",{query:"marketing",kinds:["person"]})
 expect(search).toMatchObject({results:[{content:"Marketing director",evidence:{coverage:"excerpt",readAt:null}}]})
 expect(JSON.stringify(search)).not.toMatch(/private@example|555-0100|Confidential|searchContent/)
 expect(await tools.execute("search_workspace",{query:"Confidential",kinds:["person"]})).toMatchObject({results:[]})
 const read=await tools.execute("read_workspace",{ids:[records[0].id]})
 expect(JSON.stringify(read)).toContain("private@example.org")
 expect(read).toMatchObject({results:[{evidence:{coverage:"complete",scope:"record",readAt:expect.any(String)}}]})
})

it("deduplicates reads and preserves read coverage through later searches and citation binding",async()=>{
 const tools=createKnowledgeTools(context)
 await tools.execute("search_workspace",{query:"marketing",kinds:["person"]})
 expect(tools.sources.get(record.id)?.evidence).toMatchObject({coverage:"excerpt",readAt:null})
 await tools.execute("read_workspace",{ids:[record.id,record.id]})
 expect(mocks.file).toHaveBeenCalledTimes(1)
 const source=structuredClone(tools.sources.get(record.id))
 expect(source?.evidence).toMatchObject({coverage:"complete",characters:record.content.length,readAt:expect.any(String)})
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
  const file={...record,id:"file:known",kind:"document" as const,contentAvailable:false}
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
