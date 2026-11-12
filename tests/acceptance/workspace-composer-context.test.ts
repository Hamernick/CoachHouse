import { beforeEach, describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ load: vi.fn(), context: vi.fn(), provider: vi.fn(), team: vi.fn() }))
vi.mock("openai",()=>({default:class {responses={create:mocks.provider}}}))
vi.mock("@/features/workspace-ai/server/knowledge-records",async original => ({...await original<typeof import("@/features/workspace-ai/server/knowledge-records")>(),knowledgeLoader:()=>mocks.load}))
vi.mock("@/features/workspace-ai/server/research-context",()=>({loadResearchContext:mocks.context}))
vi.mock("@/features/workspace-particles/server",()=>({loadParticleAssigneesAction:mocks.team}))
import { prepareComposerContext, listComposerContext } from "@/features/workspace-ai/server/composer-context"
import { runResearchProvider } from "@/features/workspace-ai/server/research-provider"
import { planKnowledgeRecords } from "@/features/workspace-ai/server/knowledge-context-records"
import { composerContextReferencesSchema } from "@/lib/workspace/composer-context"
import { composerToken, replaceComposerToken } from "@/features/workspace-particles/lib/composer-token"
import type { KnowledgeRecord } from "@/features/workspace-ai/research-types"
import type { ResearchContext } from "@/features/workspace-ai/server/research-context"
import { ID, WORKSPACE, graph, particle } from "./fixtures/particle-fixtures"
import { revalidateWorkspaceComposerContext } from "@/features/workspace-ai/context-actions"
const target={organizationId:WORKSPACE,mode:"new_objective" as const,canvasId:null,revision:0}
const context={user:{id:ID(90)},canvasId:null,target,graph:graph()} as ResearchContext
const document: KnowledgeRecord={id:"document:mission",kind:"document",title:"Mission",content:"The selected plan must support neighborhood gardens.",revision:"1",href:"/workspace",contentAvailable:true}
beforeEach(()=>{vi.clearAllMocks();mocks.context.mockResolvedValue(context);mocks.load.mockImplementation(async kind=>kind==="document"?[document]:[]);mocks.team.mockResolvedValue([])})
describe("composer context evidence",()=>{
 it("revalidates exact selected IDs with current actor context and returns references only",async()=>{
  mocks.load.mockImplementation(async (_kind, query, exact) => {
   expect(query).toBe(""); expect(exact).toBeTruthy()
   return exact === "file:old" ? [{...document,id:exact,contentAvailable:false,file:{format:"pdf",size:10}}] : [document]
  })
  const refs=[{id:document.id,revision:"1"},{id:"file:old",revision:"1"}]
  expect(await revalidateWorkspaceComposerContext(target,refs)).toEqual(refs)
  expect(mocks.context).toHaveBeenCalledWith(target,false,{includeDataViewSources:false})
  expect(mocks.load).toHaveBeenCalledWith("document","","file:old")
  expect(mocks.provider).not.toHaveBeenCalled()
 })
 it("removes revoked, changed, unreadable and failed sources without discarding verified selections",async()=>{
  mocks.load.mockImplementation(async (_kind,_query,exact) => {
   if(exact === "document:failed")throw Error("unavailable")
   if(exact === "document:revoked")return []
   return [{...document,id:exact,revision:exact === "document:changed" ? "2" : "1",contentAvailable:exact !== "document:unreadable"}]
  })
  const refs=["mission","failed","revoked","changed","unreadable"].map(id=>({id:`document:${id}`,revision:"1"}))
  expect(await revalidateWorkspaceComposerContext(target,refs)).toEqual([refs[0]])
  mocks.context.mockRejectedValueOnce(Error("Workspace unavailable"))
  await expect(revalidateWorkspaceComposerContext(target,[refs[0]])).rejects.toThrow("Workspace unavailable")
  expect(mocks.provider).not.toHaveBeenCalled()
 })
 it("rejects injected authority and oversized reference checks before loading context",async()=>{
  await expect(revalidateWorkspaceComposerContext(target,Array.from({length:11},(_,i)=>({id:`file:f${i}`,revision:"1"})))).rejects.toThrow()
  await expect(revalidateWorkspaceComposerContext(target,[{id:document.id,revision:"1",title:"invented"} as never])).rejects.toThrow()
  expect(mocks.context).not.toHaveBeenCalled()
 })
 it("delivers selected contents to the first provider request and retains uncited dependencies",async()=>{
  const result={responseKind:"answer",answerEvidenceIds:[],title:"Garden plan",summary:"Support gardens",questions:[],unfulfilled:[],decisions:[],removeReferences:[],items:[]}
  mocks.provider.mockImplementation(() => (async function* () {
    yield { type:"response.completed", response:{ id:"r1", status:"completed",
      usage:{input_tokens:100,output_tokens:20,input_tokens_details:{cached_tokens:0}},
      output:[{type:"message",role:"assistant",status:"completed",content:[{type:"output_text",text:JSON.stringify(result)}]}],
    } }
  })())
  const config={tariff:{version:"test",model:"fixture",inputMicrodollarsPerMillion:1,cachedMicrodollarsPerMillion:0,outputMicrodollarsPerMillion:1,microdollarsPerCredit:2000},maxSearchCalls:0,maxRounds:1,maxOutputTokens:1500,maxInputBytes:20000,maxCredits:20,maxCost:40000}
  const request={id:ID(9),target,prompt:"Build a plan",skill:"planning" as const,tariffVersion:"test",maximumCredits:20,context:[{id:document.id,revision:document.revision}]}
  const reply=await runResearchProvider({request,context,config,onResponse:async()=>{},isCanceled:async()=>false})
  expect(JSON.stringify(mocks.provider.mock.calls[0][0].input)).toContain(document.content)
  expect(reply.result?.dependencies?.records).toEqual(expect.arrayContaining([expect.objectContaining({id:document.id})]))
  expect(reply.result?.sources).toEqual([]) // Uncited evidence remains a dependency, not an invented citation.
  expect(JSON.parse(mocks.provider.mock.calls[0][0].input[0].content).selectedContext[0].evidence.coverage).toBe("complete")
 })
 it("does not include removed context and rejects revoked, changed or unreadable references",async()=>{
  expect((await prepareComposerContext(context,[])).records).toEqual([])
  expect(mocks.load).not.toHaveBeenCalled()
  await expect(prepareComposerContext(context,[{id:document.id,revision:"old"}])).rejects.toMatchObject({code:"sources_changed"})
  await expect(prepareComposerContext(context,[{id:"document:other",revision:"1"}])).rejects.toMatchObject({code:"sources_changed"})
  mocks.load.mockResolvedValue([{...document,contentAvailable:false}])
  await expect(prepareComposerContext(context,[{id:document.id,revision:"1"}])).rejects.toMatchObject({code:"verification_unavailable"})
 })
 it("revalidates even uncited selected sources before dispatch/apply",async()=>{
  const prepared=await prepareComposerContext(context,[{id:document.id,revision:"1"}])
  mocks.load.mockResolvedValue([{...document,revision:"2"}])
  expect(await prepared.tools.revalidate()).toBe(false)
 })
 it("bounds the combined text across ten references and rejects duplicates or invented authority",async()=>{
  const records=Array.from({length:10},(_,i)=>({...document,id:`document:d${i}`,content:"x".repeat(15000)}))
  mocks.load.mockResolvedValue(records)
  const prepared=await prepareComposerContext(context,records.map(({id,revision})=>({id,revision})))
  const disclosed=prepared.records.map(record=>{if(!("content" in record))throw Error("Expected document evidence, not guidance");return record})
  expect(disclosed.reduce((sum,record)=>sum+record.content.length,0)).toBeLessThanOrEqual(6000)
  expect(disclosed.every(record=>record.truncated)).toBe(true)
  expect(composerContextReferencesSchema.safeParse([{id:document.id,revision:"1",url:"https://evil.test"}]).success).toBe(false)
  expect(composerContextReferencesSchema.safeParse([{id:document.id,revision:"1"},{id:document.id,revision:"1"}]).success).toBe(false)
 })
 it("lists scoped categories without disclosing bodies; plan identity includes its objective",async()=>{
  const owner=particle(1,"objective")
  if(owner.type!=="objective")throw Error("fixture")
  owner.data.planning={plans:[{id:ID(8),title:"Pilot",revision:2,particleIds:[]}],proposals:[{id:ID(7),planId:ID(8),baseRevision:2,title:"Proposed pilot",particleIds:[],authorId:ID(90),createdAt:"2026-11-04T12:00:00Z",status:"pending"}]}
  const scoped={...context,graph:{...context.graph,particles:[owner]}}
  const plans=planKnowledgeRecords(scoped)
  expect(plans[0]).toMatchObject({id:`particle:${owner.id}:plan:${ID(8)}`,revision:`${owner.revision}:2`})
  expect(plans[1].id).toBe(`particle:${owner.id}:proposal:${ID(7)}`)
  expect(plans[1].content).toContain("Proposed")
  mocks.load.mockImplementation(async kind=>kind==="document"?[document]:kind==="particle"?plans:[])
  mocks.team.mockResolvedValue([{id:ID(91),name:"Alice",avatarUrl:"https://example.test/alice.webp"}])
  const listed=await listComposerContext(scoped,"")
  expect(listed.items.map(item=>item.group)).toEqual(["People","Documents","Plans","Plans"])
  expect(listed.items[0]).toMatchObject({title:"Alice",avatarUrl:"https://example.test/alice.webp"})
  expect(JSON.stringify(listed)).not.toContain("avatarSource")
  expect(JSON.stringify(listed)).not.toContain(document.content)
 })
})
describe("composer typed menu tokens",()=>{
 it("opens / and @ at boundaries and closes after removing them",()=>{
  expect(composerToken("/",1)).toMatchObject({kind:"create",query:""})
  expect(composerToken("",0)).toBeNull()
  expect(composerToken("Plan with @docs",15)).toMatchObject({kind:"context",query:"docs"})
  for(const value of ["email@example.com","https://host/@docs","/path/file","`@code","@{Mission}"])expect(composerToken(value,value.length)).toBeNull()
 })
 it("preserves prose and caret on insertion in the middle of a request",()=>{
  const value="Use @mi for our plan",caret=7
  expect(replaceComposerToken(value,composerToken(value,caret),caret,"@{Mission}")).toEqual({value:"Use @{Mission}  for our plan",caret:15})
 })
})
