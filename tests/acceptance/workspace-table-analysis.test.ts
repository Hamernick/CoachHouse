import { beforeEach, describe, expect, it, vi } from "vitest"
import { execFileSync } from "node:child_process"
const mocks = vi.hoisted(() => ({ load:vi.fn(), context:vi.fn(), rpc:vi.fn(), user:vi.fn(), provider:vi.fn() }))
vi.mock("@/lib/organization/particle-ai-origins",()=>({retainedParticleFiles:async()=>new Map(),retainedParticleDocuments:async()=>new Map()}))
vi.mock("@/lib/organization/particle-file-dependencies",()=>({particleNativeFileDependencies:()=>new Map(),nativeFilesForRecords:()=>[],inaccessibleNativeFiles:async()=>new Set()}))
vi.mock("@/features/workspace-ai/server/research-context",()=>({loadResearchContext:mocks.context}))
vi.mock("@/features/workspace-ai/server/knowledge-records",async original=>({...await original<typeof import("@/features/workspace-ai/server/knowledge-records")>(),knowledgeLoader:()=>mocks.load}))
vi.mock("@/lib/supabase/server",()=>({createSupabaseServerClient:async()=>({auth:{getUser:mocks.user},rpc:mocks.rpc})}))
vi.mock("openai",()=>({default:class {responses={create:mocks.provider}}}))
import { calculateTableBudget, tableAnalysisSnapshotSchema, type TableAnalysisSnapshot } from "@/features/workspace-data-views/lib/table-analysis"
import { readTableAnalysisSnapshot } from "@/features/workspace-data-views/server/table-analysis"
import { createKnowledgeTools } from "@/features/workspace-ai/server/knowledge-tools"
import { particleKnowledgeRecord } from "@/features/workspace-ai/server/knowledge-records"
import { assertResearchSourcesAccessible } from "@/features/workspace-ai/server/research-result-access"
import { runResearchProvider } from "@/features/workspace-ai/server/research-provider"
import { knowledgeReadSchema, researchResultSchema } from "@/features/workspace-ai/research-types"
import { validateKnowledgeToolResult } from "@/features/workspace-ai/lib/knowledge-tool-contract"
import type { ResearchContext } from "@/features/workspace-ai/server/research-context"
import { graph, particle, ID } from "./fixtures/particle-fixtures"
const id=(n:number)=>`10000000-0000-4000-8000-${String(n).padStart(12,"0")}`
const tableParticle={...particle(2),type:"activity" as const,title:"October budget and actuals",data:{template:"task" as const,steps:[],widget:{kind:"data_view" as const,viewId:id(2001)}}}
const context={user:{id:id(1)},canvasId:null,target:{organizationId:id(1),objectiveId:ID(1),revision:0},graph:graph([particle(1,"objective"),tableParticle]),objective:particle(1,"objective")} as ResearchContext
const record=particleKnowledgeRecord(tableParticle)
const request={id:record.id,budgetColumn:"budget",actualColumn:"actual",currencyColumn:"currency",periodColumn:"period",currency:"USD" as const,amountUnit:"major" as const,period:"2026-10"}
const args={ids:[record.id],tableAnalysis:request}
const values=(budget=0.1,actual=0.2)=>({budget,actual,currency:"USD",period:"2026-10"})
const columns=[{key:"budget",label:"Budget",type:"number"},{key:"actual",label:"Actual",type:"number"},{key:"currency",label:"Currency",type:"text"},{key:"period",label:"Period",type:"text"}].map(col=>({...col,options:[],writable:true}))
const base=()=>tableAnalysisSnapshotSchema.parse({view:{id:id(2001),name:"Board finance",revision:1,source:"table",tableId:id(2002),config:{columns:columns.map(col=>col.key),filter:null,sort:{column:"budget",direction:"asc"}}},columns,
 rows:[{id:id(2010),revision:"1",values:values()},{id:id(2011),revision:"1",values:values(0.2,0.1)},{id:id(2012),revision:"1",values:{...values(999,999),period:"2026-09"}}],total:3,complete:true})
