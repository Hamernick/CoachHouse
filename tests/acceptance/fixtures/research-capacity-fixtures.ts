import type { z } from "zod"
import type { generatedResearchSchema, ResearchRequest } from "@/features/workspace-ai/research-types"
import type { ResearchContext } from "@/features/workspace-ai/server/research-context"
import { ID, WORKSPACE, graph, particle } from "./particle-fixtures"

// Synthetic specimens qualify local contracts, never model usefulness or token usage.
export function capacityContext(members = 0, dense = false) {
  const objective = particle(1, "objective")
  if (objective.type !== "objective") throw new Error("Expected objective")
  objective.title = "Improve community program delivery"
  const items = Array.from({ length: members }, (_, index) => {
    const item = particle(index + 2)
    item.title = dense ? `Existing work ${index + 1}: `.padEnd(240, "x") : `Existing work ${index + 1}`
    return item
  })
  if (members) objective.data.planning = {
    plans: [{ id: ID(50), revision: 0, title: "Delivery plan", particleIds: items.map(item => item.id),
      links: items.slice(1).map((item, index) => ({ source: items[index].id, target: item.id })) }],
    proposals: [],
  }
  const target = { organizationId: WORKSPACE, objectiveId: objective.id, revision: 0,
    ...(members ? { plan: { id: ID(50), revision: 0 } } : {}) }
  return { user: { id: ID(90) }, canvasId: null, objective, graph: graph([objective, ...items]), target } as ResearchContext
}

export function capacityRequest(context: ResearchContext, prompt = "Propose the next useful steps. Preserve existing work."): ResearchRequest {
  return { id: ID(900), target: context.target, prompt, skill: "planning", tariffVersion: "fixture", maximumCredits: 125 }
}

type Draft = z.infer<typeof generatedResearchSchema>
export function capacityDraft(count: number, dense = false): Draft {
  const titles = ["Agree on desired outcome", "Review available team capacity", "Confirm the delivery approach", "Gather supporting program information",
    "Identify the responsible people", "Prepare the working materials", "Review proposed program changes", "Confirm remaining open questions",
    "Coordinate the delivery schedule", "Review early program feedback", "Address the remaining gaps", "Record the next steps"]
  return { title: "Improve program delivery", summary: "Proposed work; dates and owners need confirmation.", questions: [], unfulfilled: [], decisions: [], removeReferences: [],
    items: Array.from({ length: count }, (_, index) => ({ key: `step_${index}`, title: titles[index] ?? "Additional proposed work", kind: "note",
      description: dense ? "Synthetic boundary specimen. ".repeat(80).slice(0, 1800) : "Confirm the necessary information with the team before proceeding.",
      referenceId: null, evidenceIds: [], dependsOn: index ? [`step_${index - 1}`] : [] })),
  }
}

export function capacityBranchDraft(): Draft {
  const draft = capacityDraft(3)
  draft.items[0] = { ...draft.items[0], kind: "decision", title: "Choose the delivery approach" }
  draft.items[1].dependsOn = []; draft.items[2].dependsOn = []
  draft.decisions = [{ itemKey: "step_0", outcomes: [
    { key: "internal", label: "Deliver with our team", next: ["step_1"] },
    { key: "partner", label: "Work with a partner", next: ["step_2"] },
  ] }]
  return draft
}
