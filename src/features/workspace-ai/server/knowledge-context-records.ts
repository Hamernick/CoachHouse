import "server-only"
import { createHash } from "node:crypto"
import { loadParticleAssigneesAction } from "@/features/workspace-particles/server"
import type { KnowledgeRecord } from "../research-types"
import type { ResearchContext } from "./research-context"
import { knowledgePersonData } from "./knowledge-person"

export async function teamKnowledgeRecords(context: ResearchContext): Promise<KnowledgeRecord[]> {
  const people = await loadParticleAssigneesAction(context.target.organizationId)
  return people.map(person => {
    const title = person.invited ? "Invited team member" : "Team member"
    const identity = { name: person.name, email: person.email ?? null, title }
    return { id: `person:team:${person.id}`, kind: "person", title: person.name.slice(0,240),
      avatarSource: person.avatarUrl, content: JSON.stringify({ title }), searchContent: title, href: "/workspace?drawer=people",
      revision: createHash("sha256").update(JSON.stringify(identity)).digest("hex"), contentAvailable: true,
      personData: knowledgePersonData({ title, email: person.email }),
    }
  })
}

export function planKnowledgeRecords(context: ResearchContext, includeReviewed = false): KnowledgeRecord[] {
  return context.graph.particles.flatMap(objective => {
    if (objective.type !== "objective") return []
    const entries = [
      ...(objective.data.planning?.plans ?? []).map(plan => ({ plan, kind:"plan", revision:String(plan.revision), status:"Accepted" })),
      ...(objective.data.planning?.proposals ?? []).filter(proposal => includeReviewed || proposal.status === "pending")
        .map(plan => ({ plan, kind:"proposal", revision:`${plan.baseRevision ?? "new"}:${plan.createdAt}`, status:"Proposed" })),
    ]
    return entries.map(({plan,kind,revision,status}) => {
      const members = plan.particleIds.map(id => context.graph.particles.find(particle => particle.id === id))
      const content = JSON.stringify({ canvasId:context.canvasId, objectiveId:objective.id, objective:objective.title,
        id:plan.id, title:plan.title, revision, status, summary:plan.summary, links:plan.links ?? [],
        members:members.map(p => p ? {id:`particle:${p.id}`,title:p.title,type:p.type,status:p.status,revision:p.revision} : null) })
      return { id:`particle:${objective.id}:${kind}:${plan.id}`, kind:"particle" as const, title:plan.title,
        content:content.slice(0,20000), contentTruncated:content.length>20000, searchContent:status,
        revision:`${objective.revision}:${revision}`, contentAvailable:true, href:"/workspace" }
    })
  })
}
