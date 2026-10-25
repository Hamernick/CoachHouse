import { beforeEach,describe,it,expect,vi } from "vitest"
const mocks=vi.hoisted(()=>({create:vi.fn(),execute:vi.fn(),sources:new Map()}))
vi.mock("openai",()=>({default:class {responses={create:mocks.create}}}))
vi.mock("@/features/workspace-ai/server/knowledge-tools",()=>({createKnowledgeTools:()=>({execute:mocks.execute,sources:mocks.sources,evidence:()=>[...mocks.sources.values()]})}))
import { runResearchProvider } from "@/features/workspace-ai/server/research-provider"
import type { ResearchContext } from "@/features/workspace-ai/server/research-context"
import { ID,WORKSPACE,particle,graph } from "./fixtures/particle-fixtures"
const target={organizationId:WORKSPACE,objectiveId:ID(1),revision:0}
const request={id:ID(9),target,prompt:"Find evidence for the objective",skill:"research" as const,tariffVersion:"test",maximumCredits:20}
const config={tariff:{version:"test",model:"fixture",inputMicrodollarsPerMillion:1,cachedMicrodollarsPerMillion:0,outputMicrodollarsPerMillion:1,webSearchMicrodollarsPerCall:10000,microdollarsPerCredit:2000},maxSearchCalls:2,maxRounds:3,maxOutputTokens:1500,maxInputBytes:20000,maxCredits:20,maxCost:40000}
const context={user:{id:ID(90)},objective:particle(1,"objective"),target,graph:graph()} as ResearchContext
const draft={title:"Next decisions",summary:"Evidence supports a next decision.",questions:[],decisions:[],removeReferences:[],items:[{key:"review",title:"Review source",kind:"resource",description:"An unconfirmed lead",referenceId:null,evidenceIds:["https://example.org/source"],dependsOn:[]}]}
const message={type:"message",id:"msg",role:"assistant",status:"completed",content:[{type:"output_text",text:JSON.stringify(draft),annotations:[{type:"url_citation",url:"https://example.org/source",title:"Original source",start_index:0,end_index:5}]}]}
function stream(id:string,output:unknown[],status="completed") {
  return (async function*(){yield {type:"response.created",response:{id}};yield {type:`response.${status}`,response:{id,status,output,usage:{input_tokens:100,output_tokens:20,input_tokens_details:{cached_tokens:10}}}}})()
}
beforeEach(()=>{vi.clearAllMocks();mocks.sources.clear();mocks.execute.mockResolvedValue({results:[]})})
describe("bounded research provider",()=>{
  it("executes only declared workspace functions, carries outputs, and aggregates web costs",async()=>{
    mocks.create.mockResolvedValueOnce(stream("r1",[{type:"function_call",id:"f1",call_id:"c1",name:"search_workspace",arguments:JSON.stringify({query:"partners",kinds:["person"]})}]))
    mocks.create.mockResolvedValueOnce(stream("r2",[{type:"web_search_call",id:"w1",status:"completed",action:{type:"search",query:"public partners",sources:[]}},message]))
    const onResponse=vi.fn(),isCanceled=vi.fn().mockResolvedValue(false)
    const value=await runResearchProvider({request,config,context,onResponse,isCanceled})
    expect(value.result?.sources[0].href).toBe("https://example.org/source")
    expect(value.usage).toEqual({input:200,cachedInput:20,output:40,webSearchCalls:1})
    expect(onResponse.mock.calls.flat()).toEqual(["r1","r2"])
    expect(mocks.execute).toHaveBeenCalledWith("search_workspace",{query:"partners",kinds:["person"]})
    const params=mocks.create.mock.calls[1][0]
    expect(params.store).toBe(false);expect(params.max_tool_calls).toBe(2)
    expect(params.input.some((item:{type:string})=>item.type==="function_call_output")).toBe(true)
  })
  it("does not start a provider request after cancellation",async()=>{
    const value=await runResearchProvider({request,config,context,onResponse:vi.fn(),isCanceled:async()=>true})
    expect(value.canceled).toBe(true);expect(mocks.create).not.toHaveBeenCalled()
  })
  it("rejects invented citations while retaining measured usage",async()=>{
    mocks.create.mockResolvedValueOnce(stream("r1",[{...message,content:[{...message.content[0],annotations:[]}]}]))
    const value=await runResearchProvider({request,config,context,onResponse:vi.fn(),isCanceled:async()=>false})
    expect(value.result).toBeNull();expect(value.usage.input).toBe(100)
  })
  it("records incomplete responses without a billable proposal",async()=>{
    mocks.create.mockResolvedValueOnce(stream("r1",[],"incomplete"))
    const value=await runResearchProvider({request,config,context,onResponse:vi.fn(),isCanceled:async()=>false})
    expect(value.result).toBeNull();expect(value.usage.output).toBe(20)
  })
  it("stops oversized context before a provider request",async()=>{
    const value=await runResearchProvider({request,config:{...config,maxInputBytes:20},context,onResponse:vi.fn(),isCanceled:async()=>false})
    expect(value.result).toBeNull();expect(mocks.create).not.toHaveBeenCalled()
  })
})

