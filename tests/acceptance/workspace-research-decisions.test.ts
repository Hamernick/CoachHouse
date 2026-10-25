import { describe, expect, it } from "vitest"
import { bindResearch } from "@/features/workspace-ai/lib/research-contract"
import { researchResultSchema } from "@/features/workspace-ai/research-types"
import { researchPlanOperations } from "@/features/workspace-particles/lib/research-plan"
import { applyParticleBatch } from "@/features/workspace-particles/lib/graph-operations"
import { validateParticleGraph } from "@/features/workspace-particles/lib/graph-validation"
import { particleConnectionsToFlow } from "@/features/workspace-particles/lib/particle-flow-adapters"
import { layoutParticleGraph } from "@/features/workspace-particles/lib/graph-layout"
import { particlePlanBranchStates, particlePlanBranchLabel, particlePlanOutcomeReferences } from "@/features/workspace-particles/lib/particle-plan-branches"
import { decisionOutcomeRemovalReason, selectDecisionOutcome } from "@/features/workspace-particles/lib/particle-decision"
import { graph, particle, measurements, ID, WORKSPACE, NOW } from "./fixtures/particle-fixtures"

const target={organizationId:WORKSPACE,objectiveId:ID(1),revision:0}
function draft() {
 return {title:"Choose an approach",summary:"A choice, not a completed action",questions:[],removeReferences:[],
  items:[
   {key:"choice",kind:"decision" as const,title:"Venue available?",description:"Confirm availability",referenceId:null,evidenceIds:[],dependsOn:[]},
   {key:"yes",kind:"note" as const,title:"Use venue",description:"Confirm the booking",referenceId:null,evidenceIds:[],dependsOn:[]},
   {key:"no",kind:"note" as const,title:"Find another venue",description:"Explore alternatives",referenceId:null,evidenceIds:[],dependsOn:[]},
   {key:"join",kind:"note" as const,title:"Notify team",description:"Share the chosen location",referenceId:null,evidenceIds:[],dependsOn:["yes","no"]},
  ],decisions:[{itemKey:"choice",outcomes:[{key:"yes",label:"Available",next:["yes"]},{key:"no",label:"Unavailable",next:["no"]}]}],
 }
}
async function proposed() {
 const research=bindResearch(JSON.stringify(draft()),[],target,ID(8))
 let next=20
 const before=graph([particle(1,"objective")])
 const operations=researchPlanOperations(before,research,ID(90),NOW,()=>ID(next++))
 const saved=await applyParticleBatch(before,{id:ID(9),workspaceId:WORKSPACE,baseRevision:0,requireExactRevision:false,operations},NOW)
 if(!saved.ok)throw Error(saved.error)
 const after=saved.value.graph,objective=after.particles.find(item=>item.type==="objective")!,decision=after.particles.find(item=>item.type==="decision")!
 if(objective.type!=="objective"||decision.type!=="decision")throw Error("Missing fixture")
 return {after,decision,proposal:objective.data.planning!.proposals[0]}
}
describe("research decision branches",()=>{
 it("persists declared outcomes and conditional links without choosing or completing anything",async()=>{
  const {after,decision,proposal}=await proposed()
  expect(decision.data.outcomes).toEqual([{id:"yes",label:"Available"},{id:"no",label:"Unavailable"}])
  expect(decision.data.selectedOutcome).toBeNull()
  expect(after.particles.every(item=>item.status==="backlog")).toBe(true)
  expect(proposal.links?.filter(link=>link.outcome)).toHaveLength(2)
  expect(validateParticleGraph(JSON.parse(JSON.stringify(after)))).toBeNull()
 })
 it.each(["missing","unknown","duplicate","cycle","unconditional"])("rejects %s decision structure before presenting a result",kind=>{
  const value=draft()
  if(kind==="missing")value.decisions=[]
  if(kind==="unknown")value.decisions[0].outcomes[0].next=["absent"]
  if(kind==="duplicate")value.decisions[0].outcomes[1].key="yes"
  if(kind==="cycle")value.items[0].dependsOn=["join"]
  if(kind==="unconditional")value.items[1].dependsOn=["choice"]
  expect(()=>bindResearch(JSON.stringify(value),[],target,ID(8))).toThrow()
 })
 it("keeps both alternatives waiting until a real choice; propagates reachability through joins",async()=>{
  const {after,decision,proposal}=await proposed()
  expect([...particlePlanBranchStates(proposal,after.particles).values()].filter(state=>state==="waiting")).toHaveLength(3)
  const changed=after.particles.map(item=>item.id===decision.id?selectDecisionOutcome(decision,"yes"):item)
  const states=particlePlanBranchStates(proposal,changed)
  expect(states.get(ID(21))).toBe("active");expect(states.get(ID(22))).toBe("inactive");expect(states.get(ID(23))).toBe("active")
  expect(particlePlanBranchLabel(proposal,ID(21),changed)).toBe("Venue available?: Available")
  expect(particlePlanBranchStates(proposal,after.particles.map(item=>({...item,status:"done" as const}))).get(ID(21))).toBe("waiting")
 })
 it("labels actual outcome handles and dims only unselected routes",async()=>{
  const {after,decision}=await proposed()
  const chosen={...after,particles:after.particles.map(item=>item.id===decision.id?selectDecisionOutcome(decision,"yes"):item)}
  const edges=particleConnectionsToFlow(chosen)
  expect(edges.find(edge=>edge.sourceHandle==="outcome:yes")).toMatchObject({label:"Available",style:{opacity:1}})
  expect(edges.find(edge=>edge.sourceHandle==="outcome:no")).toMatchObject({label:"Unavailable",style:{opacity:0.3}})
  expect(new Set(edges.map(edge=>edge.id)).size).toBe(edges.length)
 })
 it("guards referenced outcome removal and rejects fabricated saved branch IDs",async()=>{
  const {after,decision}=await proposed()
  expect(decisionOutcomeRemovalReason(decision,"yes",particlePlanOutcomeReferences(after))).toMatch(/Disconnect/)
  const invalid=structuredClone(after)
  const objective=invalid.particles.find(item=>item.type==="objective")!
  if(objective.type!=="objective")throw Error()
  objective.data.planning!.proposals[0].links!.find(link=>link.outcome)!.outcome="invented"
  expect(validateParticleGraph(invalid)).toMatch(/declared decision/)
 })
 it("lays out the saved branch using measured outcome ports",async()=>{
  const {after}=await proposed()
  const layout=await layoutParticleGraph({graph:after,measurements:measurements(after)})
  expect(layout.ok).toBe(true)
  if(layout.ok)expect(layout.value.nodes).toHaveLength(5)
 })
 it("can still reopen research saved before decision metadata was introduced",()=>{
  const old={...draft(),sources:[],target,runId:ID(8)}
  const {decisions:_decisions,...withoutDecisions}=old
  expect(researchResultSchema.safeParse(withoutDecisions).success).toBe(true)
 })
})