let snapshot:TableAnalysisSnapshot
let dispatched:unknown[]=[]
const url=process.env.TABLE_ANALYSIS_DATABASE_URL
const sql=(input:string)=>execFileSync("psql",["-XqAt","-v","ON_ERROR_STOP=1","-d",url!],{input,encoding:"utf8",env:{...process.env,PGOPTIONS:"-c statement_timeout=5000 -c coach_house.workspace_sharing_fixture=isolated-test-only"}}).trim()
const auth=(actor=1)=>`set role authenticated;set request.jwt.claim.sub='${id(actor)}';`
const quote=(value:unknown)=>`'${JSON.stringify(value).replaceAll("'","''")}'::jsonb`
const command=(value:unknown)=>`${auth()}select public.workspace_data_view_command(${quote(value)});`
beforeEach(()=>{
 vi.clearAllMocks();dispatched=[];snapshot=base();mocks.context.mockResolvedValue(context);mocks.load.mockResolvedValue(context.graph.particles.map(particleKnowledgeRecord));mocks.user.mockResolvedValue({data:{user:{id:id(1)}},error:null})
 mocks.rpc.mockImplementation((name,params)=>({abortSignal:async()=>{
   if(name==="read_workspace_table_analysis")return {data:snapshot,error:null}
   if(name==="workspace_data_view_command"&&params.p_command.action==="read"){const {complete:_complete,...page}=snapshot;return {data:{...page,page:0,canEdit:true,provenance:null},error:null}}
   throw Error("Unexpected read")
 }}))
})
describe("exact complete table calculations",()=>{
 it("adds decimal cents exactly, selects the complete month, and labels signed deltas",()=>{
  expect(calculateTableBudget(snapshot,request)).toEqual({budget:"0.30",actual:"0.30",delta:"0.00",matchedRows:2,deltaDefinition:"actual_minus_budget"})
  snapshot.rows[1].values.actual=-0.2
  expect(calculateTableBudget(snapshot,request)).toMatchObject({actual:"0.00",delta:"-0.30"})
 })
 it.each([null,"1.00","$1,000.00",true,0.001,0.1+0.2,1e13,NaN,Infinity])("refuses ambiguous or lossy selected amount %s",amount=>{
  snapshot.rows[0].values.actual=amount as number
  expect(()=>calculateTableBudget(snapshot,request)).toThrow()
 })
 it.each(["mixed","period","type","empty","partial","duplicate","over-limit"])("refuses %s inputs without returning totals",kind=>{
  if(kind==="mixed")snapshot.rows[1].values.currency="EUR"
  if(kind==="period")snapshot.rows[1].values.period="10/2026"
  if(kind==="type")snapshot.columns[0].type="text"
  if(kind==="empty")snapshot.rows=snapshot.rows.filter(row=>row.values.period==="2026-09"),snapshot.total=1
  if(kind==="partial")snapshot.total++
  if(kind==="duplicate")snapshot.rows[1].id=snapshot.rows[0].id
  if(kind==="over-limit")snapshot.total=501
  expect(()=>calculateTableBudget(snapshot,request)).toThrow()
 })
 it("requires explicit distinct columns and bounded supported currency/month",()=>{
  for(const patch of [{amountUnit:"cents"},{actualColumn:"budget"},{period:"2026-13"},{currency:"JPY"},{period:"2026"},{budgetColumn:"sum(budget)"}])expect(knowledgeReadSchema.safeParse({...args,tableAnalysis:{...request,...patch}}).success).toBe(false)
 })
})
describe("bounded exact-label grouped totals",()=>{
 const grouped={...request,groupByColumn:"program"}
 const setup=()=>{
  snapshot.columns.push({key:"program",label:"Program",type:"text",options:[],writable:true})
  snapshot.rows[0].values.program="Pantry";snapshot.rows[1].values.program="pantry"
 }
 it("preserves case-distinct labels, exact negative/zero subtotals and full-month reconciliation",()=>{
  setup();snapshot.rows[1].values.actual=-0.2
  const result=calculateTableBudget(snapshot,grouped)
  expect(result).toEqual({budget:"0.30",actual:"0.00",delta:"-0.30",matchedRows:2,deltaDefinition:"actual_minus_budget",groups:[
   {label:"Pantry",budget:"0.10",actual:"0.20",delta:"0.10",matchedRows:1,deltaDefinition:"actual_minus_budget"},
   {label:"pantry",budget:"0.20",actual:"-0.20",delta:"-0.40",matchedRows:1,deltaDefinition:"actual_minus_budget"}]})
  snapshot.rows[1].values.program="Pantry"
  expect(calculateTableBudget(snapshot,grouped).groups).toEqual([{label:"Pantry",budget:"0.30",actual:"0.00",delta:"-0.30",matchedRows:2,deltaDefinition:"actual_minus_budget"}])
  snapshot.rows[0].values.budget=1e12;snapshot.rows[1].values.budget=1e12
  expect(calculateTableBudget(snapshot,grouped).groups?.[0].budget).toBe("2000000000000.00")
 })
 it.each([null,""," "," Pantry","Pantry ","P\nQ","P\u200bQ","e\u0301",42,true,["Pantry"],"x".repeat(121)])("refuses missing or ambiguous selected labels %j",label=>{
  setup();snapshot.rows[0].values.program=label as string
  expect(()=>calculateTableBudget(snapshot,grouped)).toThrow()
 })
 it("requires a distinct text/select grouping column and one month",()=>{
  setup()
  for(const patch of [{groupByColumn:"budget"},{groupByColumn:"missing"},{compareToPeriod:"2026-09"}])expect(()=>calculateTableBudget(snapshot,{...grouped,...patch})).toThrow()
  const col=snapshot.columns.at(-1)!;col.type="number"
  expect(()=>calculateTableBudget(snapshot,grouped)).toThrow()
  col.type="select";col.options=["Pantry","pantry"]
  expect(calculateTableBudget(snapshot,grouped).groups).toHaveLength(2)
  col.options=["Pantry"]
  expect(()=>calculateTableBudget(snapshot,grouped)).toThrow()
 })
 it("includes every row up to the group bound and refuses overflow without an Other bucket",()=>{
  setup();snapshot.rows=Array.from({length:20},(_,i)=>({id:id(4000+i),revision:"1",values:{...values(),program:`Group ${i}`}}));snapshot.total=20
  const result=calculateTableBudget(snapshot,grouped)
  expect(result).toMatchObject({budget:"2.00",actual:"4.00",matchedRows:20});expect(result.groups).toHaveLength(20)
  snapshot.rows.push({id:id(5000),revision:"1",values:{...values(),program:"Overflow"}});snapshot.total++
  expect(()=>calculateTableBudget(snapshot,grouped)).toThrow("Too many groups")
 })
 it("reconciles all 500 selected rows with exact repeated-group arithmetic",()=>{
  setup();snapshot.rows=Array.from({length:500},(_,i)=>({id:id(6000+i),revision:"1",values:{...values(0.1,-0.2),program:i%2 ? "A" : "B"}}));snapshot.total=500
  const result=calculateTableBudget(snapshot,grouped)
  expect(result).toMatchObject({budget:"50.00",actual:"-100.00",delta:"-150.00",matchedRows:500})
  expect(result.groups).toEqual(["B","A"].map(label=>({label,budget:"25.00",actual:"-50.00",delta:"-75.00",matchedRows:250,deltaDefinition:"actual_minus_budget"})))
 })
 it("withholds grouped output that exceeds the unchanged read budget",async()=>{
  setup();snapshot.rows=Array.from({length:20},(_,i)=>({id:id(7000+i),revision:"1",values:{...values(1e12,-1e12),program:`${i}${'"'.repeat(118)}`}}));snapshot.total=20
  const tools=createKnowledgeTools(context)
  expect((await tools.execute("read_workspace",{...args,tableAnalysis:grouped})).results[0]).toMatchObject({status:"unavailable"})
  expect(tools.sources.size).toBe(0);expect(tools.dependencies().tableAnalyses).toBeUndefined()
 })
 it.each(["label","filter","access","partial"])("retains grouping and invalidates %s changes",async kind=>{
  setup();const tools=createKnowledgeTools(context)
  const output=await tools.execute("read_workspace",{...args,tableAnalysis:grouped})
  expect(output.results[0]).toMatchObject({evidence:{tableAnalysis:{request:grouped,groups:[{label:"Pantry",matchedRows:1},{label:"pantry",matchedRows:1}]}}})
  const result=researchResultSchema.parse({runId:ID(91),target:context.target,responseKind:"answer",answerEvidenceIds:[record.id],title:"Grouped totals",summary:"Exact groups.",questions:[],unfulfilled:[],items:[],decisions:[],removeReferences:[],sources:[...tools.sources.values()],dependencies:tools.dependencies()})
  await expect(assertResearchSourcesAccessible(context,result,"history")).resolves.toBeUndefined()
  if(kind==="label")snapshot.rows[0].values.program="Changed"
  if(kind==="filter")snapshot.view.config.filter={column:"program",value:"Pantry"}
  if(kind==="access")mocks.load.mockResolvedValue([])
  if(kind==="partial")snapshot.total++
  for(const purpose of ["history","apply"] as const)await expect(assertResearchSourcesAccessible(context,result,purpose)).rejects.toThrow()
 })
})

