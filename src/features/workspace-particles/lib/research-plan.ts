import { createParticle } from "./particle-registry"
import type { Particle, ParticleGraph, ParticleOperation } from "../types"
import type { ParticlePlanProposal } from "./particle-plan-schema"
import type { ResearchResult } from "@/features/workspace-ai/client"

/** One revision-checked batch. Research can add a pending branch, never edit accepted work. */
export function researchPlanOperations(graph:ParticleGraph,result:ResearchResult,actorId:string,now:string,uuid:()=>string):ParticleOperation[] {
  const objective=graph.particles.find(p=>p.id===result.target.objectiveId)
  if(objective?.type!=="objective" || graph.workspaceId!==result.target.organizationId) throw new Error("Objective unavailable.")
  if(objective.data.planning?.proposals.some(p=>p.researchRunId===result.runId) || objective.data.planning?.plans.some(p=>p.researchRunId===result.runId)) return []
  if(objective.revision!==result.target.revision) throw new Error("Objective changed. Research again from the current objective before adding this proposal.")
  if(!result.items.length) throw new Error("Answer the research questions before adding a plan.")
  const byKey=new Map<string,string>(), created:Particle[]=[], revealed:Particle[]=[], seen=new Set<string>()
  for(const [index,item] of result.items.entries()) {
    const existing=item.referenceId?.startsWith("particle:")?graph.particles.find(p=>`particle:${p.id}`===item.referenceId):undefined
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
  const proposal:ParticlePlanProposal={id:uuid(),planId:uuid(),baseRevision:null,title:result.title,particleIds:[...byKey.values()],links:[...links,...decisionLinks],authorId:actorId,createdAt:now,status:"pending",researchRunId:result.runId,summary:result.summary,sources:result.sources}
  return [...revealed.map(particle=>({kind:"put_particle" as const,particle,expectedRevision:particle.revision})),...created.map(particle=>({kind:"put_particle" as const,particle,expectedRevision:null})),{kind:"put_particle",particle:{...objective,data:{...objective.data,planning:{plans:objective.data.planning?.plans??[],proposals:[...(objective.data.planning?.proposals??[]),proposal]}}},expectedRevision:objective.revision}]
}
