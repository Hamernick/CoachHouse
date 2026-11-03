import { ParticleComposer } from "../../../src/features/workspace-particles/components/particle-composer"
import { WorkspaceNewPlan } from "../../../src/features/workspace-ai/components/workspace-new-plan"
import { useRef, useState } from "react"
import { PlanParticleList } from "../../../src/features/workspace-objectives/components/plan-particle-list"
import { Button } from "../../../src/components/ui/button"
import { ParticleObjectiveCard } from "../../../src/features/workspace-objectives/components/particle-objective-card"
import { useParticlePlans, type PlanningControls } from "../../../src/features/workspace-objectives/hooks/use-particle-plans"
import { particleGraphSchema } from "../../../src/features/workspace-particles/lib/particle-schema"
import { createParticle } from "../../../src/features/workspace-particles/lib/particle-registry"
import { emptyParticleGraph } from "../../../src/features/workspace-particles/lib/graph-validation"
import { applyParticleBatch } from "../../../src/features/workspace-particles/lib/graph-operations"
import { particlePlanningPermissionError } from "../../../src/features/workspace-particles/lib/particle-plan-authority"
import { applyResearchDraft, type ResearchDraft } from "../../../src/features/workspace-ai/lib/research-draft"
import { researchPlanOperations } from "../../../src/features/workspace-particles/lib/research-plan"
import type { ParticleGraph, ParticleOperation } from "../../../src/features/workspace-particles/types"
import type { ResearchResult } from "../../../src/features/workspace-ai/research-types"
import { scope } from "./fixture-data"

