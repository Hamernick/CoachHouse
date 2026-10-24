import { createParticle, particleRegistry } from "./particle-registry"
import type { Particle, ParticleGraph, ParticleOperation } from "../types"
import { particlePlanProposalSchema } from "./particle-plan-schema"
import { bindResearch } from "@/features/workspace-ai"
import { validateParticleGraph } from "./graph-validation"
import type { ResearchResult } from "@/features/workspace-ai/client"

/** One revision-checked pending proposal; accepted work stays untouched until owner review. */
export function researchPlanOperations(graph:ParticleGraph,result:ResearchResult,actorId:string,now:string,uuid:()=>string):ParticleOperation[] {
  const objective=graph.particles.find(p=>p.id===result.target.objectiveId)
  if(objective?.type!=="objective" || graph.workspaceId!==result.target.organizationId) throw new Error("Objective unavailable.")
  if(objective.data.planning?.proposals.some(p=>p.researchRunId===result.runId) || objective.data.planning?.plans.some(p=>p.researchRunId===result.runId)) return []
  if(objective.revision!==result.target.revision) throw new Error("Objective changed. Research again from the current objective before adding this proposal.")
  const plan=result.target.plan?objective.data.planning?.plans.find(plan=>plan.id===result.target.plan!.id):undefined
  if(result.target.plan && (!plan || plan.revision!==result.target.plan.revision)) throw new Error("Plan changed. Research again from the current plan.")
  const removed=new Set((result.removeReferences??[]).map(id=>id.slice(9)))
  if(removed.size && (!plan || [...removed].some(id=>!plan.particleIds.includes(id)))) throw new Error("Research removes an unavailable plan member.")
  // Saved runs from before declared branches used the registry’s unselected defaults.
  if(result.decisions===undefined) result={...result,decisions:result.items.filter(item=>item.kind==="decision").map(item=>({itemKey:item.key,
    outcomes:particleRegistry.decision.defaults().outcomes.map(outcome=>({key:outcome.id,label:outcome.label,next:[]}))}))}
  const {sources,target,runId,...generated}=result
  bindResearch(JSON.stringify({...generated,decisions:result.decisions??[],removeReferences:result.removeReferences??[]}),sources,target,runId,
    new Map(graph.particles.flatMap(particle=>particle.type==="decision"?[[`particle:${particle.id}`,particle.data.outcomes] as const]:[])))
  if(!result.items.length && !removed.size) throw new Error("Answer the research questions before adding a plan.")
  const byKey=new Map<string,string>(), created:Particle[]=[], revealed:Particle[]=[], seen=new Set<string>()
  for(const [index,item] of result.items.entries()) {
    const existing=item.referenceId?.startsWith("particle:")?graph.particles.find(p=>`particle:${p.id}`===item.referenceId):undefined
    if(item.referenceId?.startsWith("particle:") && !existing) throw new Error("Research references an unavailable workspace item.")
    if(existing) {
      if(existing.type==="objective") throw new Error("An objective cannot be a plan member.")
      if(seen.has(existing.id)) throw new Error("Research repeats a workspace item.")
      if(existing.canvasHidden)revealed.push({...existing,canvasHidden:false})
      seen.add(existing.id);byKey.set(item.key,existing.id);continue
    }
    const id=uuid(),person=item.referenceId?.startsWith("person:")?item.referenceId.slice(7):null
    const particle=createParticle(person?"people":item.kind==="decision"?"decision":"activity",{id,workspaceId:graph.workspaceId,title:item.title,now})
    const sources=result.sources.filter(source=>item.evidenceIds.includes(source.id)||source.id===item.referenceId)
    particle.description=[item.description,...sources.map(source=>`${source.title}: ${source.href}`)].join("\n\n").slice(0,10000)
    particle.position={x:objective.position.x+380,y:objective.position.y+index*280}
    particle.positionMode="managed"
    if(particle.type === "decision") {
      const decision = result.decisions?.find(value=>value.itemKey===item.key)
      if(decision) particle.data={criteria:[],outcomes:decision.outcomes.map(outcome=>({id:outcome.key,label:outcome.label})),selectedOutcome:null}
    }
    if(person && particle.type==="people") particle.data={personIds:[person],presentation:"person",segment:""}
    if(particle.type==="activity") {
      if(item.referenceId?.startsWith("document:")) particle.data.widget={kind:"document",source:{kind:"roadmap",sectionId:item.referenceId.slice(9)},format:"roadmap",name:item.title}
      else if(item.referenceId?.startsWith("opportunity:")) particle.data.widget={kind:"opportunity",organizationId:graph.workspaceId,opportunityId:item.referenceId.slice(12)}
      else if(item.referenceId?.startsWith("file:")) {
        const file=result.sources.find(source=>source.id===item.referenceId)?.file
        if(!file)throw new Error("This file format cannot be placed on the canvas yet.")
        particle.data.widget={kind:"document",fileId:item.referenceId.slice(5),name:item.title,size:file.size,format:file.format}
      }
      else if(item.referenceId?.startsWith("calendar:")) particle.data.source={kind:"calendar_event",id:item.referenceId.slice(9)}
      else if(item.kind==="event") particle.data.widget={kind:"event",startsAt:null}
      else particle.data.widget={kind:"notes",source:{kind:"workspace",content:particle.description ?? item.description}}
    }
    created.push(particle);byKey.set(item.key,id)
  }
  const links=result.items.flatMap(item=>item.dependsOn.map(parent=>({source:byKey.get(parent)!,target:byKey.get(item.key)!})))
  const decisionLinks=(result.decisions ?? []).flatMap(decision=>decision.outcomes.flatMap(outcome=>outcome.next.map(target=>({source:byKey.get(decision.itemKey)!,target:byKey.get(target)!,outcome:outcome.key}))))
  const replacedDependencies=new Set(byKey.values())
  const replacedDecisions=new Set((result.decisions??[]).map(decision=>byKey.get(decision.itemKey)!))
  const preservedLinks=(plan?.links??[]).filter(link=>!removed.has(link.source)&&!removed.has(link.target)&&
    (link.outcome?!replacedDecisions.has(link.source):!replacedDependencies.has(link.target)))
  const combinedSources=[...new Map([...(plan?.sources??[]),...result.sources].map(source=>[source.id,source])).values()]
  if(combinedSources.length>40) throw new Error("This revision exceeds the plan’s 40-source limit. Narrow the research before adding it.")
  const proposal=particlePlanProposalSchema.parse({id:uuid(),planId:plan?.id??uuid(),baseRevision:plan?.revision??null,title:result.title,
    particleIds:[...new Set([...(plan?.particleIds??[]).filter(id=>!removed.has(id)),...byKey.values()])],links:[...preservedLinks,...links,...decisionLinks],
    authorId:actorId,createdAt:now,status:"pending",researchRunId:result.runId,summary:result.summary,
    sources:combinedSources})
  const updated={...objective,data:{...objective.data,planning:{plans:objective.data.planning?.plans??[],proposals:[...(objective.data.planning?.proposals??[]),proposal]}}}
  const error=validateParticleGraph({...graph,particles:[...graph.particles.map(particle=>particle.id===objective.id?updated:particle),...created]})
  if(error) throw new Error(error)
  return [...revealed.map(particle=>({kind:"put_particle" as const,particle,expectedRevision:particle.revision})),...created.map(particle=>({kind:"put_particle" as const,particle,expectedRevision:null})),{kind:"put_particle",particle:updated,expectedRevision:objective.revision}]
}
