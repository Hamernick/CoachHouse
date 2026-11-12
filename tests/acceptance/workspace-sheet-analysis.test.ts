import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
const mocks=vi.hoisted(()=>({load:vi.fn(),context:vi.fn(),rpc:vi.fn(),native:vi.fn(),user:vi.fn(),single:vi.fn(),eq:vi.fn(),refresh:vi.fn(),file:vi.fn(),decrypt:vi.fn(),provider:vi.fn(),fetch:vi.fn()}))
vi.mock("@/lib/organization/particle-ai-origins",()=>({retainedParticleFiles:async()=>new Map(),retainedParticleDocuments:async()=>new Map()}))
vi.mock("@/lib/organization/particle-file-dependencies",()=>({particleNativeFileDependencies:()=>new Map(),nativeFilesForRecords:()=>[],inaccessibleNativeFiles:async()=>new Set()}))
vi.mock("@/features/workspace-ai/server/research-context",()=>({loadResearchContext:mocks.context}))
vi.mock("@/features/workspace-ai/server/knowledge-records",async original=>({...await original<typeof import("@/features/workspace-ai/server/knowledge-records")>(),knowledgeLoader:()=>mocks.load}))
vi.mock("@/lib/supabase/server",()=>({createSupabaseServerClient:async()=>({auth:{getUser:mocks.user},rpc:mocks.native})}))
vi.mock("@/lib/supabase/admin",()=>({createSupabaseAdminClient:()=>({rpc:mocks.rpc,from:()=>{const query={select:()=>query,update:()=>query,eq:(...args:unknown[])=>{mocks.eq(...args);return query},maybeSingle:mocks.single};return query}})}))
vi.mock("@/features/google-drive/server/google-api",()=>({refreshGoogleDriveAccessToken:mocks.refresh,getGoogleDriveFile:mocks.file}))
vi.mock("@/features/google-drive/server/token-crypto",()=>({decryptGoogleDriveSecret:mocks.decrypt}))
vi.mock("openai",()=>({default:class {responses={create:mocks.provider}}}))
import { createKnowledgeTools } from "@/features/workspace-ai/server/knowledge-tools"
import { particleKnowledgeRecord } from "@/features/workspace-ai/server/knowledge-records"
import { assertResearchSourcesAccessible } from "@/features/workspace-ai/server/research-result-access"
import { runResearchProvider } from "@/features/workspace-ai/server/research-provider"
import { readTableAnalysisSnapshot } from "@/features/workspace-data-views/server/table-analysis"
import { researchResultSchema } from "@/features/workspace-ai/research-types"
import type { ResearchContext } from "@/features/workspace-ai/server/research-context"
import { graph, particle, ID } from "./fixtures/particle-fixtures"
const hash=(value:unknown)=>createHash("sha256").update(JSON.stringify(value)).digest("hex")
const id=(n:number)=>`10000000-0000-4000-8000-${String(n).padStart(12,"0")}`
const tableParticle={...particle(2),type:"activity" as const,title:"October budget and actuals",data:{template:"task" as const,steps:[],widget:{kind:"data_view" as const,viewId:id(2001)}}}
const context={user:{id:id(1)},canvasId:null,target:{organizationId:id(1),objectiveId:ID(1),revision:0},graph:graph([particle(1,"objective"),tableParticle]),objective:particle(1,"objective")} as ResearchContext
const record=particleKnowledgeRecord(tableParticle)
const request={id:record.id,budgetColumn:"column_1",actualColumn:"column_2",currencyColumn:"column_3",periodColumn:"column_4",currency:"USD" as const,amountUnit:"major" as const,period:"2026-10"}
const args={ids:[record.id],tableAnalysis:request}
const range={spreadsheetId:"isolated-sheet-fixture",sheetId:7,startRow:3,rowCount:5,startColumn:2,columnCount:5}
const headers=["Budget","Actual","Currency","Month","Program"]
const base=()=>({source:{...range},headerHash:hash(headers),canEdit:false,view:{id:id(2001),name:"Board finance",revision:1,source:"sheets",tableId:null,config:{columns:headers.map((_,i)=>`column_${i+1}`),filter:{column:"column_5",value:"PANTRY"},sort:{column:"column_1",direction:"asc"}}}})
type Cell={formattedValue?:string;effectiveValue?:{numberValue?:number;stringValue?:string;boolValue?:boolean;errorValue?:unknown};effectiveFormat?:{numberFormat:{type:string}}}
const cell=(value:string|number|boolean|null):Cell=>value===null?{}:{formattedValue:String(value),effectiveValue:typeof value==="number"?{numberValue:value}:typeof value==="boolean"?{boolValue:value}:{stringValue:value}}
const row=(...values:(string|number|boolean|null)[])=>({values:values.map(cell)})
const payload=()=>({spreadsheetId:range.spreadsheetId,properties:{title:"Board finance"},sheets:[{properties:{sheetId:7,title:"Actuals",sheetType:"GRID",gridProperties:{rowCount:100,columnCount:20}},data:[{startRow:2,startColumn:1,rowData:[row(...headers),row(0.1,0.2,"USD","2026-10","Pantry"),row(0.2,0.1,"USD","2026-10","pantry"),row(99,99,"EUR","2026-09","Pantry"),row(999,999,"USD","2026-10","Other")]}]}]})
const connection={connected_at:"2026-11-02T00:00:00Z",id:"connection-viewer",google_subject:"viewer-subject",google_email:"viewer@example.org",refresh_token_ciphertext:"viewer-cipher",refresh_token_iv:"iv",refresh_token_auth_tag:"tag",key_version:1}
const file={status:"available",mimeType:"application/vnd.google-apps.spreadsheet",version:"41",modifiedAt:"2026-11-11T00:00:00Z"}
let meta=base(),body=payload(),dispatched:unknown[]=[]
const saved=(tools:ReturnType<typeof createKnowledgeTools>)=>researchResultSchema.parse({runId:ID(91),target:context.target,responseKind:"answer",answerEvidenceIds:[record.id],title:"Board finance",summary:"USD 0.30 budget and actual.",questions:[],unfulfilled:[],items:[],decisions:[],removeReferences:[],sources:[...tools.sources.values()],dependencies:tools.dependencies()})
beforeEach(()=>{
 vi.clearAllMocks();meta=base();body=payload();dispatched=[];vi.stubGlobal("fetch",mocks.fetch)
 mocks.context.mockResolvedValue(context);mocks.load.mockResolvedValue(context.graph.particles.map(particleKnowledgeRecord));mocks.user.mockResolvedValue({data:{user:{id:id(1)}},error:null})
 mocks.native.mockImplementation(()=>({abortSignal:async()=>({data:null,error:{code:"42501"}})}))
 mocks.rpc.mockImplementation(()=>({abortSignal:async()=>({data:structuredClone(meta),error:null})}))
 mocks.single.mockResolvedValue({data:connection,error:null});mocks.refresh.mockResolvedValue("viewer-access");mocks.decrypt.mockReturnValue("viewer-refresh");mocks.file.mockResolvedValue(file)
 mocks.fetch.mockImplementation(async()=>Response.json(body))
})
afterEach(()=>vi.unstubAllGlobals())
describe("bounded connected Sheet budget analysis",()=>{
 it.each(["label","filter","account","access"])("groups the complete Sheet filter without case merging and invalidates %s",async kind=>{
  const tools=createKnowledgeTools(context),tableAnalysis={...request,groupByColumn:"column_5"}
  const output=await tools.execute("read_workspace",{...args,tableAnalysis}),item=output.results[0]
  expect(item).toMatchObject({evidence:{tableAnalysis:{request:tableAnalysis,selectedRows:3,groups:[{label:"Pantry",matchedRows:1},{label:"pantry",matchedRows:1}],sheet:{range,providerVersion:"41"}}}})
  expect("content" in item && JSON.parse(item.content)).toMatchObject({budget:"0.30",actual:"0.30",groups:[{label:"Pantry",budget:"0.10",actual:"0.20",delta:"0.10"},{label:"pantry",budget:"0.20",actual:"0.10",delta:"-0.10"}]})
  const result=saved(tools);await expect(assertResearchSourcesAccessible(context,result,"history")).resolves.toBeUndefined()
  if(kind==="label")body.sheets[0].data[0].rowData[1].values[4]=cell("PANTRY")
  if(kind==="filter")meta.view.config.filter.value="Other"
  if(kind==="account")mocks.single.mockResolvedValue({data:{...connection,google_subject:"replaced"},error:null})
  if(kind==="access")mocks.load.mockResolvedValue([])
  for(const purpose of ["history","apply"] as const)await expect(assertResearchSourcesAccessible(context,result,purpose)).rejects.toThrow()
 })
 it.each(["missing","numeric","ambiguous","partial"])("refuses %s Sheet groups without partial totals",async kind=>{
  meta.view.config.filter.value=""
  if(kind==="missing")body.sheets[0].data[0].rowData[1].values[4]=cell(null)
  if(kind==="numeric")body.sheets[0].data[0].rowData[1].values[4]=cell(1)
  if(kind==="ambiguous")body.sheets[0].data[0].rowData[1].values[4]=cell(" Pantry")
  if(kind==="partial")body.sheets[0].data[0].rowData.pop()
  const tools=createKnowledgeTools(context)
  expect((await tools.execute("read_workspace",{...args,tableAnalysis:{...request,groupByColumn:"column_5"}})).results[0]).toMatchObject({status:"unavailable"})
  expect(tools.dependencies().tableAnalyses).toBeUndefined()
 })
 it("compares two complete filtered months and fences baseline, filter and connected-account changes",async()=>{
  body.sheets[0].data[0].rowData[3]=row(0,-0.2,"USD","2026-09","Pantry")
  const tools=createKnowledgeTools(context),tableAnalysis={...request,compareToPeriod:"2026-09"}
  const output=await tools.execute("read_workspace",{...args,tableAnalysis})
  expect(output.results[0]).toMatchObject({evidence:{tableAnalysis:{request:tableAnalysis,matchedRows:2,comparisonMatchedRows:1,selectedRows:3,filter:{column:"column_5",value:"PANTRY"},sheet:{range,providerVersion:"41"}}}})
  const item=output.results[0];expect("content" in item && JSON.parse(item.content)).toMatchObject({budget:"0.30",actual:"0.30",comparison:{period:"2026-09",budget:"0.00",actual:"-0.20",differences:{budget:"0.30",actual:"0.50",delta:"0.20",definition:"selected_minus_comparison"}}})
  const result=saved(tools);await expect(assertResearchSourcesAccessible(context,result,"history")).resolves.toBeUndefined()
  body.sheets[0].data[0].rowData[3]=row(0,-0.3,"USD","2026-09","Pantry")
  for(const purpose of ["history","apply"] as const)await expect(assertResearchSourcesAccessible(context,result,purpose)).rejects.toThrow()
  body.sheets[0].data[0].rowData[3]=row(0,-0.2,"USD","2026-09","Pantry")
  meta.view.config.filter.value="Other"
  await expect(assertResearchSourcesAccessible(context,result,"history")).rejects.toThrow()
  meta=base();mocks.single.mockResolvedValue({data:{...connection,google_subject:"replaced-account"},error:null})
  await expect(assertResearchSourcesAccessible(context,result,"history")).rejects.toThrow()
 })
 it.each(["missing","mixed","invalid","partial","revoked"])("withholds %s comparison month",async kind=>{
  const data=body.sheets[0].data[0]
  data.rowData[3]=row(0,-0.2,"USD",kind==="missing"?"2026-08":"2026-09","Pantry")
  if(kind==="mixed")data.rowData[3].values[2]=cell("EUR")
  if(kind==="invalid")data.rowData[3].values[0]=cell("0")
  if(kind==="partial")data.rowData.pop()
  if(kind==="revoked")mocks.single.mockResolvedValue({data:null,error:null})
  const tools=createKnowledgeTools(context)
  expect((await tools.execute("read_workspace",{...args,tableAnalysis:{...request,compareToPeriod:"2026-09"}})).results[0]).toMatchObject({status:"unavailable"})
  expect(tools.dependencies().tableAnalyses).toBeUndefined()
 })
 it("preserves prior native schema bytes used by retained-answer fingerprints",async()=>{
  const native={view:{...meta.view,source:"table",tableId:id(3000),config:{...meta.view.config,filter:null}},
    columns:[{key:"budget",label:"Budget",type:"number",options:[],writable:true}],rows:[],total:0,complete:true}
  mocks.native.mockImplementation(()=>({abortSignal:async()=>({data:native,error:null})}))
  const result=await createKnowledgeTools(context).execute("read_workspace",{ids:[record.id]})
  expect(result.results[0]).toHaveProperty("content",JSON.stringify({table:{viewId:id(2001),source:"table",revision:1,
    columns:[{key:"budget",label:"Budget",type:"number"}],filter:null,total:0},
    note:"Schema only; rows unread. For native tables use tableAnalysis with explicit amount, currency and YYYY-MM columns. Totals require complete selected rows; never add search excerpts."}))
  expect(mocks.fetch).not.toHaveBeenCalled()
 })
 it("uses numeric effective formula results, exact cents, saved display filters and complete range citations",async()=>{
  body.sheets[0].data[0].rowData[1].values[0].formattedValue="$0.10"
  expect((await readTableAnalysisSnapshot(id(1),id(2001),id(1))).total).toBe(3)
  const tools=createKnowledgeTools(context)
  expect((await tools.execute("read_workspace",{ids:[record.id]})).results[0]).toHaveProperty("content",expect.stringContaining('"source":"sheets"'))
  const output=await tools.execute("read_workspace",args)
  expect(output.results[0]).toMatchObject({content:expect.stringContaining('"budget":"0.30"'),evidence:{tableAnalysis:{tableId:null,selectedRows:3,matchedRows:2,filter:{column:"column_5",value:"PANTRY"},sheet:{range,providerVersion:"41",rangeRows:4,blankRows:0,hiddenRows:"included",filterBasis:"formatted_values"}}}})
  expect(mocks.eq).toHaveBeenCalledWith("user_id",id(1));expect(mocks.refresh).toHaveBeenCalledWith("viewer-refresh")
  for(const [name,input] of mocks.rpc.mock.calls){expect(name).toBe("workspace_sheet_view_command");expect(input).toMatchObject({p_actor_id:id(1),p_commit:false,p_command:{action:"read",organizationId:id(1),viewId:id(2001)}})}
  for(const [url,init] of mocks.fetch.mock.calls){expect(String(url)).toContain(":getByDataFilter?");expect(String(url)).toContain("effectiveValue");const fields=new URL(String(url)).searchParams.get("fields")!;expect([...fields].filter(c=>c==="(").length).toBe([...fields].filter(c=>c===")").length);expect(String(url)).not.toContain("userEnteredValue");expect(init.method).toBe("POST");expect(JSON.parse(init.body).dataFilters[0].gridRange).toEqual({sheetId:7,startRowIndex:2,endRowIndex:7,startColumnIndex:1,endColumnIndex:6})}
  const text=JSON.stringify(output);for(const secret of ["viewer-access","viewer-refresh","viewer-cipher","viewer@example.org","google_subject"])expect(text).not.toContain(secret)
  expect(await tools.revalidate()).toBe(true)
 })
 it("matches the manual formatted-value filter while using unformatted amounts",async()=>{
  meta.view.config.filter={column:"column_1",value:"$0.10"};body.sheets[0].data[0].rowData[1].values[0].formattedValue="$0.10"
  const result=await createKnowledgeTools(context).execute("read_workspace",args)
  expect(result.results[0]).toMatchObject({content:expect.stringContaining('"delta":"0.10"'),evidence:{tableAnalysis:{selectedRows:1,matchedRows:1}}})
 })
 it("accounts for explicitly empty rows without treating missing rows as zeros",async()=>{
  body.sheets[0].data[0].rowData[3]={values:[]}
  const result=await createKnowledgeTools(context).execute("read_workspace",args)
  expect(result.results[0]).toMatchObject({evidence:{tableAnalysis:{selectedRows:2,sheet:{blankRows:1,rangeRows:4}}}})
 })
 it.each(["partial","wrong-range","wrong-sheet","error","date","string-amount","overprecision","mixed-currency","ambiguous-period","missing-effective","extra-value","oversize","header","grid-limit","wrong-view","invisible-values"])("refuses %s without totals or saved calculation",async kind=>{
  const data=body.sheets[0].data[0], target=data.rowData[1].values[1]
  if(kind==="partial")data.rowData.pop()
  if(kind==="wrong-range")data.startRow=0
  if(kind==="wrong-sheet")body.sheets[0].properties.sheetId=8
  if(kind==="error")target.effectiveValue={errorValue:{type:"DIVIDE_BY_ZERO"}}
  if(kind==="date")target.effectiveFormat={numberFormat:{type:"DATE"}}
  if(kind==="string-amount")target.effectiveValue={stringValue:"0.20"}
  if(kind==="overprecision")target.effectiveValue={numberValue:0.001}
  if(kind==="mixed-currency")data.rowData[2].values[2]=cell("EUR")
  if(kind==="ambiguous-period")data.rowData[2].values[3]=cell("10/2026")
  if(kind==="missing-effective")delete target.effectiveValue
  if(kind==="extra-value")target.effectiveValue={numberValue:0.2,stringValue:"2"}
  if(kind==="oversize")mocks.fetch.mockImplementation(async()=>new Response("x".repeat(1000001)))
  if(kind==="header")data.rowData[0].values[0]=cell("Changed header")
  if(kind==="grid-limit")body.sheets[0].properties.gridProperties.rowCount=4
  if(kind==="invisible-values")data.rowData[1].values.forEach(value=>value.formattedValue="")
  if(kind==="wrong-view")meta.view.id=id(999)
  const tools=createKnowledgeTools(context)
  expect((await tools.execute("read_workspace",args)).results[0]).toMatchObject({status:"unavailable"})
  expect(tools.sources.size).toBe(0);expect(tools.dependencies().tableAnalyses).toBeUndefined()
 })
 it.each(["actor","membership","connection","file-revoked","account-replaced","reconnected","version","missing-version","view-changed","canceled"])("fences %s before publishing a result",async kind=>{
  const controller=new AbortController()
  if(kind==="actor")mocks.user.mockResolvedValue({data:{user:{id:id(2)}},error:null})
  if(kind==="membership")mocks.rpc.mockImplementation(()=>({abortSignal:async()=>({data:null,error:{code:"42501"}})}))
  if(kind==="connection")mocks.single.mockResolvedValue({data:null,error:null})
  if(kind==="file-revoked")mocks.file.mockResolvedValueOnce(file).mockResolvedValue({...file,status:"trashed"})
  if(kind==="account-replaced")mocks.single.mockResolvedValueOnce({data:connection,error:null}).mockResolvedValue({data:{...connection,google_subject:"other"},error:null})
  if(kind==="reconnected")mocks.single.mockResolvedValueOnce({data:connection,error:null}).mockResolvedValue({data:{...connection,connected_at:"2026-11-12T00:00:00Z"},error:null})
  if(kind==="version")mocks.file.mockResolvedValueOnce(file).mockResolvedValue({...file,version:"42"})
  if(kind==="missing-version")mocks.file.mockResolvedValue({...file,version:null})
  if(kind==="view-changed")mocks.fetch.mockImplementation(async()=>{meta.view.revision++;return Response.json(body)})
  if(kind==="canceled")mocks.fetch.mockImplementation(async()=>{controller.abort();return Response.json(body)})
  await expect(readTableAnalysisSnapshot(id(1),id(2001),id(1),controller.signal)).rejects.toThrow()
  if(["actor","membership","connection"].includes(kind))expect(mocks.fetch).not.toHaveBeenCalled()
 })
 it.each(["amount","display-filter","range","view","identity","revoked","version","formula-result"])("invalidates persisted answers after %s changes",async kind=>{
  const tools=createKnowledgeTools(context);await tools.execute("read_workspace",args);const result=saved(tools)
  await expect(assertResearchSourcesAccessible(context,result,"history")).resolves.toBeUndefined()
  if(kind==="amount"||kind==="formula-result")body.sheets[0].data[0].rowData[1].values[1].effectiveValue={numberValue:1}
  if(kind==="display-filter")body.sheets[0].data[0].rowData[1].values[4].formattedValue="Other"
  if(kind==="range")meta.source.rowCount=4
  if(kind==="view")meta.view.revision++
  if(kind==="identity")mocks.single.mockResolvedValue({data:{...connection,google_subject:"other"},error:null})
  if(kind==="revoked")mocks.rpc.mockImplementation(()=>({abortSignal:async()=>({data:null,error:{code:"42501"}})}))
  if(kind==="version")mocks.file.mockResolvedValue({...file,version:"42"})
  await expect(assertResearchSourcesAccessible(context,result,"history")).rejects.toThrow()
  expect(await tools.revalidate()).toBe(false)
 })
 it("computes all 500 bounded rows and refuses row 501",async()=>{
  meta.source.rowCount=501;body.sheets[0].properties.gridProperties.rowCount=1000
  body.sheets[0].data[0].rowData=[row(...headers),...Array.from({length:500},()=>row(0.1,0.2,"USD","2026-10","Pantry"))]
  const result=await createKnowledgeTools(context).execute("read_workspace",args)
  expect(result.results[0]).toMatchObject({content:expect.stringContaining('"actual":"100.00"'),evidence:{tableAnalysis:{selectedRows:500,matchedRows:500}}})
  meta.source.rowCount=502
  expect((await createKnowledgeTools(context).execute("read_workspace",args)).results[0]).toMatchObject({status:"unavailable"})
 })
})
const response=(params:unknown,output:unknown[])=>{dispatched.push(structuredClone(params));return(async function*(){yield{type:"response.completed",response:{id:"controlled",status:"completed",usage:{input_tokens:100,output_tokens:20,input_tokens_details:{cached_tokens:0}},output}}})()}
it("carries Sheet schema, deterministic result and retained citation through controlled board readiness and accounting",async()=>{
 const tools=createKnowledgeTools(context)
 mocks.provider.mockImplementationOnce(params=>response(params,[{type:"function_call",id:"schema",call_id:"schema",name:"read_workspace",arguments:JSON.stringify({ids:[record.id]}),status:"completed"}]))
 mocks.provider.mockImplementationOnce(params=>response(params,[{type:"function_call",id:"calc",call_id:"calc",name:"read_workspace",arguments:JSON.stringify(args),status:"completed"}]))
 mocks.provider.mockImplementationOnce(params=>response(params,[{type:"message",role:"assistant",status:"completed",content:[{type:"output_text",text:JSON.stringify({responseKind:"answer",answerEvidenceIds:[record.id],title:"Board readiness",summary:"October 2026 USD budget 0.30, actual 0.30; actual minus budget 0.00. Pantry filter, Actuals tab 7 rows 3–7 columns 2–6. Governance approval remains unverified.",questions:[],unfulfilled:["Governance approval"],decisions:[],removeReferences:[],items:[]})}]}]))
 const answer=await runResearchProvider({preparedContext:{tools,records:[]},context,request:{id:ID(91),parentRunId:ID(92),target:context.target,prompt:"Review October budget versus actual for board readiness.",skill:"planning",tariffVersion:"fixture",maximumCredits:20},config:{tariff:{version:"fixture",model:"fixture",inputMicrodollarsPerMillion:1,cachedMicrodollarsPerMillion:0,outputMicrodollarsPerMillion:1,microdollarsPerCredit:2000},maxSearchCalls:0,maxRounds:3,maxOutputTokens:1500,maxInputBytes:20000,maxCredits:20,maxCost:40000},onResponse:async()=>{},isCanceled:async()=>false})
 expect(answer.result).toMatchObject({responseKind:"answer",sources:[{evidence:{tableAnalysis:{sheet:{range}}}}],dependencies:{tableAnalyses:[{request}]}})
 expect(answer.usage).toMatchObject({input:300,output:60,webSearchCalls:0})
 for(const call of dispatched)expect(Buffer.byteLength(JSON.stringify(call))).toBeLessThanOrEqual(20000)
 await expect(assertResearchSourcesAccessible(context,answer.result!,"history")).resolves.toBeUndefined()
 expect(JSON.stringify(dispatched)).not.toContain("viewer-access")
})