describe("explicit month comparison",()=>{
 const comparison={...request,compareToPeriod:"2026-09"}
 it("calculates exact per-month amounts and signed selected-minus-comparison differences",()=>{
  snapshot.rows[2].values= {...values(0,-0.2),period:"2026-09"}
  expect(calculateTableBudget(snapshot,comparison)).toEqual({budget:"0.30",actual:"0.30",delta:"0.00",matchedRows:2,deltaDefinition:"actual_minus_budget",
   comparison:{period:"2026-09",budget:"0.00",actual:"-0.20",delta:"-0.20",matchedRows:1,deltaDefinition:"actual_minus_budget",differences:{budget:"0.30",actual:"0.50",delta:"0.20",definition:"selected_minus_comparison"}}})
  snapshot.rows[2].values={...values(1e12,1e12),period:"2026-09"}
  expect(calculateTableBudget(snapshot,comparison).comparison?.differences).toMatchObject({budget:"-999999999999.70",actual:"-999999999999.70",delta:"0.00"})
 })
 it.each(["2026-10","2026-11","2026-13","2026","", "2026-9"])("rejects invalid or non-earlier comparison %s",compareToPeriod=>{
  expect(knowledgeReadSchema.safeParse({...args,tableAnalysis:{...request,compareToPeriod}}).success).toBe(false)
 })
 it.each(["missing","mixed","invalid-amount","partial"])("refuses %s baseline without partial results",kind=>{
  if(kind==="missing")snapshot.rows[2].values.period="2026-08"
  if(kind==="mixed")snapshot.rows[2].values.currency="EUR"
  if(kind==="invalid-amount")snapshot.rows[2].values.budget=null
  if(kind==="partial")snapshot.total++
  expect(()=>calculateTableBudget(snapshot,comparison)).toThrow()
 })
 it("retains both months atomically and invalidates changed baseline or lost access",async()=>{
  const tools=createKnowledgeTools(context)
  const output=await tools.execute("read_workspace",{...args,tableAnalysis:comparison})
  expect(output.results[0]).toMatchObject({evidence:{tableAnalysis:{request:comparison,matchedRows:2,comparisonMatchedRows:1,selectedRows:3}}})
  expect(JSON.stringify(output)).toContain("selected_minus_comparison")
  const result=researchResultSchema.parse({runId:ID(91),target:context.target,responseKind:"answer",answerEvidenceIds:[record.id],title:"Comparison",summary:"Two months.",questions:[],unfulfilled:[],items:[],decisions:[],removeReferences:[],sources:[...tools.sources.values()],dependencies:tools.dependencies()})
  await expect(assertResearchSourcesAccessible(context,result,"history")).resolves.toBeUndefined()
  snapshot.rows[2].values.actual=1000
  for(const purpose of ["history","apply"] as const)await expect(assertResearchSourcesAccessible(context,result,purpose)).rejects.toThrow()
  snapshot=base();mocks.load.mockResolvedValue([])
  await expect(assertResearchSourcesAccessible(context,result,"history")).rejects.toThrow()
 })
})