const date = "2026-10-24T12:00:00.000Z"
export const revisionIds = { objective:"00000000-0000-4000-8000-000000000101", first:"00000000-0000-4000-8000-000000000102", second:"00000000-0000-4000-8000-000000000103", kept:"00000000-0000-4000-8000-000000000104", removed:"00000000-0000-4000-8000-000000000105" }
function initialGraph(): ParticleGraph {
  if (new URLSearchParams(window.location.search).has("new-objective")) return emptyParticleGraph(scope.organizationId)
  const graph = emptyParticleGraph(scope.organizationId)
  const objective = createParticle("objective", {id:revisionIds.objective,workspaceId:scope.organizationId,title:"Community workshop",now:date})
  if(objective.type !== "objective") throw new Error("Invalid fixture")
  const kept = createParticle("activity", {id:revisionIds.kept,workspaceId:scope.organizationId,title:"Venue confirmed",now:date})
  kept.status="done";kept.description="Approved venue details must survive revision."
  const removed = createParticle("activity", {id:revisionIds.removed,workspaceId:scope.organizationId,title:"Old flyer",now:date})
  objective.data.planning={plans:[{id:revisionIds.first,title:"Workshop preparation",revision:0,particleIds:[kept.id,removed.id],links:[{source:kept.id,target:removed.id}]},{id:revisionIds.second,title:"Marketing",revision:0,particleIds:[kept.id],links:[]}],proposals:[]}
  graph.particles=[objective,kept,removed]
  return particleGraphSchema.parse(graph)
}
export function RevisionFixture() {
  const [graph,setGraph]=useState<ParticleGraph>(()=>JSON.parse(localStorage.getItem("revision-graph") ?? JSON.stringify(initialGraph())))
  const [browse,setBrowse]=useState("")
  const [plannerEnabled,setPlannerEnabled]=useState(true)
  const [error,setError]=useState<string|null>(null),[owner,setOwner]=useState(true)
  const current=useRef(graph);current.current=graph
  const save=(next:ParticleGraph)=>{current.current=next;localStorage.setItem("revision-graph",JSON.stringify(next));setGraph(next)}
  const commit=async(operations:ParticleOperation[])=>{
    const previous=current.current
    const reviewed=operations.flatMap(operation=>operation.kind==="put_particle"&&operation.particle.type==="objective"?operation.particle.data.planning?.proposals??[]:[]).find(proposal=>proposal.reviewedAt)
    const now=reviewed?.reviewedAt??new Date().toISOString()
    const applied=await applyParticleBatch(previous,{id:crypto.randomUUID(),workspaceId:graph.workspaceId,baseRevision:previous.revision,operations},now)
    if(!applied.ok){setError(applied.error);return false}
    const denied=particlePlanningPermissionError(previous,applied.value.graph,{userId:scope.userId,isOrganizationOwner:owner},now)
    if(denied){setError(denied);return false}
    save(applied.value.graph);setError(null);return true
  }
  const controls={graph,canEdit:true,pending:false,error,selectedId:revisionIds.objective,getCurrentGraph:()=>current.current,commit,
    edit:async(particle:ParticleGraph["particles"][number])=>commit([{kind:"put_particle",particle,expectedRevision:particle.revision}]),select:()=>true,focusCanvas:()=>true,flow:{current:null},layout:{run:async()=>true},
    applyResearch:async(runId:string, _target: unknown, draft?: ResearchDraft)=>{
      if (localStorage.getItem("revision-fail-next-save")) { localStorage.removeItem("revision-fail-next-save"); return null }
      const result=JSON.parse(localStorage.getItem(`revision-result:${runId}`)??"null") as ResearchResult|null
      if(!result)throw new Error("Fixture research not found")
      const operations=researchPlanOperations(current.current,applyResearchDraft(result,draft),scope.userId,new Date().toISOString(),()=>crypto.randomUUID())
      return await commit(operations)?{graph:current.current,inverse:[],replayed:false}:null
    },
  } as unknown as PlanningControls
  const actions=useParticlePlans(scope,controls)
  const objective=graph.particles.find(particle=>particle.type==="objective")
  const newEntry=new URLSearchParams(window.location.search).has("new-objective")
  return <main className={`mx-auto max-w-xl space-y-3 bg-background p-4 text-foreground ${new URLSearchParams(window.location.search).has("stacked-menu") ? "relative z-10" : ""}`}>
    <p>Fictional revision fixture. Simulated research and browser persistence; no live AI or production connection.</p>
    <div className="flex flex-wrap gap-2"><Button onClick={()=>setOwner(!owner)}>{owner?"Use member role":"Use owner role"}</Button><Button onClick={()=>{
      const latest=current.current.particles.find(particle=>particle.id===objective?.id)
      if(latest?.type!=="objective"||!latest.data.planning)return
      void commit([{kind:"put_particle",expectedRevision:latest.revision,particle:{...latest,data:{...latest.data,planning:{...latest.data.planning,plans:latest.data.planning.plans.map(plan=>plan.id===revisionIds.first?{...plan,summary:"Changed in the fixture"}:plan)}}}}])
    }}>Advance fixture plan revision</Button></div>
    {error&&<p role="alert">{error}</p>}
    {newEntry && <WorkspaceNewPlan {...scope} canvasId={null} revision={graph.revision} disabled={false} enabled={plannerEnabled} onProposal={async (result, draft)=>Boolean(await controls.applyResearch(result.runId,result.target.mode === "new_objective" ? result.target : result.target.objectiveId,draft))}>{planner => <ParticleComposer planner={planner} disabled={false} pending={false} error={error} saved={false}
      onCreate={async(type,title)=>commit([{kind:"put_particle",expectedRevision:null,particle:createParticle(type,{id:crypto.randomUUID(),workspaceId:scope.organizationId,title,now:date})}])}
      onBrowse={(query,open)=>setBrowse(open === false ? "" : query || "All Particles")}
      onRetry={()=>undefined} />}</WorkspaceNewPlan>}
    {newEntry && <><Button onClick={()=>setPlannerEnabled(value=>!value)}>Toggle planning availability</Button><output data-testid="composer-search">{browse}</output></>}
    {newEntry && <Button onClick={()=>void commit([{kind:"put_particle",expectedRevision:null,particle:createParticle("activity",{id:crypto.randomUUID(),workspaceId:scope.organizationId,title:"Concurrent note",now:date})}])}>Add unrelated note</Button>}
    <PlanParticleList label="Objectives list" particles={objective ? [objective] : []} disabled={false} onMove={()=>undefined}>{objective?.type === "objective" && <ParticleObjectiveCard objective={objective} controls={controls} actions={{...actions,owner:owner&&actions.owner}} userId={scope.userId}/>}</PlanParticleList>
    <output data-testid="revision-state" hidden>{JSON.stringify(graph)}</output>
  </main>
}
