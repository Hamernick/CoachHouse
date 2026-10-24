import { describe,it,expect } from "vitest"
import { searchKnowledge,bindResearch } from "@/features/workspace-ai/lib/research-contract"
import { researchPlanOperations } from "@/features/workspace-particles/lib/research-plan"
import { particleConnectionsToFlow } from "@/features/workspace-particles/lib/particle-flow-adapters"
import { particlePlanningPermissionError } from "@/features/workspace-particles/lib/particle-plan-authority"
import { particlePlanSchema, planFromProposal } from "@/features/workspace-particles/lib/particle-plan-schema"
import { applyParticleBatch } from "@/features/workspace-particles/lib/graph-operations"
import { priceAiUsage } from "@/features/ai-credits/lib"
import { graph,particle,ID,WORKSPACE } from "./fixtures/particle-fixtures"
import type { ResearchResult, KnowledgeRecord } from "@/features/workspace-ai/research-types"
const now="2026-10-24T01:00:00.000Z"
const target={organizationId:WORKSPACE,objectiveId:ID(1),revision:0}
const source={id:`particle:${ID(2)}`,kind:"workspace" as const,title:"Existing research",href:"/workspace",revision:"0",checkedAt:now}
const draft={title:"Proposed plan",summary:"Reuse existing evidence",questions:[],removeReferences:[],decisions:[],items:[{key:"existing",kind:"reference" as const,title:"Existing research",description:"Use the existing source",referenceId:source.id,evidenceIds:[source.id],dependsOn:[]},{key:"followup",kind:"note" as const,title:"Discuss options",description:"A proposal, not a completed action",referenceId:null,evidenceIds:[],dependsOn:["existing"]}]}
const result:ResearchResult={...draft,sources:[source],runId:ID(9),target}
describe("permission-aware research contracts",()=>{
  it("ranks exact titles, limits excerpts and omits irrelevant records",()=>{
    const records:KnowledgeRecord[]=[{id:"a",kind:"person",title:"Marketing director",content:"x".repeat(900),revision:"1",href:"/workspace",contentAvailable:true},{id:"b",kind:"document",title:"Unrelated",content:"unrelated",revision:"1",href:"/workspace",contentAvailable:true}]
    const hits=searchKnowledge(records,"marketing director")
    expect(hits.map(item=>item.id)).toEqual(["a"]);expect(hits[0].content.length).toBeLessThanOrEqual(480)
  })
  it("binds only real evidence and rejects invented IDs and dependency cycles",()=>{
    expect(bindResearch(JSON.stringify(draft),[source],target,ID(9)).sources).toEqual([source])
    expect(()=>bindResearch(JSON.stringify(draft),[],target,ID(9))).toThrow(/unavailable/)
    const cyclic=structuredClone(draft);cyclic.items[0].dependsOn=["followup"]
    expect(()=>bindResearch(JSON.stringify(cyclic),[source],target,ID(9))).toThrow(/cycle/)
  })
  it("adds a pending branch atomically while reusing existing particles",async()=>{
    const before=graph();let n=20
    const operations=researchPlanOperations(before,result,ID(6),now,()=>ID(n++))
    expect(operations).toHaveLength(2)
    const changed=await applyParticleBatch(before,{id:ID(8),workspaceId:WORKSPACE,baseRevision:0,requireExactRevision:false,operations},now)
    expect(changed.ok).toBe(true)
    if(!changed.ok)return
    const after=changed.value.graph,objective=after.particles.find(item=>item.type==="objective")!
    if(objective.type!=="objective")throw Error()
    expect(objective.data.planning?.plans).toHaveLength(0)
    const proposal=objective.data.planning!.proposals[0]
    const accepted=planFromProposal(proposal)
    expect(particlePlanSchema.parse(accepted).links).toEqual(proposal.links)
    expect(accepted).not.toHaveProperty("authorId")
    const reviewed={...after,particles:after.particles.map(item=>item.id===objective.id?{...objective,data:{...objective.data,planning:{plans:[accepted],proposals:[{...proposal,status:"accepted" as const,reviewedBy:ID(6),reviewedAt:now}]}}}:item)}
    expect(particlePlanningPermissionError(after,reviewed,{userId:ID(6),isOrganizationOwner:true},now)).toBeNull()
    expect(particlePlanningPermissionError(after,reviewed,{userId:ID(6),isOrganizationOwner:false},now)).toMatch(/owner/)

    expect(objective.data.planning?.proposals[0].particleIds).toContain(ID(2))
    expect(after.particles.find(item=>item.id===ID(2))).toEqual(before.particles[1])
    expect(particlePlanningPermissionError(before,after,{userId:ID(6),isOrganizationOwner:false},now)).toBeNull()
    expect(particleConnectionsToFlow(after).filter(edge=>edge.ariaLabel==="Proposed plan relationship")).toHaveLength(2)
    expect(researchPlanOperations(after,result,ID(6),now,()=>ID(n++))).toEqual([])
  })
  it("rejects stale objectives and never overwrites concurrent work",()=>{
    const before=graph([ {...particle(1,"objective"),revision:1},particle(2)])
    expect(()=>researchPlanOperations(before,result,ID(6),now,()=>ID(20))).toThrow(/changed/)
  })
  it("accounts for web calls and refuses missing search tariffs",()=>{
    const tariff={version:"test",model:"test",inputMicrodollarsPerMillion:2000000,cachedMicrodollarsPerMillion:100000,outputMicrodollarsPerMillion:10000000,microdollarsPerCredit:2000}
    expect(()=>priceAiUsage({input:0,cachedInput:0,output:0,webSearchCalls:1},tariff)).toThrow(/tariff/)
    expect(priceAiUsage({input:1000,cachedInput:0,output:100,webSearchCalls:2},{...tariff,webSearchMicrodollarsPerCall:10000})).toEqual({microdollars:23000,credits:12})
  })
})