describe("revision provider binding",()=>{
 it("binds exact existing decision outcomes and rejects model edits to them",async()=>{
  const objective=particle(1,"objective"),decision=particle(2,"decision")
  if(objective.type!=="objective"||decision.type!=="decision")throw Error()
  objective.data.planning={plans:[{id:ID(50),revision:0,title:"Plan",particleIds:[decision.id]}],proposals:[]}
  const revisionTarget={...target,plan:{id:ID(50),revision:0}}
  const current={...context,objective,graph:graph([objective,decision]),target:revisionTarget}
  const value={...draft,items:[{key:"choice",kind:"reference",title:decision.title,description:"Keep the existing choice",referenceId:`particle:${decision.id}`,evidenceIds:[],dependsOn:[]}],decisions:[{itemKey:"choice",outcomes:decision.data.outcomes.map(outcome=>({key:outcome.id,label:outcome.label,next:[]}))}]}
  mocks.sources.set(`particle:${decision.id}`,{id:`particle:${decision.id}`,title:decision.title,href:"/workspace",revision:"0",kind:"workspace",checkedAt:"2026-10-10T02:00:00.000Z"})
  const output=()=>[{...message,content:[{type:"output_text",text:JSON.stringify(value),annotations:[]}]}]
  mocks.create.mockResolvedValueOnce(stream("r1",output()))
  const first=await runResearchProvider({request:{...request,target:revisionTarget},config,context:current,onResponse:vi.fn(),isCanceled:async()=>false})
  expect(first.result?.target.plan).toEqual(revisionTarget.plan)
  expect(first.result?.decisions?.[0].outcomes[0].key).toBe(decision.data.outcomes[0].id)
  value.decisions[0].outcomes[0].label="Invented outcome"
  mocks.create.mockResolvedValueOnce(stream("r2",output()))
  const invalid=await runResearchProvider({request:{...request,target:revisionTarget},config,context:current,onResponse:vi.fn(),isCanceled:async()=>false})
  expect(invalid.result).toBeNull()
 })
})


it("rejects a sourced removal outside the selected plan before successful settlement",async()=>{
 const objective=particle(1,"objective"),member=particle(2),outside=particle(3)
 if(objective.type!=="objective")throw Error()
 objective.data.planning={plans:[{id:ID(50),revision:0,title:"Plan",particleIds:[member.id]}],proposals:[]}
 const revisionTarget={...target,plan:{id:ID(50),revision:0}}
 const current={...context,objective,graph:graph([objective,member,outside]),target:revisionTarget}
 const value={...draft,items:[],removeReferences:[`particle:${outside.id}`]}
 mocks.sources.set(`particle:${outside.id}`,{id:`particle:${outside.id}`,title:outside.title,href:"/workspace",revision:"0",kind:"workspace",checkedAt:"2026-10-10T02:00:00.000Z"})
 mocks.create.mockResolvedValueOnce(stream("r1",[{...message,content:[{type:"output_text",text:JSON.stringify(value),annotations:[]}]}]))
 const outcome=await runResearchProvider({request:{...request,target:revisionTarget},config,context:current,onResponse:vi.fn(),isCanceled:async()=>false})
 expect(outcome.result).toBeNull()
 expect(outcome.usage.input).toBe(100)
 expect(current.graph.particles).toHaveLength(3)
 expect(objective.data.planning.proposals).toEqual([])
})

it("retains questions-only clarification without pretending it is an applicable plan",async()=>{
 const value={...draft,items:[],questions:["What is the event date?"]}
 mocks.create.mockResolvedValueOnce(stream("r1",[{...message,content:[{type:"output_text",text:JSON.stringify(value),annotations:[]}]}]))
 const outcome=await runResearchProvider({request,config,context,onResponse:vi.fn(),isCanceled:async()=>false})
 expect(outcome.result?.items).toEqual([])
 expect(outcome.result?.questions).toEqual(value.questions)
})