describe("authorized tool and retained financial evidence",()=>{
 it("reads schema, then returns exact totals with selection, source revision, and persisted dependencies",async()=>{
  const tools=createKnowledgeTools(context)
  const metadata=await tools.execute("read_workspace",{ids:[record.id]})
  expect(metadata.results[0]).toMatchObject({content:expect.stringContaining('"columns"')})
  const output=await tools.execute("read_workspace",args)
  expect(output.results[0]).toMatchObject({content:expect.stringContaining('"delta":"0.00"'),evidence:{tableAnalysis:{complete:true,selectedRows:3,matchedRows:2,filter:null,viewRevision:1,sourceRevision:expect.stringMatching(/^[a-f0-9]{64}$/)}}})
  expect(tools.dependencies().tableAnalyses).toHaveLength(1)
  expect(tools.sources.get(record.id)?.evidence?.tableAnalysis?.request).toEqual(request)
  expect(await tools.revalidate()).toBe(true)
  snapshot.rows[0].values.actual=12
  expect(await tools.revalidate()).toBe(false)
  expect((await tools.execute("read_workspace",args)).results[0]).toMatchObject({status:"changed"})
 })
 it("preserves the original citation when a second declaration targets the same source",async()=>{
  const tools=createKnowledgeTools(context);await tools.execute("read_workspace",args)
  expect((await tools.execute("read_workspace",{...args,tableAnalysis:{...request,period:"2026-09"}})).results[0]).toMatchObject({status:"unavailable"})
  expect(tools.sources.get(record.id)?.evidence?.tableAnalysis?.request.period).toBe("2026-10")
  expect(tools.dependencies().tableAnalyses).toHaveLength(1)
 })
 it.each(["denied","actor","partial","wrong-view","unsupported","budget"])("withholds %s results",async kind=>{
  if(kind==="denied")mocks.rpc.mockImplementation(()=>({abortSignal:async()=>({data:null,error:{code:"42501"}})}))
  if(kind==="actor")mocks.user.mockResolvedValue({data:{user:{id:id(2)}},error:null})
  if(kind==="partial")snapshot.total++
  if(kind==="wrong-view")snapshot.view.id=id(3)
  if(kind==="unsupported")snapshot.view.source="sheets"
  const tools=createKnowledgeTools(context), result=await tools.execute("read_workspace",args,kind==="budget"?1:6000)
  expect(result.results[0]).toMatchObject({status:"unavailable"})
  expect(tools.sources.size).toBe(0);expect(tools.dependencies().tableAnalyses).toBeUndefined()
 })
 it("rejects cross-reference/forged result scopes and canceled reads",async()=>{
  const tools=createKnowledgeTools(context)
  await expect(tools.execute("read_workspace",{...args,ids:[`particle:${ID(3)}`]})).rejects.toThrow()
  const output=await tools.execute("read_workspace",args)
  expect(()=>validateKnowledgeToolResult("read_workspace",output,output.scope,{ids:[record.id]})).toThrow(/scope/)
  const controller=new AbortController();controller.abort()
  await expect(readTableAnalysisSnapshot(id(1),id(2001),id(1),controller.signal)).rejects.toThrow()
 })
 it("withholds persisted answers after row/filter changes and access revocation",async()=>{
  const tools=createKnowledgeTools(context);await tools.execute("read_workspace",args)
  const result=researchResultSchema.parse({runId:ID(91),target:context.target,responseKind:"answer",answerEvidenceIds:[record.id],title:"Board finance",summary:"USD 0.30 budget and actual.",questions:[],unfulfilled:[],items:[],decisions:[],removeReferences:[],sources:[...tools.sources.values()],dependencies:tools.dependencies()})
  await expect(assertResearchSourcesAccessible(context,result,"history")).resolves.toBeUndefined()
  snapshot.rows[0].revision="2"
  await expect(assertResearchSourcesAccessible(context,result,"history")).rejects.toThrow()
  snapshot=base();snapshot.view.config.filter={column:"period",value:"2026-10"}
  await expect(assertResearchSourcesAccessible(context,result,"history")).rejects.toThrow()
  snapshot=base();mocks.load.mockResolvedValue([])
  await expect(assertResearchSourcesAccessible(context,result,"history")).rejects.toThrow()
 })
})

