import { createHash } from "node:crypto"
import { beforeEach, describe, expect, it, vi } from "vitest"
const mocks=vi.hoisted(()=>({load:vi.fn(),context:vi.fn(),rpc:vi.fn(),single:vi.fn(),download:vi.fn(),access:vi.fn(),window:vi.fn(),provider:vi.fn(),eq:vi.fn(),admin:vi.fn(),warn:vi.fn()}))
vi.mock("@/lib/organization/particle-ai-origins",()=>({retainedParticleFiles:async()=>new Map(),retainedParticleDocuments:async()=>new Map()}))
vi.mock("@/features/workspace-ai/server/research-context",()=>({loadResearchContext:mocks.context}))
vi.mock("@/features/workspace-ai/server/knowledge-records",async original=>({...await original<typeof import("@/features/workspace-ai/server/knowledge-records")>(),knowledgeLoader:()=>mocks.load}))
vi.mock("@/lib/organization/document-storage-access",()=>({resolveOrganizationDocumentStorageAccess:mocks.access}))
vi.mock("@/lib/organization/private-storage-link",()=>({assertPrivateOrganizationReadWindow:mocks.window}))
vi.mock("@/lib/supabase/admin",()=>({createSupabaseAdminClient:(options:unknown)=>{mocks.admin(options);return {rpc:mocks.rpc,storage:{from:(bucket:string)=>{expect(bucket).toBe("org-documents");return {download:mocks.download}}}}}}))
vi.mock("@/lib/logger",()=>({logger:{warn:mocks.warn}}))
vi.mock("openai",()=>({default:class {responses={create:mocks.provider}}}))
import { createKnowledgeTools } from "@/features/workspace-ai/server/knowledge-tools"
import { particleKnowledgeRecord } from "@/features/workspace-ai/server/knowledge-records"
import { assertResearchSourcesAccessible } from "@/features/workspace-ai/server/research-result-access"
import { runResearchProvider } from "@/features/workspace-ai/server/research-provider"
import { assertInitialResearchRequestFits, hasResearchTableSources } from "@/features/workspace-ai/server/research-provider-request"
import { researchResultSchema, type KnowledgeRecord } from "@/features/workspace-ai/research-types"
import { tableAnalysisEvidenceSchema } from "@/lib/workspace/table-analysis-schema"
import { calculateCsvBudget } from "@/features/workspace-data-views"
import type { ResearchContext } from "@/features/workspace-ai/server/research-context"
import { graph, particle, ID, WORKSPACE } from "./fixtures/particle-fixtures"
const fileId=ID(80),actorId=ID(90),canvasId=ID(99)
const revision="2026-11-11T00:00:00.000Z"
const header="Budget,Actual,Currency,Month,Program"
const initial=`${header}\r\n0.10,0.20,USD,2026-10,"Pantry, city"\r\n0.20,0.10,USD,2026-10,"Multi\nline"\r\n99,99,EUR,2026-09,Other\r\n`
const bytesHash=(value:Uint8Array)=>createHash("sha256").update(value).digest("hex")
let bytes=new TextEncoder().encode(initial)
const metadata=()=>({id:fileId,name:"Board budget.csv",mime_type:"text/csv",size_bytes:bytes.length,storage_path:`${WORKSPACE}/library/${fileId}/original.csv`,updated_at:revision})
let file=metadata(),dispatched:unknown[]=[]
const record=():KnowledgeRecord=>({id:`file:${fileId}`,kind:"document",title:file.name,revision:file.updated_at,href:`/workspace?tab=documents&focus=${fileId}`,content:`text/csv; ${file.size_bytes} bytes. File metadata only; contents have not been read.`,contentAvailable:false,file:{format:"csv",size:file.size_bytes}})
const query={select:vi.fn().mockReturnThis(),eq:(...args:unknown[])=>{mocks.eq(...args);return query},is:vi.fn().mockReturnThis(),abortSignal:vi.fn().mockReturnThis(),single:mocks.single}
const context={user:{id:actorId},canvasId,target:{organizationId:WORKSPACE,objectiveId:ID(1),revision:0},graph:graph([particle(1,"objective")]),objective:particle(1,"objective"),supabase:{from:(table:string)=>{expect(table).toBe("organization_document_files");return query}}} as unknown as ResearchContext
const request={id:`file:${fileId}`,budgetColumn:"column_1",actualColumn:"column_2",currencyColumn:"column_3",periodColumn:"column_4",currency:"USD" as const,amountUnit:"major" as const,period:"2026-10"}
const args={ids:[request.id],tableAnalysis:request}
const saved=(tools:ReturnType<typeof createKnowledgeTools>)=>researchResultSchema.parse({runId:ID(91),target:context.target,responseKind:"answer",answerEvidenceIds:[request.id],title:"Board finance",summary:"USD 0.30 budget and actual.",questions:[],unfulfilled:[],items:[],decisions:[],removeReferences:[],sources:[...tools.sources.values()],dependencies:tools.dependencies()})
function setText(value:string){bytes=new TextEncoder().encode(value);file.size_bytes=bytes.length}
beforeEach(()=>{
 vi.resetAllMocks();bytes=new TextEncoder().encode(initial);file=metadata();dispatched=[]
 query.select.mockReturnValue(query);query.is.mockReturnValue(query);query.abortSignal.mockReturnValue(query)
 mocks.context.mockResolvedValue(context)
 mocks.load.mockImplementation(async(kind:string)=>kind==="document"?[record()]:context.graph.particles.map(particleKnowledgeRecord))
 mocks.single.mockImplementation(async()=>({data:{...file},error:null}))
 mocks.access.mockResolvedValue({hasStorageAccess:true});mocks.window.mockResolvedValue(undefined)
 mocks.rpc.mockImplementation(async(name,input)=>{
  expect(name).toBe("filter_workspace_ai_sources")
  expect(input).toMatchObject({p_actor_id:actorId,p_org_id:WORKSPACE,p_canvas_id:canvasId})
  return {data:{fileIds:input.p_file_ids,sectionIds:[]},error:null}
 })
 mocks.download.mockImplementation(async()=>({data:new Blob([bytes]),error:null}))
})
describe("complete uploaded CSV analysis",()=>{
 it.each(["label","bytes","canvas"])("groups exact CSV labels and invalidates %s changes",async kind=>{
  setText(initial.replace('Multi\nline','pantry'))
  const tools=createKnowledgeTools(context),tableAnalysis={...request,groupByColumn:"column_5"}
  const output=await tools.execute("read_workspace",{...args,tableAnalysis}),item=output.results[0]
  expect(item).toMatchObject({evidence:{tableAnalysis:{request:tableAnalysis,groups:[{label:"Pantry, city",matchedRows:1},{label:"pantry",matchedRows:1}],csv:{contentHash:bytesHash(bytes)}}}})
  expect("content" in item && JSON.parse(item.content)).toMatchObject({budget:"0.30",actual:"0.30",groups:[{label:"Pantry, city",budget:"0.10",actual:"0.20",delta:"0.10"},{label:"pantry",budget:"0.20",actual:"0.10",delta:"-0.10"}]})
  const evidence=tools.sources.get(request.id)!.evidence!.tableAnalysis!
  for(const groups of [undefined,[],[{label:"Pantry, city",matchedRows:1}],[{label:"Pantry, city",matchedRows:1},{label:"Pantry, city",matchedRows:1}]])expect(tableAnalysisEvidenceSchema.safeParse({...evidence,groups}).success).toBe(false)
  expect(tableAnalysisEvidenceSchema.safeParse({...evidence,request}).success).toBe(false)
  expect(tableAnalysisEvidenceSchema.safeParse({...evidence,csv:{...evidence.csv!,columns:evidence.csv!.columns.slice(0,4)}}).success).toBe(false)
  const result=researchResultSchema.parse(JSON.parse(JSON.stringify(saved(tools))))
  await expect(assertResearchSourcesAccessible(context,result,"history")).resolves.toBeUndefined()
  if(kind==="label")setText(initial.replace('Multi\nline','Pantry, city'))
  if(kind==="bytes")setText(initial.replace('Multi\nline','pantry')+'\n')
  if(kind==="canvas")mocks.rpc.mockResolvedValue({data:{fileIds:[],sectionIds:[]},error:null})
  for(const purpose of ["history","apply"] as const)await expect(assertResearchSourcesAccessible(context,result,purpose)).rejects.toThrow()
 })
 it.each([""," Pantry","P\nQ","x".repeat(121)])("withholds ambiguous CSV group %j",async label=>{
  setText(`${header}\n0.10,0.20,USD,2026-10,"${label}"`)
  const tools=createKnowledgeTools(context)
  expect((await tools.execute("read_workspace",{...args,tableAnalysis:{...request,groupByColumn:"column_5"}})).results[0]).toMatchObject({status:"unavailable"})
  expect(tools.dependencies().tableAnalyses).toBeUndefined()
 })
 it("compares complete file months, binds both row counts and invalidates baseline bytes or canvas access",async()=>{
  setText(initial.replace("99,99,EUR","0,-0.20,USD"))
  const tools=createKnowledgeTools(context),tableAnalysis={...request,compareToPeriod:"2026-09"}
  const output=await tools.execute("read_workspace",{...args,tableAnalysis}),item=output.results[0]
  expect(item).toMatchObject({evidence:{tableAnalysis:{request:tableAnalysis,matchedRows:2,comparisonMatchedRows:1,selectedRows:3,csv:{contentHash:bytesHash(bytes)}}}})
  expect("content" in item && JSON.parse(item.content)).toMatchObject({budget:"0.30",actual:"0.30",comparison:{period:"2026-09",budget:"0.00",actual:"-0.20",differences:{budget:"0.30",actual:"0.50",delta:"0.20",definition:"selected_minus_comparison"}}})
  const evidence=tools.sources.get(request.id)!.evidence!.tableAnalysis!
  for(const patch of [{comparisonMatchedRows:undefined},{comparisonMatchedRows:2},{request},{request:{...tableAnalysis,compareToPeriod:"2026-10"}}])expect(tableAnalysisEvidenceSchema.safeParse({...evidence,...patch}).success).toBe(false)
  const result=researchResultSchema.parse(JSON.parse(JSON.stringify(saved(tools))))
  await expect(assertResearchSourcesAccessible(context,result,"history")).resolves.toBeUndefined()
  setText(initial.replace("99,99,EUR","0,-0.30,USD"))
  for(const purpose of ["history","apply"] as const)await expect(assertResearchSourcesAccessible(context,result,purpose)).rejects.toThrow()
  setText(initial.replace("99,99,EUR","0,-0.20,USD"));mocks.rpc.mockResolvedValue({data:{fileIds:[],sectionIds:[]},error:null})
  await expect(assertResearchSourcesAccessible(context,result,"history")).rejects.toThrow()
 })
 it.each(["missing","mixed","invalid","partial"])("withholds %s CSV comparison month",async kind=>{
  let text=initial.replace("99,99,EUR","0,-0.20,USD")
  if(kind==="missing")text=text.replace("2026-09","2026-08")
  if(kind==="mixed")text=text.replace("0,-0.20,USD","0,-0.20,EUR")
  if(kind==="invalid")text=text.replace("0,-0.20,USD","=0,-0.20,USD")
  if(kind==="partial")text=text.replace("0,-0.20,USD,2026-09,Other","0,-0.20,USD,2026-09")
  setText(text);const tools=createKnowledgeTools(context)
  expect((await tools.execute("read_workspace",{...args,tableAnalysis:{...request,compareToPeriod:"2026-09"}})).results[0]).toMatchObject({status:"unavailable"})
  expect(tools.dependencies().tableAnalyses).toBeUndefined()
 })
 it("preserves ordinary text reads, then exact amounts and original-byte evidence without imports",async()=>{
  const before=bytes.slice(),tools=createKnowledgeTools(context)
  const schema=await tools.execute("read_workspace",{ids:[request.id]})
  expect(schema.results[0]).toMatchObject({content:expect.stringContaining(header)})
  expect(JSON.stringify(schema)).toContain("Pantry, city")
  const output=await tools.execute("read_workspace",args),item=output.results[0]
  expect(item).toMatchObject({kind:"document",content:expect.stringContaining('"delta":"0.00"'),evidence:{coverage:"complete",tableAnalysis:{viewId:null,tableId:null,viewRevision:null,selectedRows:3,matchedRows:2,filter:null,csv:{fileId,revision,byteLength:bytes.length,contentHash:bytesHash(bytes),headerRows:1,encoding:"utf-8",delimiter:",",dataRows:3}}}})
  const persisted=researchResultSchema.parse(JSON.parse(JSON.stringify(saved(tools))))
  await expect(assertResearchSourcesAccessible(context,persisted,"history")).resolves.toBeUndefined()
  expect(await tools.revalidate()).toBe(true);expect(bytes).toEqual(before)
  expect(tools.dependencies().nativeFileIds).toContain(fileId)
  expect(mocks.eq).toHaveBeenCalledWith("org_id",WORKSPACE);expect(mocks.eq).toHaveBeenCalledWith("id",fileId)
  expect(query.is).toHaveBeenCalledWith("deleted_at",null);expect(query.is).toHaveBeenCalledWith("document_kind",null)
  for(const [options] of mocks.admin.mock.calls)expect(options).toMatchObject({actorId})
  for(const [path] of mocks.download.mock.calls)expect(path).toBe(file.storage_path)
  expect(JSON.stringify(output)).not.toContain("storage_path");expect(JSON.stringify(output)).not.toContain("/library/")
 })
 it("preserves generic two-column CSV text reads and extraction caching",async()=>{
  setText('Name,Note\n"A, B","=literal formula"')
  const tools=createKnowledgeTools(context)
  expect((await tools.execute("read_workspace",{ids:[request.id]})).results[0]).toMatchObject({content:expect.stringContaining("=literal formula"),contentAvailable:true})
  expect(await tools.revalidate()).toBe(true);expect(mocks.download).toHaveBeenCalledTimes(1)
  expect((await tools.execute("read_workspace",args)).results[0]).toMatchObject({status:"unavailable"})
 })
 it.each(["", " 1", "1 ", "+1", "01", "1,000", "1.000", "1e2", "=1+1", "@SUM(A1)", "$10", "NaN", "Infinity", "1000000000001"])("refuses ambiguous or unsupported amount %j",async value=>{
  setText(`${header}\n"${value}",1,USD,2026-10,P`)
  const tools=createKnowledgeTools(context);expect((await tools.execute("read_workspace",args)).results[0]).toMatchObject({status:"unavailable"})
  expect(tools.sources.size).toBe(0);expect(tools.dependencies().tableAnalyses).toBeUndefined()
 })
 it.each(["quotes","ragged","header-only","duplicate-header","delimiter","null-byte","invalid-utf8","blank-row","mixed-currency","ambiguous-month","missing-amount","over-byte-limit","over-cell-limit","wrong-format","wrong-path","empty"])("refuses %s with no derived result",async kind=>{
  if(kind==="quotes")setText(`${header}\n"0.1,0.2,USD,2026-10,P`)
  if(kind==="ragged")setText(`${header}\n0.1,0.2,USD,2026-10`)
  if(kind==="header-only")setText(header)
  if(kind==="duplicate-header")setText(initial.replace("Budget,Actual","Budget,BUDGET"))
  if(kind==="delimiter")setText(initial.replaceAll(",",";"))
  if(kind==="null-byte")setText(initial+"\u0000")
  if(kind==="invalid-utf8"){bytes=new Uint8Array([255,255]);file.size_bytes=2}
  if(kind==="blank-row")setText(initial+",,,,\n")
  if(kind==="mixed-currency")setText(initial.replace("0.10,USD","0.10,EUR"))
  if(kind==="ambiguous-month")setText(initial.replaceAll("2026-10","10/2026"))
  if(kind==="missing-amount")setText(initial.replace("0.10,0.20",",0.20"))
  if(kind==="over-byte-limit")setText("x".repeat(256001))
  if(kind==="over-cell-limit")setText(`${header}\n1,1,USD,2026-10,${"x".repeat(4001)}`)
  if(kind==="wrong-format")file.mime_type="text/plain"
  if(kind==="wrong-path")file.storage_path="other-org/library/private.csv"
  if(kind==="empty")setText("")
  const tools=createKnowledgeTools(context);expect((await tools.execute("read_workspace",args)).results[0]).toMatchObject({status:"unavailable"})
  expect(tools.sources.size).toBe(0);expect(tools.dependencies().tableAnalyses).toBeUndefined()
 })
 it("reads the complete file beyond the old 20,000 character excerpt, supports BOM/quotes, and enforces 500 records",async()=>{
  const body=Array.from({length:500},()=>`0.10,-0.20,USD,2026-10,"${"x".repeat(45)}, ""quoted"""`).join("\r\n")
  setText(`\uFEFF${header}\r\n${body}`);expect(bytes.length).toBeGreaterThan(20000)
  const tools=createKnowledgeTools(context),result=await tools.execute("read_workspace",args)
  expect(result.results[0]).toMatchObject({content:expect.stringContaining('"budget":"50.00","actual":"-100.00","delta":"-150.00"'),evidence:{tableAnalysis:{selectedRows:500,csv:{contentHash:bytesHash(bytes)}}}})
  setText(`\uFEFF${header}\n${body}\n0.10,0.20,USD,2026-10,P`)
  expect((await createKnowledgeTools(context).execute("read_workspace",args)).results[0]).toMatchObject({status:"unavailable"})
 })
 it.each(["actor-context","canvas-context","membership","actor-source","canvas-source","deleted","revision","path","format","size","partial-download","read-window","cancel"])("fences %s before releasing totals",async kind=>{
  const controller=new AbortController()
  if(kind==="actor-context")mocks.context.mockResolvedValue({...context,user:{id:ID(70)}})
  if(kind==="canvas-context")mocks.context.mockResolvedValue({...context,canvasId:ID(71)})
  if(kind==="membership")mocks.access.mockResolvedValue({hasStorageAccess:false})
  if(kind==="actor-source"||kind==="canvas-source")mocks.rpc.mockResolvedValue({data:{fileIds:[],sectionIds:[]},error:null})
  if(kind==="read-window")mocks.window.mockRejectedValue(Error("closed"))
  if(kind==="partial-download")mocks.download.mockResolvedValue({data:new Blob([bytes.slice(1)]),error:null})
  if(["deleted","revision","path","format","size","cancel"].includes(kind))mocks.download.mockImplementation(async()=>{
   if(kind==="deleted")mocks.single.mockResolvedValue({data:null,error:null})
   if(kind==="revision")file.updated_at="later"
   if(kind==="path")file.storage_path+="other"
   if(kind==="format")file.mime_type="text/plain"
   if(kind==="size")file.size_bytes++
   if(kind==="cancel")controller.abort()
   return {data:new Blob([bytes]),error:null}
  })
  const tools=createKnowledgeTools(context,controller.signal)
  if(["actor-context","canvas-context","cancel"].includes(kind))await expect(tools.execute("read_workspace",args)).rejects.toThrow()
  else expect((await tools.execute("read_workspace",args)).results[0]).toMatchObject({status:kind==="revision"||kind==="path"||kind==="format"||kind==="size"?"changed":"unavailable"})
  expect(tools.sources.size).toBe(0)
  if(["actor-context","canvas-context","membership","actor-source","canvas-source","read-window"].includes(kind))expect(mocks.download).not.toHaveBeenCalled()
 })
 it("rechecks actor AND canvas audience after download",async()=>{
  mocks.download.mockImplementation(async()=>{mocks.rpc.mockResolvedValue({data:{fileIds:[],sectionIds:[]},error:null});return {data:new Blob([bytes]),error:null}})
  const tools=createKnowledgeTools(context);expect((await tools.execute("read_workspace",args)).results[0]).toMatchObject({status:"unavailable"});expect(tools.sources.size).toBe(0)
 })
 it.each(["same-metadata-bytes","revision","revoked","deleted","unselected-row","bom"])("invalidates retained history and apply after %s",async kind=>{
  const tools=createKnowledgeTools(context);await tools.execute("read_workspace",args);const result=saved(tools)
  await expect(assertResearchSourcesAccessible(context,result,"history")).resolves.toBeUndefined()
  if(kind==="same-metadata-bytes")setText(initial.replace("0.10,0.20","0.90,0.20"))
  if(kind==="unselected-row")setText(initial.replace("99,99","98,99"))
  if(kind==="bom")setText("\uFEFF"+initial)
  if(kind==="revision")file.updated_at="later"
  if(kind==="revoked")mocks.rpc.mockResolvedValue({data:{fileIds:[],sectionIds:[]},error:null})
  if(kind==="deleted")mocks.single.mockResolvedValue({data:null,error:null})
  for(const purpose of ["history","apply"] as const)await expect(assertResearchSourcesAccessible(context,result,purpose)).rejects.toThrow()
  expect(await tools.revalidate()).toBe(false)
 })
 it("requires distinct declared roles and preserves the first declaration within a run",async()=>{
  const tools=createKnowledgeTools(context);await tools.execute("read_workspace",args)
  expect((await tools.execute("read_workspace",{...args,tableAnalysis:{...request,period:"2026-09",currency:"EUR"}})).results[0]).toMatchObject({status:"unavailable"})
  expect(tools.dependencies().tableAnalyses).toHaveLength(1)
  expect(()=>calculateCsvBudget(initial,{...request,actualColumn:"column_1"})).toThrow()
  expect(()=>calculateCsvBudget(initial,{...request,period:"2026-08"})).toThrow()
  const evidence=tools.sources.get(request.id)!.evidence!.tableAnalysis!
  for(const patch of [{viewId:ID(6)},{viewRevision:1},{selectedRows:2},{csv:{...evidence.csv!,fileId:ID(7)}},{filter:{column:"column_1",value:"1"}}])
   expect(tableAnalysisEvidenceSchema.safeParse({...evidence,...patch}).success).toBe(false)
 })
})
const config={tariff:{version:"fixture",model:"fixture",inputMicrodollarsPerMillion:1,cachedMicrodollarsPerMillion:0,outputMicrodollarsPerMillion:1,microdollarsPerCredit:2000},maxSearchCalls:0,maxRounds:3,maxOutputTokens:1500,maxInputBytes:20000,maxCredits:20,maxCost:40000}
const response=(params:unknown,output:unknown[])=>{dispatched.push(structuredClone(params));return(async function*(){yield{type:"response.completed",response:{id:"controlled",status:"completed",usage:{input_tokens:100,output_tokens:20,input_tokens_details:{cached_tokens:0}},output}}})()}
it.each(["single","comparison","grouped"])("uses source headers and complete CSV for controlled board readiness (%s)",async mode=>{
 const comparison=mode==="comparison",grouped=mode==="grouped"
 if(grouped)setText(initial.replace("Multi\nline","pantry"))
 if(comparison)setText(initial.replace("99,99,EUR","0,-0.20,USD"))
 const declared=comparison?{...request,compareToPeriod:"2026-09"} : grouped ? {...request,groupByColumn:"column_5"} : request
 const tools=createKnowledgeTools(context),selected=await tools.execute("read_workspace",{ids:[request.id]})
 const input={id:ID(91),parentRunId:ID(92),target:context.target,prompt:grouped?"Review October 2026 budget versus actual grouped by Program, preserving exact labels, in major USD units for board readiness.":comparison?"Compare October 2026 against September 2026 budget versus actual in major USD units for board readiness.":"Review October budget versus actual in major USD units for board readiness.",skill:"planning" as const,tariffVersion:"fixture",maximumCredits:20}
 expect(hasResearchTableSources(context)).toBe(false);expect(hasResearchTableSources(context,selected.results)).toBe(true)
 expect(()=>assertInitialResearchRequestFits(context,input,config,selected.results)).not.toThrow()
 mocks.provider.mockImplementationOnce(params=>response(params,[{type:"function_call",id:"calc",call_id:"calc",name:"read_workspace",arguments:JSON.stringify({...args,tableAnalysis:declared}),status:"completed"}]))
 mocks.provider.mockImplementationOnce(params=>response(params,[{type:"message",role:"assistant",status:"completed",content:[{type:"output_text",text:JSON.stringify({responseKind:"answer",answerEvidenceIds:[request.id],title:"Board readiness",summary:grouped?"October 2026 USD: Pantry, city budget 0.10, actual 0.20, delta 0.10; pantry budget 0.20, actual 0.10, delta -0.10. One row each. Total budget 0.30, actual 0.30, actual minus budget 0.00; all 2 October rows of 3 complete records. Governance approval unverified.":comparison?"October USD budget 0.30, actual 0.30, delta 0.00; September budget 0.00, actual -0.20, delta -0.20. October minus September: budget 0.30, actual 0.50, delta 0.20. Complete 3-record CSV. Governance approval unverified.":"October 2026 USD budget 0.30, actual 0.30; actual minus budget 0.00. Complete 3-record CSV; 2 records match October. Governance approval remains unverified.",questions:[],unfulfilled:["Governance approval"],decisions:[],removeReferences:[],items:[]})}]}]))
 const answer=await runResearchProvider({preparedContext:{tools,records:selected.results},context,request:input,config,onResponse:async()=>{},isCanceled:async()=>false})
 expect(answer.result,JSON.stringify({warnings:mocks.warn.mock.calls,requests:dispatched.map(value=>Buffer.byteLength(JSON.stringify(value))),usage:answer.usage})).toMatchObject({responseKind:"answer",sources:[{evidence:{tableAnalysis:{csv:{fileId,dataRows:3}}}}],dependencies:{tableAnalyses:[{request:declared}],nativeFileIds:[fileId]}})
 expect(dispatched[1]).toMatchObject({tools:[],instructions:expect.stringContaining("answer only")})
 expect(answer.usage).toMatchObject({input:200,output:40,webSearchCalls:0});expect(answer.result?.items).toEqual([])
 for(const dispatch of dispatched){expect(Buffer.byteLength(JSON.stringify(dispatch))).toBeLessThanOrEqual(20000)}
 if(grouped){expect(answer.result?.summary).toContain("Pantry, city budget 0.10");expect(JSON.stringify(mocks.provider.mock.calls[1][0].input)).toContain("groups")}
 if(comparison)expect(JSON.stringify(mocks.provider.mock.calls[1][0].input)).toContain("selected_minus_comparison")
 await expect(assertResearchSourcesAccessible(context,answer.result!,"history")).resolves.toBeUndefined()
})
