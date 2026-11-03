import "server-only"
import { getParticleCapabilityCatalog } from "@/features/workspace-particles"
import { researchSkills } from "../lib/research-skills"
import type { ResearchRequest } from "../research-types"
import type { ResearchContext } from "./research-context"
import { researchFormOutputsEnabled, researchDataViewOutputsEnabled } from "./research-output-config"
import { assertResearchCapabilities } from "../lib/research-capabilities"

const coverage = (total: number, limit: number) => ({ shown: Math.min(total, limit), total, omitted: Math.max(0, total - limit) })

/** The selected plan is complete or rejected; other context is an explicit bounded overview. */
export function researchContextProjection(context: ResearchContext, target = context.target) {
  if (target.mode === "new_objective") return {
    mode: "new_objective", canvasId: target.canvasId,
    existingObjectives: context.graph.particles.filter(item => item.type === "objective").slice(0, 8)
      .map(item => ({ id: `particle:${item.id}`, title: item.title, revision: item.revision })),
    objectiveCoverage: coverage(context.graph.particles.filter(item => item.type === "objective").length, 8),
    note: "Propose a new objective and its first plan. Nothing has been created. Use workspace tools for relevant details; do not duplicate existing work.",
  }
  if (!context.objective) throw new Error("Objective unavailable.")
  const plans = context.objective.data.planning?.plans ?? []
  const pending = context.objective.data.planning?.proposals.filter(proposal => proposal.status === "pending") ?? []
  const selected = target.plan
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
  return { title: context.objective.title, description: context.objective.description,
    ...(selectedPlan ? { selectedPlan } : { plans: plans.slice(0, 4).map(value => ({ id: value.id, revision: value.revision, title: value.title, particleIds: value.particleIds.slice(0, 8), memberCoverage: coverage(value.particleIds.length, 8) })), planCoverage: coverage(plans.length, 4) }),
    pendingProposals: pending.slice(0, 4).map(proposal => proposal.title),
    pendingProposalCoverage: coverage(pending.length, 4),
  }
}

export function researchPrompt(context: ResearchContext, request: Pick<ResearchRequest, "prompt" | "skill" | "target" | "publicResearch">) {
  // Adapt the existing registry; registration alone never enables a new AI writer.
  const catalog = getParticleCapabilityCatalog()
  const plan = catalog.entries.find(entry => entry.id === "plan" && entry.action === "change_plan")
  const note = catalog.entries.find(entry => entry.id === "workspace_note" && entry.action === "edit_note")
  if (!plan || !note) throw new Error("Planning outputs unavailable.")
  const forms = researchFormOutputsEnabled()
  const dataViews = researchDataViewOutputsEnabled()
  assertResearchCapabilities(catalog, forms, dataViews,Boolean(context.dataViewSources?.length))
  const outputs = { version: catalog.version, binding: "plan_proposal", capabilities: [plan.id, note.id],
    ...(forms ? { additionalCapabilities: ["workspace_form"], formMode: "new_private_draft", maxFormQuestions: 50 } : {}),
    ...(dataViews ? { dataViewCapability: "project_data_view", dataViewSource: "projects", dataViewMode: "default_view_of_existing_source", availableSavedViews:(context.dataViewSources??[]).map(source=>({sourceViewId:source.viewId,kind:source.source.kind,title:source.sourceTitle,name:source.name})) } : {}),
    unavailable: [...(forms ? [] : ["form_creation"]), "data_table_creation", ...(dataViews ? [] : ["data_view_creation"]), "publishing", "sending", "calendar_booking"], maxItems: 12 }
  const skill = request.skill === "planning" && !request.publicResearch
    ? `${researchSkills.planning} Write usable starter content directly in each proposed note's description, with brief headings, draft wording or a fill-in template tailored to the task. Do not stop at instructions such as "Draft a brief" or "Prepare a template". Fill only facts supplied by the user or authorized evidence; label missing details [unknown] and ask focused questions. For example: "Purpose: [draft purpose from the request]. Participants: [unknown]. Current obstacle: [unknown]. Next decision: [decision supported by the request]." Distinguish proposed wording from verified facts. Do not invent owners, dates, budgets, results or approvals. Keep it concise and useful; avoid repeating procedural caveats in every item.`
    : researchSkills[request.skill]
  return JSON.stringify({ outputs, task: request.prompt, objective: researchContextProjection(context, request.target), skill })
}