const response=(params:unknown,output:unknown[]) => { dispatched.push(structuredClone(params)); return (async function*(){yield {type:"response.completed",response:{id:"controlled",status:"completed",usage:{input_tokens:100,output_tokens:20,input_tokens_details:{cached_tokens:0}},output}}})() }
async function boardAnswer() {
 const tools=createKnowledgeTools(context)
 mocks.provider.mockImplementationOnce(params=>response(params,[{type:"function_call",id:"schema",call_id:"schema",name:"read_workspace",arguments:JSON.stringify({ids:[record.id]}),status:"completed"}]))
 mocks.provider.mockImplementationOnce(params=>response(params,[{type:"function_call",id:"tool1",call_id:"call1",name:"read_workspace",arguments:JSON.stringify(args),status:"completed"}]))
 mocks.provider.mockImplementationOnce(params=>response(params,[{type:"message",role:"assistant",status:"completed",content:[{type:"output_text",text:JSON.stringify({responseKind:"answer",answerEvidenceIds:[record.id],title:"Board budget readiness",summary:"October 2026 USD budget 0.30, actual 0.30; actual minus budget 0.00. Complete saved view, 2 matching rows. Governance approval remains unverified.",questions:[],unfulfilled:["Governance approval"],decisions:[],removeReferences:[],items:[]})}]}]))
 return runResearchProvider({preparedContext:{tools,records:[]},context,request:{id:ID(91),parentRunId:ID(92),target:context.target,prompt:"Review October budget versus actual for board readiness.",skill:"planning",tariffVersion:"fixture",maximumCredits:20},config:{tariff:{version:"fixture",model:"fixture",inputMicrodollarsPerMillion:1,cachedMicrodollarsPerMillion:0,outputMicrodollarsPerMillion:1,microdollarsPerCredit:2000},maxSearchCalls:0,maxRounds:3,maxOutputTokens:1500,maxInputBytes:20000,maxCredits:20,maxCost:40000},onResponse:async()=>{},isCanceled:async()=>false})
}
it("carries exact calculations through the controlled model and answer binding within existing accounting",async()=>{
 const answer=await boardAnswer()
 expect(answer.result).toMatchObject({responseKind:"answer",sources:[{id:record.id,evidence:{tableAnalysis:{matchedRows:2}}}],dependencies:{tableAnalyses:[{request}]}})
 expect(answer.usage).toMatchObject({input:300,output:60,webSearchCalls:0})
 for(const call of dispatched)expect(Buffer.byteLength(JSON.stringify(call))).toBeLessThanOrEqual(20000)
 const output=JSON.stringify(mocks.provider.mock.calls[2][0].input)
 expect(output).toContain('sourceRevision');expect(output).toContain('actual_minus_budget')
})

