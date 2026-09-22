import {
  OBJECTIVE_PLAN_LIMIT,
  objectivePlanParts,
  OBJECTIVE_PART_LABELS,
} from "@/features/workspace-objective-planner/client"
import type { ObjectivePlan } from "@/features/workspace-objective-planner/client"
import type {
  ParticlePlacement,
  ParticleSource,
  WorkspaceParticleState,
} from "../types"
import { PARTICLE_LIMIT, PARTICLE_SIZES } from "./particle-state"

export function buildPlanParticleSources(
  plans: ObjectivePlan[]
): ParticleSource[] {
  return plans.flatMap((plan) =>
    objectivePlanParts(plan).map((part) => ({
      ref: { kind: "plan" as const, id: `${plan.id}:${part}` },
      title: part === "objective" ? plan.title : OBJECTIVE_PART_LABELS[part],
      description:
        part === "objective" ? "A connected objective plan." : plan.title,
      available: true,
      plan,
      planPart: part,
    }))
  )
}
export function placeObjectivePlan(
  state: WorkspaceParticleState,
  plan: ObjectivePlan
): WorkspaceParticleState | null {
  const plans = state.plans ?? []
  const previous = plans.find((entry) => entry.id === plan.id)
  if (previous) {
    const oldParts = objectivePlanParts(previous)
    const nextParts = objectivePlanParts(plan)
    const removedIds = new Set(
      oldParts
        .filter((part) => !nextParts.includes(part))
        .map((part) => `particle-${plan.id}-${part}`)
    )
    const addedParts = nextParts.filter((part) => !oldParts.includes(part))
    const keptItems = state.items.filter((item) => !removedIds.has(item.id))
    let connections = state.connections.filter(
      (edge) => !removedIds.has(edge.source) && !removedIds.has(edge.target)
    )
    let additions: ParticlePlacement[] = []
    if (addedParts.length) {
      // Generate only newly introduced branch cards; existing user positions stay.
      const generated = placeObjectivePlan(
        { ...state, items: [], plans: [], connections: [] },
        plan
      )!
      const right = keptItems.length
        ? Math.max(
            ...keptItems.map((item) => item.x + PARTICLE_SIZES[item.size].width)
          ) + 96
        : 100
      if (right + 1000 > 50000) return null
      additions = generated.items
        .filter((item) =>
          addedParts.some((part) => item.source.id === `${plan.id}:${part}`)
        )
        .map((item) => ({ ...item, x: item.x + right }))
      connections = connections.filter(
        (edge) =>
          !(
            edge.source === `particle-${plan.id}-objective` &&
            edge.target === `particle-${plan.id}-steps`
          )
      )
      const addedIds = new Set(additions.map((item) => item.id))
      connections.push(
        ...generated.connections.filter(
          (edge) => addedIds.has(edge.source) || addedIds.has(edge.target)
        )
      )
    } else if (previous.decision && !plan.decision) {
      connections.push({
        id: "pending",
        source: `particle-${plan.id}-objective`,
        target: `particle-${plan.id}-steps`,
      })
    }
    if (
      keptItems.length + additions.length > PARTICLE_LIMIT ||
      connections.length > 300
    )
      return null
    return {
      ...state,
      items: [...keptItems, ...additions],
      connections,
      plans: plans.map((entry) => (entry.id === plan.id ? plan : entry)),
    }
  }
  const parts = objectivePlanParts(plan)
  const addedEdges = plan.decision ? 8 : 4
  if (
    plans.length >= OBJECTIVE_PLAN_LIMIT ||
    state.items.length + parts.length > PARTICLE_LIMIT ||
    state.connections.length + addedEdges > 300
  )
    return null
  const left = state.items.length
    ? Math.max(
        ...state.items.map((item) => item.x + PARTICLE_SIZES[item.size].width)
      ) + 96
    : 100
  if (left + (plan.decision ? 1800 : 1100) > 50000) return null
  const shift = plan.decision ? 700 : 0
  const offsets = {
    objective: [0, 124],
    decision: [350, 124],
    yes: [700, 0],
    no: [700, 360],
    steps: [350 + shift, 0],
    checklist: [700 + shift, 0],
    tools: [700 + shift, 244],
    social: [700 + shift, 488],
  }
  const items: ParticlePlacement[] = objectivePlanParts(plan).map((part) => ({
    id: `particle-${plan.id}-${part}`,
    source: { kind: "plan", id: `${plan.id}:${part}` },
    x: left + offsets[part][0],
    y: 100 + offsets[part][1],
    size: "mini",
  }))
  const pairs = plan.decision
    ? [
        ["objective", "decision"],
        ["decision", "yes"],
        ["decision", "no"],
        ["yes", "steps"],
        ["no", "steps"],
      ]
    : [["objective", "steps"]]
  const edges = [
    ...pairs,
    ["steps", "checklist"],
    ["steps", "tools"],
    ["steps", "social"],
  ].map(([source, target]) => ({
    id: "pending",
    source: `particle-${plan.id}-${source}`,
    target: `particle-${plan.id}-${target}`,
  }))
  return {
    ...state,
    plans: [...plans, plan],
    items: [...state.items, ...items],
    connections: [...state.connections, ...edges],
  }
}
