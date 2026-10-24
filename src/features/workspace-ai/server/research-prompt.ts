import "server-only"
import { researchInstructions, researchSkills } from "../lib/research-skills"
import type { ResearchRequest } from "../research-types"
import type { ResearchContext } from "./research-context"

/** The selected plan is complete or rejected, never silently summarized away. */
export function researchPrompt(context: ResearchContext, request: Pick<ResearchRequest, "prompt" | "skill" | "target">) {
  const selected = request.target.plan
  const plan = selected ? context.objective.data.planning?.plans.find(value => value.id === selected.id) : undefined
  if (selected && (!plan || plan.revision !== selected.revision)) throw new Error("This plan changed. Reopen research from the current plan.")
  const particles = new Map(context.graph.particles.map(particle => [particle.id, particle]))
  const selectedPlan = plan ? { id: plan.id, revision: plan.revision, title: plan.title, links: (plan.links ?? []).map(link => ({ ...link, source: `particle:${link.source}`, target: `particle:${link.target}` })),
    members: plan.particleIds.map(id => {
      const particle = particles.get(id)
      if (!particle) throw new Error("This plan has an unavailable member. Refresh the workspace before researching.")
      return { id: `particle:${id}`, title: particle.title, type: particle.type, revision: particle.revision, status: particle.status,
        ...(particle.type === "decision" ? { outcomes: particle.data.outcomes, selectedOutcome: particle.data.selectedOutcome } : {}) }
    }),
  } : undefined
  return JSON.stringify({ task: request.prompt, objective: { title: context.objective.title, description: context.objective.description,
    ...(selectedPlan ? { selectedPlan } : { plans: context.objective.data.planning?.plans.slice(0, 4).map(value => ({ title: value.title, particleIds: value.particleIds.slice(0, 8) })) }),
    pendingProposals: context.objective.data.planning?.proposals.filter(proposal => proposal.status === "pending").map(proposal => proposal.title).slice(0, 4),
  }, skill: researchSkills[request.skill] })
}

export function assertResearchContextFits(context: ResearchContext, request: Pick<ResearchRequest, "prompt" | "skill" | "target">, maximumBytes: number) {
  const content = researchPrompt(context, request)
  if (Buffer.byteLength(JSON.stringify([{ role: "user", content }]) + researchInstructions) > maximumBytes)
    throw new Error("This plan is too large for one research run. Split it into smaller plans before researching.")
  return content
}