it.skipIf(Boolean(url))("qualifies the native snapshot against a disposable database",()=>{
 const output=execFileSync(process.execPath,["supabase/tests/workspace-table-analysis.test.mjs"],{encoding:"utf8",env:process.env,timeout:120000,stdio:["pipe","pipe","pipe"]})
 expect(output).toContain('"nativeOwnerUnchanged":true')
},120000)

describe.skipIf(!url)("actual native SQL snapshot owner",()=>{
 beforeEach(()=>{
  sql("select public.fixture_data_views();")
  sql(command({action:"create_view",organizationId:id(1),viewId:id(2001),requestId:id(2100),name:"Board finance",source:{kind:"new_table",columns,rows:base().rows.map(row=>row.values),provenance:{kind:"new",filename:null,rowCount:3},audienceConfirmed:true}}))
  mocks.rpc.mockImplementation((name,params)=>({abortSignal:async()=>{
   try{return {data:JSON.parse(sql(name==="read_workspace_table_analysis"?`${auth()}select public.read_workspace_table_analysis('${params.p_org}','${params.p_view}');`:command(params.p_command))),error:null}}
   catch{return {data:null,error:{code:"42501"}}}
  }}))
 })
 it("uses actual canonical writes, SQL snapshot, tools, model answer and history revalidation",async()=>{
  const answer=await boardAnswer();expect(answer.result?.dependencies?.tableAnalyses).toHaveLength(1)
  expect(answer.result?.sources[0].evidence?.tableAnalysis).toMatchObject({selectedRows:3,matchedRows:2,complete:true})
  await expect(assertResearchSourcesAccessible(context,answer.result!,"history")).resolves.toBeUndefined()
  const current=await readTableAnalysisSnapshot(id(1),id(2001),id(1))
  sql(command({action:"edit_cell",organizationId:id(1),viewId:id(2001),requestId:id(2101),rowId:current.rows[0].id,revision:current.rows[0].revision,column:"actual",value:42}))
  await expect(assertResearchSourcesAccessible(context,answer.result!,"history")).rejects.toThrow()
 })
 it("covers all pages, matches saved case-insensitive filters, and rejects >500 selected rows",async()=>{
  const current=await readTableAnalysisSnapshot(id(1),id(2001),id(1))
  sql(`insert into public.organization_data_rows(org_id,table_id,values) select '${id(1)}','${current.view.tableId}',${quote(values(1,2))} from generate_series(1,497);`)
  expect((await readTableAnalysisSnapshot(id(1),id(2001),id(1))).total).toBe(500)
  sql(command({action:"save_view",organizationId:id(1),viewId:id(2001),requestId:id(2101),revision:1,config:{...current.view.config,filter:{column:"period",value:"2026-09"}}}))
  expect((await readTableAnalysisSnapshot(id(1),id(2001),id(1))).rows).toHaveLength(1)
  sql(command({action:"save_view",organizationId:id(1),viewId:id(2001),requestId:id(2102),revision:2,config:current.view.config}))
  sql(`insert into public.organization_data_rows(org_id,table_id,values) values('${id(1)}','${current.view.tableId}',${quote(values())});`)
  await expect(readTableAnalysisSnapshot(id(1),id(2001),id(1))).rejects.toThrow()
 })
 it("rechecks the actual member grant after a retained calculation",async()=>{
  sql(`insert into public.organization_memberships(org_id,member_id,role) values('${id(1)}','${id(14)}','staff') on conflict(org_id,member_id) do update set role='staff';`)
  mocks.user.mockResolvedValue({data:{user:{id:id(14)}},error:null})
  mocks.rpc.mockImplementation((_name,params)=>({abortSignal:async()=>{
   try{return {data:JSON.parse(sql(`${auth(14)}select public.read_workspace_table_analysis('${params.p_org}','${params.p_view}');`)),error:null}}catch{return {data:null,error:{code:"42501"}}}
  }}))
  const member={...context,user:{id:id(14)}} as ResearchContext
  mocks.context.mockResolvedValue(member)
  const tools=createKnowledgeTools(member);expect((await tools.execute("read_workspace",args)).results[0]).toHaveProperty("content")
  expect(await tools.revalidate()).toBe(true)
  sql(`delete from public.organization_memberships where org_id='${id(1)}' and member_id='${id(14)}';`)
  expect(await tools.revalidate()).toBe(false)
  expect((await tools.execute("read_workspace",args)).results[0]).toHaveProperty("status","unavailable")
 })
 it("refuses over-byte snapshots instead of publishing partial totals",async()=>{
  const current=await readTableAnalysisSnapshot(id(1),id(2001),id(1))
  sql(`insert into public.organization_data_rows(org_id,table_id,values) select '${id(1)}','${current.view.tableId}',jsonb_build_object('budget',1,'actual',2,'period','2026-10','currency',repeat('x',10000)) from generate_series(1,101);`)
  await expect(readTableAnalysisSnapshot(id(1),id(2001),id(1))).rejects.toThrow()
 })
 it("denies anonymous/service/outsider/cross-organization reads and preserves existing rows",()=>{
  const before=sql("select jsonb_agg(to_jsonb(r) order by id) from public.organization_data_rows r;")
  for(const prefix of ["set role anon;","set role service_role;",auth(18)])expect(()=>sql(`${prefix}select public.read_workspace_table_analysis('${id(1)}','${id(2001)}');`)).toThrow()
  expect(()=>sql(`${auth()}select public.read_workspace_table_analysis('${id(2)}','${id(2001)}');`)).toThrow()
  expect(sql("select jsonb_agg(to_jsonb(r) order by id) from public.organization_data_rows r;")).toBe(before)
 })
})