const database=process.env.SHEET_ANALYSIS_DATABASE_URL
function sql(input:string) {
 if(!database || !/^postgresql:\/\/postgres@localhost:\d+\/workspace_sharing_fixture_sheet_analysis$/.test(database))throw Error("Disposable fixture required")
 return execFileSync("psql",["-XqAt","-v","ON_ERROR_STOP=1","-d",database],{input,encoding:"utf8",env:{...process.env,PGOPTIONS:"-c statement_timeout=5000 -c coach_house.workspace_sharing_fixture=isolated-test-only"},stdio:["pipe","pipe","pipe"]}).trim()
}
const quote=(value:unknown)=>`'${JSON.stringify(value).replaceAll("'","''")}'::jsonb`
const sheetCommand=(command:unknown,actor=id(1),commit=false,header:string|null=null)=>`set role service_role;select public.workspace_sheet_view_command('${actor}',${quote(command)},${commit},${header?`'${header}'`:"null"});`
const queryReply=(input:string)=>{try{return{data:JSON.parse(sql(input)),error:null}}catch{return{data:null,error:{code:"42501"}}}}
describe.skipIf(!database)("actual Sheet owner with controlled provider and AI tools",()=>{
 beforeEach(()=>{
  sql("select public.fixture_response_data_views();")
  sql(sheetCommand({action:"create_view",organizationId:id(1),viewId:id(2001),requestId:id(2100),name:"Board finance",source:{kind:"sheets",range}},id(1),true,hash(headers)))
  sql(sheetCommand({action:"save_view",organizationId:id(1),viewId:id(2001),requestId:id(2101),revision:1,config:meta.view.config},id(1),true,hash(headers)))
  mocks.native.mockImplementation((_name,args)=>({abortSignal:async()=>queryReply(`set role authenticated;set request.jwt.claim.sub='${id(1)}';select public.read_workspace_table_analysis('${args.p_org}','${args.p_view}');`)}))
  mocks.rpc.mockImplementation((name,args)=>({abortSignal:async()=>{expect(name).toBe("workspace_sheet_view_command");expect(args.p_commit).toBe(false);return queryReply(sheetCommand(args.p_command,args.p_actor_id))}}))
 })
 it("reads exact saved selection, retains source citation and invalidates after a canonical filter edit",async()=>{
  const tools=createKnowledgeTools(context)
  expect((await tools.execute("read_workspace",args)).results[0]).toMatchObject({content:expect.stringContaining('"budget":"0.30"'),evidence:{tableAnalysis:{viewRevision:2,selectedRows:3,sheet:{range}}}})
  const result=saved(tools);expect(result.dependencies?.tableAnalyses).toHaveLength(1)
  await expect(assertResearchSourcesAccessible(context,result,"history")).resolves.toBeUndefined()
  sql(sheetCommand({action:"save_view",organizationId:id(1),viewId:id(2001),requestId:id(2102),revision:2,config:{...meta.view.config,filter:null}},id(1),true,hash(headers)))
  await expect(assertResearchSourcesAccessible(context,result,"history")).rejects.toThrow()
 })
 it("denies cross-organization and outsider source access before contacting Google",async()=>{
  await expect(readTableAnalysisSnapshot(id(2),id(2001),id(1))).rejects.toThrow()
  mocks.user.mockResolvedValue({data:{user:{id:id(2)}},error:null})
  await expect(readTableAnalysisSnapshot(id(1),id(2001),id(2))).rejects.toThrow()
  expect(mocks.fetch).not.toHaveBeenCalled()
 })
 it("withdraws fetched financial results after membership revocation during provider I/O",async()=>{
  mocks.user.mockResolvedValue({data:{user:{id:id(13)}},error:null})
  const member={...context,user:{id:id(13)}} as ResearchContext;mocks.context.mockResolvedValue(member)
  const tools=createKnowledgeTools(member)
  expect((await tools.execute("read_workspace",args)).results[0]).toHaveProperty("content")
  mocks.fetch.mockImplementation(async()=>{sql(`delete from public.organization_memberships where org_id='${id(1)}' and member_id='${id(13)}';`);return Response.json(body)})
  expect(await tools.revalidate()).toBe(false)
  expect((await tools.execute("read_workspace",args)).results[0]).toHaveProperty("status","unavailable")
 })
 it("preserves source rows, view settings and receipts during analysis and refuses direct authenticated Sheet RPC",async()=>{
  const state=()=>sql("select jsonb_build_object('views',(select jsonb_agg(to_jsonb(v) order by id) from public.organization_data_views v),'rows',(select jsonb_agg(to_jsonb(r) order by id) from public.organization_data_rows r),'receipts',(select jsonb_agg(to_jsonb(r) order by request_id) from public.organization_data_view_receipts r));")
  const before=state();await readTableAnalysisSnapshot(id(1),id(2001),id(1));expect(state()).toBe(before)
  expect(()=>sql(`set role authenticated;select public.workspace_sheet_view_command('${id(1)}',${quote({action:"read",organizationId:id(1),viewId:id(2001),page:0})});`)).toThrow()
 })
})
