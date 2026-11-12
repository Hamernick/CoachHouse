import { beforeEach, describe, expect, it, vi } from "vitest"
import { execFileSync } from "node:child_process"
import { join } from "node:path"
vi.mock("@/lib/organization/particle-ai-origins", () => ({ retainedParticleFiles: async () => new Map(), retainedParticleDocuments: async () => new Map() }))
vi.mock("@/lib/organization/particle-file-dependencies", () => ({ particleNativeFileDependencies: () => new Map(), nativeFilesForRecords: () => [], inaccessibleNativeFiles: async () => new Set() }))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ rpc: mocks.rpc }) }))
const mocks = vi.hoisted(() => ({ load: vi.fn(), context: vi.fn(), file: vi.fn(), provider: vi.fn(), rpc: vi.fn() }))
vi.mock("openai",()=>({default:class {responses={create:mocks.provider}}}))
vi.mock("@/features/workspace-ai/server/knowledge-records", async importOriginal => ({ ...await importOriginal<typeof import("@/features/workspace-ai/server/knowledge-records")>(), knowledgeLoader: () => mocks.load }))
vi.mock("@/features/workspace-ai/server/research-context", () => ({ loadResearchContext: mocks.context }))
vi.mock("@/features/workspace-ai/server/knowledge-file", () => ({ readKnowledgeFile: mocks.file }))
import { createDocumentEmbedding, withDocumentEmbeddingBudget } from "@/features/workspace-ai/server/document-embedding"
import { nativeDocumentText, documentPassages } from "@/features/workspace-ai/server/document-passages"
import { createDocumentRetrieval } from "@/features/workspace-ai/server/document-retrieval"
import { createKnowledgeTools } from "@/features/workspace-ai/server/knowledge-tools"
import { prepareComposerContext } from "@/features/workspace-ai/server/composer-context"
import { runResearchProvider } from "@/features/workspace-ai/server/research-provider"
import { bindResearch } from "@/features/workspace-ai/lib/research-contract"
import type { KnowledgeRecord } from "@/features/workspace-ai/research-types"
import type { ResearchContext } from "@/features/workspace-ai/server/research-context"
import type { Json } from "@/lib/supabase/types"
import { graph, particle, ID } from "./fixtures/particle-fixtures"
const port = process.env.RETRIEVAL_PG_PORT, bin = process.env.RETRIEVAL_PG_BIN
const sql = (input: string) => execFileSync(join(bin!,"psql"),["-h","/tmp","-p",port!,"-U","postgres","-d","postgres","-Atq","-v","ON_ERROR_STOP=1"],{input,encoding:"utf8"}).trim()
const dbId = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12,"0")}`
const context = { user: { id: dbId(1) }, canvasId: null, target: { organizationId: dbId(1), objectiveId: ID(1), revision: 0 }, graph: graph(), objective: particle(1,"objective") } as ResearchContext
const doc = (id: string,content: string): KnowledgeRecord => ({ id:`document:${id}`,kind:"document",title:id,content,href:"/workspace?tab=documents",revision:"r1",contentAvailable:true })
const pantry=doc("pantry","The pantry provides groceries to families."),budget=doc("budget","The annual food budget is 4200 dollars."),concert=doc("concert","Recruit musicians for the concert.")
let records: KnowledgeRecord[]
const embed = vi.fn(async (texts: readonly string[]) => texts.map(text => /groceries|food$/.test(text)?[1,0,0]:/budget/.test(text)?[0.8,0.2,0]:[0,0,1]))
const transport = (ctx = context) => async (operation: string,payload: Json) => JSON.parse(sql(`set role service_role;set request.jwt.claim.role='service_role';set request.headers='{"x-coach-house-actor-id":"${ctx.user.id}"}';
 select public.workspace_document_retrieval('${ctx.target.organizationId}','${ctx.user.id}',${ctx.canvasId?`'${ctx.canvasId}'`:"null"},'${operation}','${JSON.stringify(payload).replaceAll("'","''")}'::jsonb);`))
const retrieval = (extra: Partial<Parameters<typeof createDocumentRetrieval>[1]> = {},ctx = context,rpc=transport(ctx)) => createDocumentRetrieval(ctx,{qualifiedSourceIds:new Set([pantry.id,budget.id,concert.id]),model:"controlled-v1",dimensions:3,embed,...extra},rpc)
beforeEach(() => {
 vi.clearAllMocks();embed.mockReset();embed.mockImplementation(async texts=>texts.map(text=>/groceries|food$/.test(text)?[1,0,0]:/budget/.test(text)?[0.8,0.2,0]:[0,0,1]));records=[{...pantry},{...budget},{...concert}]
 mocks.rpc.mockImplementation(async(name,args)=>{
  if(name!=="workspace_document_retrieval" || args.p_actor_id!==context.user.id || args.p_org_id!==context.target.organizationId)throw Error("No external database permitted")
  return {data:await transport()(args.p_operation,args.p_payload),error:null}
 })
 mocks.context.mockResolvedValue(context)
 mocks.load.mockImplementation(async (_kind,_query,id) => records.filter(record=>!id||record.id===id))
 mocks.file.mockImplementation(async (_ctx,record) => record)
 if(port)sql(`delete from public.workspace_document_indexes;
  insert into public.profiles(id) values('${dbId(1)}') on conflict do nothing;
  insert into auth.users(id) values('${dbId(1)}') on conflict do nothing;
  insert into public.organizations(user_id) values('${dbId(1)}') on conflict do nothing;`)
})
it("requires an explicit server qualification and valid embedding configuration", () => {
 expect(() => retrieval({dimensions:0})).toThrow("configuration")
 expect(retrieval().eligible({...pantry,id:"document:unknown"})).toBe(false)
 expect(retrieval().eligible({...pantry,id:"file:legacy"})).toBe(false)
 expect(retrieval().eligible({...pantry,contentAvailable:false})).toBe(false)
 expect(retrieval().eligible({...pantry,revision:null})).toBe(false)
 expect(retrieval().eligible({...pantry,kind:"person"})).toBe(false)
})
it.skipIf(Boolean(port))("runs the disposable SQL and tool integration harness", () => {
 const output=execFileSync(process.execPath,["supabase/tests/workspace-document-retrieval.test.mjs"],{encoding:"utf8",env:{...process.env,RETRIEVAL_INTEGRATION:"1"},timeout:120000})
 expect(output).toContain('"assertions":')
},130000)
it("preserves normalized offsets and paragraph boundaries without splitting Unicode",()=>{
 const html="<h2>Mission</h2><p>Serve <strong>families</strong>.</p><p>Governance: board oversight.</p>"
 const native=nativeDocumentText(html)
 expect(native.content).toBe(html.replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim())
 expect(documentPassages({...pantry,...native}).map(range=>native.content.slice(range.start,range.end)))
  .toEqual(["Mission","Serve families .","Governance: board oversight."])
 const content="😀".repeat(5000)
 const ranges=documentPassages({...pantry,content})
 expect(ranges.every(range=>range.end-range.start<=480&&range.start%2===0&&range.end%2===0)).toBe(true)
 expect(ranges.at(-1)?.end).toBe(9600)
 const short=nativeDocumentText("<p>x</p>".repeat(5000)),packed=documentPassages({...pantry,...short})
 expect(packed.length).toBeLessThanOrEqual(96)
 expect(packed.at(-1)?.end).toBe(9599)
 for(const paragraph of short.nativeParagraphs.filter(range=>range.end<=9600))
  expect(packed.some(range=>range.start<=paragraph.start&&range.end>=paragraph.end)).toBe(true)
})
it("selects late native passages within unchanged indexing bounds and excludes text past the reader ceiling",()=>{
 const native=nativeDocumentText(["Opening summary.",...Array.from({length:900},(_,i)=>`Historical appendix ${i}: ${"routine detail ".repeat(8)}`),
  "November 12 board readiness: proposed agenda, missing October actuals.","Governance: directors approve budgets."].map(text=>`<p>${text}</p>`).join(""))
 const record={...pantry,...native}
 const selected=documentPassages(record,"November 12 governance")
 expect(selected.some(range=>range.start>100000&&record.content.slice(range.start,range.end).includes("November 12"))).toBe(true)
 expect(selected.some(range=>record.content.slice(range.start,range.end).includes("Governance"))).toBe(true)
 expect(selected.length).toBeLessThanOrEqual(96)
 expect(selected.reduce((sum,range)=>sum+range.end-range.start,0)).toBeLessThanOrEqual(9600)
 expect(selected.every(range=>range.end<=200000&&range.end-range.start<=480)).toBe(true)
 const oversized={...pantry,content:"x".repeat(200000)+" November 12 secret beyond reader ceiling"}
 expect(documentPassages(oversized,"November 12").some(range=>range.end>200000)).toBe(false)
 expect(documentPassages(record).every(range=>range.end<=9600)).toBe(true)
})
it("retains exact Unicode late offsets and bounded tiny-paragraph windows",()=>{
 const native=nativeDocumentText("<p>x</p>".repeat(60000)+"<p>Readiness 😀: November 12 agenda.</p>")
 const ranges=documentPassages({...pantry,...native},"Readiness November")
 const late=ranges.find(range=>range.end>120000)!
 expect(native.content.slice(late.start,late.end)).toContain("Readiness 😀")
 expect(ranges.length).toBeLessThanOrEqual(96)
 expect(ranges.reduce((sum,r)=>sum+r.end-r.start,0)).toBeLessThanOrEqual(9600)
 expect(ranges.every(r=>!/[\uD800-\uDBFF]$/.test(native.content.slice(r.start,r.end)))).toBe(true)
})
describe.skipIf(!port)("real PostgreSQL/pgvector through the current knowledge/answer owner", () => {
 it("retrieves distinct board passages, reports uncovered sections and reuses unchanged vectors after edits and moves",async()=>{
  const parts=["Mission: support neighborhood families through food access.","Governance: directors approve the annual budget.","November 12, 2026 meeting: the proposed agenda requests October actuals; no actuals are attached.","Curriculum: unrelated orientation material."]
  const native=nativeDocumentText(parts.map(part=>`<p>${part}</p>`).join(""))
  records=[{...pantry,...native}]
  const reader=retrieval(), tools=createKnowledgeTools(context,undefined,reader)
  const query='mission OR governance OR "November 12"'
  const found=await tools.execute("search_workspace",{query,kinds:["document"],documentMode:"keyword"})
  expect(found.results).toHaveLength(3)
  expect(new Set(found.results.map(item=>item.id))).toEqual(new Set([pantry.id]))
  expect(found.results.map(item=>"content" in item?item.content:"").sort()).toEqual(parts.slice(0,3).sort())
  for(const item of found.results)if("evidence" in item){
   const range=item.evidence.location!
   expect("content" in item&&item.content).toBe(native.content.slice(range.start,range.end))
   expect(item.evidence.textCoverage?.complete).toBe(false)
  }
  const evidence=tools.sources.get(pantry.id)?.evidence
  expect(evidence).toMatchObject({coverage:"excerpt",textCoverage:{complete:false}})
  expect(evidence?.characters).toBe(parts.slice(0,3).join("").length)
  expect(evidence?.location).toBeUndefined()
  expect(embed).not.toHaveBeenCalled()
  await reader.search(records,query,"hybrid")
  expect(embed.mock.calls[0][0]).toEqual(parts)
  const next=[parts[2],parts[0],"Governance: directors and the treasurer approve the annual budget.",parts[3]]
  records=[{...pantry,...nativeDocumentText(next.map(part=>`<p>${part}</p>`).join("")),revision:"r2"}]
  expect(await tools.revalidate()).toBe(false)
  await retrieval().search(records,query,"keyword")
  const before=embed.mock.calls.length
  const hits=await retrieval().search(records,query,"hybrid")
  expect(embed.mock.calls[before][0]).toEqual([next[2]])
  expect(hits.every(hit=>hit.record.revision==="r2")).toBe(true)
  expect(hits.find(hit=>hit.record.content.slice(hit.start,hit.end)===parts[2])?.start).toBe(0)
  expect(sql("select count(*) from public.workspace_document_chunks where source_revision='r1';")).toBe("0")
 })
 it("carries multiple passages through the controlled model-tool-answer path without inventing full review",async()=>{
  const parts=["Mission: support neighborhood families.","Governance: directors must approve the budget.","November 12 meeting: proposed agenda only; October actuals are missing.","Unread curriculum and historical sections."]
  records=[{...pantry,...nativeDocumentText(parts.map(part=>`<p>${part}</p>`).join(""))}]
  const preparedContext=await prepareComposerContext(context,[],undefined,retrieval())
  const summary="The mission supports families and directors approve budgets. The November 12 agenda is proposed; October actuals are missing. Remaining sections were not reviewed."
  const answer={responseKind:"answer",answerEvidenceIds:[pantry.id],title:"Board readiness",summary,questions:[],unfulfilled:["October actuals","Unread curriculum and historical sections"],decisions:[],removeReferences:[],items:[]}
  mocks.provider.mockImplementationOnce(()=>(async function*(){yield {type:"response.completed",response:{id:"board-search",status:"completed",usage:{input_tokens:100,output_tokens:20,input_tokens_details:{cached_tokens:0}},output:[{type:"function_call",id:"tool1",call_id:"call1",name:"search_workspace",arguments:JSON.stringify({query:'mission OR governance OR "November 12"',kinds:["document"],documentMode:"keyword"}),status:"completed"}]}}})())
  mocks.provider.mockImplementationOnce(()=>(async function*(){yield {type:"response.completed",response:{id:"board-answer",status:"completed",usage:{input_tokens:100,output_tokens:20,input_tokens_details:{cached_tokens:0}},output:[{type:"message",role:"assistant",status:"completed",content:[{type:"output_text",text:JSON.stringify(answer)}]}]}}})())
  const result=await runResearchProvider({preparedContext,context,request:{id:ID(91),parentRunId:ID(92),target:context.target,prompt:"Review board readiness for November 12 against mission and governance.",skill:"planning",tariffVersion:"fixture",maximumCredits:20},
   config:{tariff:{version:"fixture",model:"fixture",inputMicrodollarsPerMillion:1,cachedMicrodollarsPerMillion:0,outputMicrodollarsPerMillion:1,microdollarsPerCredit:2000},maxSearchCalls:0,maxRounds:2,maxOutputTokens:1500,maxInputBytes:20000,maxCredits:20,maxCost:40000},onResponse:async()=>{},isCanceled:async()=>false})
  expect(mocks.provider).toHaveBeenCalledTimes(2)
  const input=JSON.stringify(mocks.provider.mock.calls[1][0].input)
  for(const part of parts.slice(0,3))expect(input).toContain(part)
  for(const call of mocks.provider.mock.calls)expect(Buffer.byteLength(JSON.stringify(call[0]))).toBeLessThanOrEqual(20000)
  expect(result.result).toMatchObject({responseKind:"answer",summary,unfulfilled:answer.unfulfilled,sources:[{id:pantry.id,evidence:{coverage:"excerpt",textCoverage:{complete:false}}}]})
  expect(result.result?.dependencies?.records.map(record=>record.id)).toContain(pantry.id)
  expect(embed).not.toHaveBeenCalled()
 })
 it("retrieves and reads late board-packet evidence through the controlled model, SQL index and answer owners",async()=>{
  const parts=["Mission: support neighborhood families.","Governance: directors must approve the budget.","November 12 meeting: proposed agenda only; October actuals are missing."]
  const filler=(label:string)=>Array.from({length:230},(_,i)=>`${label} ${i}: ${"Historical orientation material. ".repeat(4)}`)
  const native=nativeDocumentText([...filler("A"),parts[0],...filler("B"),parts[1],...filler("C"),parts[2]].map(part=>`<p>${part}</p>`).join(""))
  records=[{...pantry,...native,nativeTextLength:native.content.length}]
  expect(native.content.indexOf(parts[0])).toBeGreaterThan(20000)
  expect(native.content.indexOf(parts[2])).toBeGreaterThan(90000)
  const preparedContext=await prepareComposerContext(context,[],undefined,retrieval())
  const response=(id:string,output:unknown[])=>(async function*(){yield {type:"response.completed",response:{id,status:"completed",output,usage:{input_tokens:100,output_tokens:20,input_tokens_details:{cached_tokens:0}}}}})()
  const call=(id:string,name:string,args:unknown)=>response(id,[{type:"function_call",id:`t${id}`,call_id:`c${id}`,name,arguments:JSON.stringify(args),status:"completed"}])
  const start=native.content.indexOf(parts[2]),end=start+parts[2].length
  mocks.provider.mockImplementationOnce(()=>call("search","search_workspace",{query:'mission OR governance OR "November 12"',kinds:["document"],documentMode:"keyword"}))
  mocks.provider.mockImplementationOnce(()=>call("read","read_workspace",{ids:[pantry.id],personFields:null,documentRanges:[{id:pantry.id,start,end}]}))
  const summary="Mission and governance require family support and budget approval. The November 12 agenda is proposed; October actuals and review of remaining packet sections are missing."
  const answer={responseKind:"answer",answerEvidenceIds:[pantry.id],title:"Board readiness",summary,questions:[],unfulfilled:["October actuals","Unread packet sections"],decisions:[],removeReferences:[],items:[]}
  mocks.provider.mockImplementationOnce(()=>response("answer",[{type:"message",role:"assistant",status:"completed",content:[{type:"output_text",text:JSON.stringify(answer)}]}]))
  const result=await runResearchProvider({preparedContext,context,request:{id:ID(91),parentRunId:ID(92),target:context.target,prompt:"Assess board readiness for November 12.",skill:"planning",tariffVersion:"fixture",maximumCredits:20},
   config:{tariff:{version:"fixture",model:"fixture",inputMicrodollarsPerMillion:1,cachedMicrodollarsPerMillion:0,outputMicrodollarsPerMillion:1,microdollarsPerCredit:2000},maxSearchCalls:0,maxRounds:3,maxOutputTokens:1500,maxInputBytes:20000,maxCredits:20,maxCost:40000},onResponse:async()=>{},isCanceled:async()=>false})
  expect(mocks.provider).toHaveBeenCalledTimes(3)
  for(const part of parts)expect(JSON.stringify(mocks.provider.mock.calls[2][0].input)).toContain(part)
  for(const call of mocks.provider.mock.calls)expect(Buffer.byteLength(JSON.stringify(call[0]))).toBeLessThanOrEqual(20000)
  const evidence=result.result?.sources[0].evidence
  expect(result.result).toMatchObject({responseKind:"answer",summary,unfulfilled:answer.unfulfilled})
  expect(evidence).toMatchObject({coverage:"excerpt",textCoverage:{complete:false,totalCharacters:native.content.length,availableCharacters:native.content.length}})
  expect(evidence?.textCoverage?.ranges.some(range=>range.start<=start&&range.end>=end)).toBe(true)
  expect(evidence?.readAt).not.toBeNull()
  expect(result.result?.dependencies?.records.map(record=>record.id)).toEqual([pantry.id])
  expect(embed).not.toHaveBeenCalled()
  expect(Number(sql("select max(end_offset) from public.workspace_document_chunks;"))).toBeGreaterThan(90000)
  expect(Number(sql("select sum(end_offset-start_offset) from public.workspace_document_chunks;"))).toBeLessThanOrEqual(9600)
  // Refill only newly selected/edited passages; unchanged late evidence retains
  // exact vectors despite movement and changes elsewhere in the large source.
  await retrieval().search(records,"November governance mission","hybrid")
  const before=embed.mock.calls.length
  records=[{...records[0],...nativeDocumentText("<p>New cover.</p>"+[...filler("A"),parts[0],...filler("B"),parts[1],...filler("C"),parts[2]].map(part=>`<p>${part}</p>`).join("")),revision:"r2",nativeTextLength:native.content.length+"New cover. ".length}]
  expect(await preparedContext.tools.revalidate()).toBe(false)
  await retrieval().search(records,"November governance mission","hybrid")
  const changed=embed.mock.calls.slice(before).flatMap(([texts])=>[...texts])
  for(const part of parts)expect(changed).not.toContain(part)
  expect(changed).toContain("New cover.")
  const tools=createKnowledgeTools(context,undefined,retrieval())
  await tools.execute("search_workspace",{query:"November",kinds:["document"],documentMode:"keyword"})
  records=[]
  expect(await tools.revalidate()).toBe(false)
  expect(await tools.execute("read_workspace",{ids:[pantry.id],documentRanges:[{id:pantry.id,start,end}]})).toMatchObject({results:[{status:"unavailable"}]})
 })
 it("batches five large native sources through unchanged admission, transport and accounting limits",async()=>{
  records=Array.from({length:5},(_,source)=>({...doc(`packet${source}`,""),...nativeDocumentText(Array.from({length:300},(_,i)=>
   `<p>Food groceries ${source}/${i}: ${"Background detail. ".repeat(6)}</p>`).join(""))}))
  const config=withDocumentEmbeddingBudget({tariff:{version:"fixture",model:"fixture",inputMicrodollarsPerMillion:1,cachedMicrodollarsPerMillion:0,outputMicrodollarsPerMillion:1,microdollarsPerCredit:2000},maxSearchCalls:0,maxRounds:2,maxOutputTokens:1500,maxInputBytes:20000,maxCredits:20,maxCost:40000},
   {model:"controlled-v1",dimensions:3,microdollarsPerMillion:20000,maxInputBytes:180000,maxInputTokens:200000,maxCalls:8})
  const usage={input:0,cachedInput:0,output:0,webSearchCalls:0,embeddingInput:0}
  const wire=vi.fn(async(request:Parameters<Parameters<typeof createDocumentEmbedding>[0]["transport"]>[0])=>{
   expect(request.input.length).toBeLessThanOrEqual(120)
   const bytes=request.input.reduce((sum,text)=>sum+Buffer.byteLength(text),0)
   expect(bytes).toBeLessThanOrEqual(180000)
   expect(request.input.every(text=>Buffer.byteLength(text)<=1440)).toBe(true)
   return {model:request.model,inputTokens:bytes,vectors:request.input.map(()=>[1,0,0])}
  })
  const controller=createDocumentEmbedding({runId:"large-fixture",config,usage,signal:new AbortController().signal,isCanceled:async()=>false,transport:wire})
  const reader=retrieval({qualifiedSourceIds:new Set(records.map(record=>record.id)),embed:controller.embed})
  const hits=await reader.search(records,"food groceries","hybrid")
  expect(hits).toHaveLength(8)
  expect(new Set(hits.map(hit=>hit.record.id)).size).toBe(5)
  const chunkCount=Number(sql("select count(*) from public.workspace_document_chunks;"))
  expect(chunkCount).toBeGreaterThan(120);expect(chunkCount).toBeLessThanOrEqual(480)
  expect(wire.mock.calls.length).toBe(Math.ceil(chunkCount/120)+1)
  expect(usage.embeddingInput).toBe(wire.mock.calls.reduce((sum,[request])=>sum+request.input.reduce((n,text)=>n+Buffer.byteLength(text),0),0))
  expect(usage.embeddingInput).toBeLessThanOrEqual(48000+"food groceries".length)
  const before=wire.mock.calls.length
  await reader.search(records,"food groceries","hybrid")
  expect(wire.mock.calls.length).toBe(before+1)
  expect(wire.mock.calls.at(-1)?.[0].input).toEqual(["food groceries"])
 })
 it.each(["revoked","canceled","malformed"])("stops before the next embedding batch after %s",async failure=>{
  records=Array.from({length:3},(_,source)=>({...doc(`packet${source}`,""),...nativeDocumentText(Array.from({length:200},(_,i)=>
   `<p>Food ${source}/${i}: ${"Background detail. ".repeat(6)}</p>`).join(""))}))
  let revoked=false
  const abort=new AbortController()
  const send=vi.fn(async(texts:readonly string[])=>{
   if(failure==="revoked")revoked=true
   if(failure==="canceled")abort.abort()
   return texts.map(()=>failure==="malformed"?[0,0,0]:[1,0,0])
  })
  const reader=retrieval({qualifiedSourceIds:new Set(records.map(record=>record.id)),embed:send})
  await expect(reader.search(records,"food","hybrid",abort.signal,async()=>{if(revoked)throw Error("Source revoked")})).rejects.toThrow(failure==="revoked"?"Source revoked":failure==="malformed"?"Invalid document embeddings":"abort")
  expect(send).toHaveBeenCalledOnce()
  expect(sql("select count(*) from public.workspace_document_chunks;")).toBe("0")
 })
 it("rejects duplicate passage keys even when repeated source IDs are valid",async()=>{
  const rpc=transport()
  const adapter=retrieval({},context,async(op,payload)=>{const hits=await rpc(op,payload);return op==="search"?[hits[0],hits[0]]:hits})
  await expect(adapter.search(records,"food","keyword")).rejects.toThrow("Duplicate search identity")
 })
 it("compares keyword, semantic and combined results, reusing persisted chunks",async () => {
  const reader=retrieval()
  expect((await reader.search(records,"food","keyword")).map(hit=>hit.record.id)).toEqual([budget.id])
  expect((await reader.search(records,"food","semantic")).map(hit=>hit.record.id)).toEqual([pantry.id,budget.id])
  expect((await reader.search(records,"food","hybrid")).map(hit=>hit.record.id)).toEqual([budget.id,pantry.id])
  expect(embed.mock.calls.map(call=>call[0].length)).toEqual([3,1,1])
  // A fresh server instance reuses persisted derived data, never a private global cache.
  await retrieval().search(records,"food","keyword")
  expect(embed).toHaveBeenCalledTimes(3)
 })
 it("searches current board evidence through the existing tool with zero embedding calls",async()=>{
  embed.mockRejectedValueOnce(Error("Embedding provider must not be called"))
  const tools=createKnowledgeTools(context,undefined,retrieval())
  const result=await tools.execute("search_workspace",{query:"food",kinds:["document"],documentMode:"keyword"})
  expect(result.results).toHaveLength(1)
  expect(JSON.stringify(result)).toContain("4200")
  expect(result).toMatchObject({note:expect.stringContaining("keyword document search: up to 5 qualified native sources")})
  expect(tools.sources.get(budget.id)?.evidence?.location?.start).toBe(0)
  expect(embed).not.toHaveBeenCalled()
  records=records.map(record=>record.id===budget.id?{...record,content:"The current food budget is 6200 dollars.",revision:"r2"}:record)
  const currentTools=createKnowledgeTools(context,undefined,retrieval())
  expect(JSON.stringify(await currentTools.execute("search_workspace",{query:"food",kinds:["document"],documentMode:"keyword"}))).toContain("6200")
  expect(await tools.revalidate()).toBe(false)
  expect(embed).not.toHaveBeenCalled()
 })
 it("fills missing vectors only on explicit hybrid use and preserves unchanged vectors after keyword edits",async()=>{
  const reader=retrieval()
  await reader.search(records,"food","keyword")
  expect(embed).not.toHaveBeenCalled()
  await reader.search(records,"food","hybrid")
  expect(embed.mock.calls.map(call=>call[0].length)).toEqual([3,1])
  records=records.map(record=>record.id===budget.id?{...record,content:"The current food budget is 6200 dollars.",revision:"r2"}:record)
  await reader.search(records,"food","keyword")
  expect(embed).toHaveBeenCalledTimes(2)
  await reader.search(records,"food","hybrid")
  expect(embed.mock.calls.map(call=>call[0].length)).toEqual([3,1,1,1])
 })
 it("re-embeds derived chunks when the qualified processor changes under the same model name",async()=>{
  await retrieval({processingIdentity:"processor-a"}).search(records,"food")
  expect(embed.mock.calls.map(call=>call[0].length)).toEqual([3,1])
  await retrieval({processingIdentity:"processor-b"}).search(records,"food")
  expect(embed.mock.calls.map(call=>call[0].length)).toEqual([3,1,3,1])
 })
 it("answers a document question through the existing tool and binds source coverage/location",async () => {
  const tools=createKnowledgeTools(context,undefined,retrieval())
  const found=await tools.execute("search_workspace",{query:"food",kinds:["document"]})
  expect(found.results).toMatchObject([{id:budget.id,content:budget.content,evidence:{coverage:"excerpt",location:{kind:"reader_text",start:0,end:budget.content.length}}},{id:pantry.id}])
  const answer=bindResearch(JSON.stringify({responseKind:"answer",answerEvidenceIds:[budget.id],title:"Food budget",summary:"The annual food budget is 4200 dollars.",questions:[],unfulfilled:[],decisions:[],removeReferences:[],items:[]}),tools.evidence([budget.id]),context.target,ID(80))
  expect(answer.sources.find(source=>source.id===budget.id)).toMatchObject({revision:"r1",evidence:{coverage:"excerpt",location:{start:0}}})
  expect(tools.dependencies().records).toHaveLength(2)
  expect(await tools.revalidate()).toBe(true)
  expect(await tools.execute("read_workspace",{ids:[budget.id]})).toMatchObject({results:[{content:budget.content,status:"available"}]})
  expect(tools.sources.get(budget.id)?.evidence?.coverage).toBe("complete")
 })
 it.each(["keyword-prepared","admitted","admitted-prepared","admitted-keyword"])("completes a controlled search-to-answer turn with %s",async mode=>{
  const admitted=mode!=="keyword-prepared"
  const selected=mode==="admitted"?undefined:await prepareComposerContext(context,[],undefined,admitted?undefined:retrieval())
  const preparedContext=selected?{...selected,records:[...selected.records,{conversation:[{user:"Keep the prior discussion"}]}]}:undefined
  const base={tariff:{version:"fixture",model:"fixture",inputMicrodollarsPerMillion:1,cachedMicrodollarsPerMillion:0,outputMicrodollarsPerMillion:1,microdollarsPerCredit:2000},maxSearchCalls:0,maxRounds:2,maxOutputTokens:1500,maxInputBytes:20000,maxCredits:20,maxCost:40000}
  const config=admitted?withDocumentEmbeddingBudget(base,{model:"controlled-v1",dimensions:3,microdollarsPerMillion:100000,maxInputBytes:1000,maxInputTokens:2000,maxCalls:4}):base
  const embeddingTransport=vi.fn(async(request:{input:readonly string[];model:string})=>({model:request.model,inputTokens:request.input.length,vectors:await embed(request.input)}))
  const answer={responseKind:"answer",answerEvidenceIds:[budget.id],title:"Food budget",summary:budget.content,questions:[],unfulfilled:[],decisions:[],removeReferences:[],items:[]}
  mocks.provider.mockImplementationOnce(()=>(async function*(){yield {type:"response.completed",response:{id:"controlled-search",status:"completed",usage:{input_tokens:100,output_tokens:20,input_tokens_details:{cached_tokens:0}},output:[{type:"function_call",id:"tool1",call_id:"call1",name:"search_workspace",arguments:JSON.stringify({query:"food",kinds:["document"],documentMode:mode==="admitted-keyword"?"keyword":null}),status:"completed"}]}}})())
  mocks.provider.mockImplementationOnce(()=>(async function*(){yield {type:"response.completed",response:{id:"controlled-answer",status:"completed",usage:{input_tokens:100,output_tokens:20,input_tokens_details:{cached_tokens:0}},output:[{type:"message",role:"assistant",status:"completed",content:[{type:"output_text",text:JSON.stringify(answer)}]}]}}})())
  const result=await runResearchProvider({preparedContext,context,request:{id:ID(91),parentRunId:ID(92),target:context.target,prompt:"What is the food budget?",skill:"planning",tariffVersion:"fixture",maximumCredits:20},
   config,...(admitted?{documentEmbedding:{qualifiedSourceIds:new Set([pantry.id,budget.id,concert.id]),transport:embeddingTransport}}:{}),onResponse:async()=>{},isCanceled:async()=>false})
  expect(mocks.provider).toHaveBeenCalledTimes(2)
  if(preparedContext) expect(JSON.stringify(mocks.provider.mock.calls[0][0].input)).toContain("Keep the prior discussion")
  if(mode==="admitted-keyword"){expect(result.usage.embeddingInput).toBeUndefined();expect(embeddingTransport).not.toHaveBeenCalled()}
  else if(admitted){expect(result.usage.embeddingInput).toBe(4);expect(embeddingTransport).toHaveBeenCalledTimes(2)}
  expect(JSON.stringify(mocks.provider.mock.calls[1][0].input)).toContain("4200")
  expect(result.result).toMatchObject({responseKind:"answer",summary:budget.content,answerEvidenceIds:[budget.id]})
  expect(result.result?.sources.find(source=>source.id===budget.id)?.evidence?.location?.start).toBe(0)
  expect(result.result?.dependencies?.records.map(record=>record.id)).toContain(budget.id)
 })
 it("locates text beyond the initial snippet without claiming full document coverage",async()=>{
  records=[{...pantry,content:"An unrelated introduction. ".repeat(32)+pantry.content}]
  const tools=createKnowledgeTools(context,undefined,retrieval())
  const result=await tools.execute("search_workspace",{query:"food",kinds:["document"]})
  expect(result.results).toHaveLength(1)
  const source=tools.sources.get(pantry.id)!
  expect(source.evidence?.location?.start).toBeGreaterThan(0)
  expect(source.evidence?.coverage).toBe("excerpt")
  expect(JSON.stringify(result)).toContain("groceries")
 })
 it("updates a new answer and invalidates the previously retained answer",async()=>{
  const tools=createKnowledgeTools(context,undefined,retrieval())
  await tools.execute("search_workspace",{query:"food",kinds:["document"]})
  records=records.map(record=>record.id===budget.id?{...record,content:"The food budget is now 6200 dollars.",revision:"r2"}:record)
  expect(await tools.revalidate()).toBe(false)
  const priorEmbeds=embed.mock.calls.length
  const next=createKnowledgeTools(context,undefined,retrieval())
  const result=await next.execute("search_workspace",{query:"food",kinds:["document"]})
  expect(JSON.stringify(result)).toContain("6200");expect(JSON.stringify(result)).not.toContain("4200")
  expect(next.sources.get(budget.id)?.revision).toBe("r2")
  expect(embed.mock.calls[priorEmbeds][0]).toEqual(["The food budget is now 6200 dollars."])
 })
 it.each(["delete","revoke"])("removes %s source candidates and stale retained answers",async()=>{
  const tools=createKnowledgeTools(context,undefined,retrieval())
  await tools.execute("search_workspace",{query:"food",kinds:["document"]})
  records=[]
  expect(await tools.revalidate()).toBe(false)
  const next=createKnowledgeTools(context,undefined,retrieval())
  expect(await next.execute("search_workspace",{query:"food",kinds:["document"]})).toMatchObject({results:[],unavailableKinds:[]})
  expect(sql("select count(*) from public.workspace_document_chunks;")).toBe("0")
 })
 it.each(["delete","revision","same-revision-content"])("withholds %s changed during ranking",async mode=>{
  const rpc=transport()
  const adapter=retrieval({},context,async(op,payload)=>{
   const result=await rpc(op,payload)
   if(op==="search")records=mode==="delete"?[]:records.map(record=>({...record,content:"changed",...(mode==="revision"?{revision:"r2"}:{})}))
   return result
  })
  const tools=createKnowledgeTools(context,undefined,adapter)
  expect(await tools.execute("search_workspace",{query:"food",kinds:["document"]})).toMatchObject({results:[],unavailableKinds:["document"]})
  expect(tools.sources.size).toBe(0)
 })
 it("excludes unqualified history, personal chat and Memory from ingestion",async()=>{
  records.push(doc("unknown-history","private food"),{...pantry,id:"particle:private-chat",kind:"particle"})
  await retrieval().search(records,"food")
  expect(JSON.stringify(embed.mock.calls)).not.toContain("private")
  expect(sql("select count(*) from public.workspace_document_chunks;")).toBe("3")
 })
 it("binds adapters to actor, organization and canvas before any index access",async()=>{
  for(const changed of [{...context,user:{...context.user,id:dbId(2)}},{...context,target:{...context.target,organizationId:dbId(2)}},{...context,canvasId:ID(7)}]){
   const tools=createKnowledgeTools(context,undefined,retrieval({},changed))
   await expect(tools.execute("search_workspace",{query:"food",kinds:["document"]})).rejects.toThrow("scope changed")
  }
  expect(embed).not.toHaveBeenCalled()
 })
 it("rejects forged index locations and unsupported embedding changes",async()=>{
  const rpc=transport()
  const adapter=retrieval({},context,async(op,payload)=>{const data=await rpc(op,payload);return op==="search"?data.map((hit:object)=>({...hit,end:90000})):data})
  await expect(adapter.search(records,"food")).rejects.toThrow("source changed")
  await expect(retrieval({embed:async texts=>texts.map(()=>[1,0]) ,model:"changed-model"}).search(records,"food")).rejects.toThrow("embeddings")
 })
 it.each(["before","after"])("rechecks every candidate %s embedding and withholds stale persistence",async when=>{
  const rpc=transport()
  const adapter=retrieval({embed:async texts=>{const values=await embed(texts);if(when==="after")records=[];return values}},context,async(op,payload)=>{
   const result=await rpc(op,payload);if(op==="state"&&when==="before")records=[];return result
  })
  const tools=createKnowledgeTools(context,undefined,adapter)
  expect(await tools.execute("search_workspace",{query:"food",kinds:["document"]})).toMatchObject({results:[],unavailableKinds:["document"]})
  expect(embed).toHaveBeenCalledTimes(when==="before"?0:1)
  expect(sql("select count(*) from public.workspace_document_chunks;")).toBe("0")
 })
 it("escapes swallowed tool failures after uncertain embedding usage and prevents another answer dispatch",async()=>{
  mocks.provider.mockImplementationOnce(()=>(async function*(){yield {type:"response.completed",response:{id:"controlled-search",status:"completed",usage:{input_tokens:100,output_tokens:20,input_tokens_details:{cached_tokens:0}},output:[{type:"function_call",id:"tool1",call_id:"call1",name:"search_workspace",arguments:JSON.stringify({query:"food",kinds:["document"],documentMode:null}),status:"completed"}]}}})())
  const config=withDocumentEmbeddingBudget({tariff:{version:"fixture",model:"fixture",inputMicrodollarsPerMillion:1,cachedMicrodollarsPerMillion:0,outputMicrodollarsPerMillion:1,microdollarsPerCredit:2000},maxSearchCalls:0,maxRounds:2,maxOutputTokens:1500,maxInputBytes:20000,maxCredits:20,maxCost:40000},{model:"controlled-v1",dimensions:3,microdollarsPerMillion:100000,maxInputBytes:1000,maxInputTokens:2000,maxCalls:4})
  const dispatch=vi.fn(async()=>{throw Error("Lost provider reply")})
  await expect(runResearchProvider({context,request:{id:ID(91),parentRunId:ID(92),target:context.target,prompt:"What is the food budget?",skill:"planning",tariffVersion:config.tariff.version,maximumCredits:config.maxCredits},config,
   documentEmbedding:{qualifiedSourceIds:new Set([pantry.id,budget.id,concert.id]),transport:dispatch},onResponse:async()=>{},isCanceled:async()=>false})).rejects.toThrow("reconciliation")
  expect(dispatch).toHaveBeenCalledOnce();expect(mocks.provider).toHaveBeenCalledOnce()
  expect(sql("select count(*) from public.workspace_document_chunks;")).toBe("0")
 })
 it("cancels before embedding or persistence",async()=>{
  const controller=new AbortController();controller.abort()
  await expect(retrieval().search(records,"food","hybrid",controller.signal)).rejects.toThrow()
  expect(embed).not.toHaveBeenCalled()
  expect(sql("select count(*) from public.workspace_document_chunks;")).toBe("0")
 })
})
