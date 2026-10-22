import type { ObjectivePlan } from "../plan-types"

// Expand only explicit connections or shared canonical steps; titles never imply a relationship.
export function connectedPlans(plans: ObjectivePlan[], selected: string[]) {
  const included = new Set(selected)
  let changed = true
  while (changed) {
    changed = false
    const current = plans.filter(plan => included.has(plan.id))
    const steps = new Set(current.flatMap(plan => plan.stepIds))
    const targets = new Set(current.flatMap(plan => plan.edges.map(edge => edge.target)))
    for (const plan of plans) {
      if (included.has(plan.id)) continue
      if (plan.stepIds.some(id => steps.has(id) || targets.has(id)) || plan.edges.some(edge => steps.has(edge.target))) {
        included.add(plan.id); changed = true
      }
    }
  }
  return plans.filter(plan => included.has(plan.id))
}
export async function layoutPlanSteps(ids: string[], edges: { source: string; target: string; id: string }[]) {
  // Same installed ELK engine as the workspace. No mutations to stored canvas cards or positions.
  const { default: ELK } = await import("elkjs/lib/elk.bundled.js")
  const elk = new ELK()
  try {
    const result = await elk.layout({
      id: "objective-plans", layoutOptions: { "elk.algorithm": "layered", "elk.direction": "RIGHT", "elk.spacing.nodeNode": "40", "elk.layered.spacing.nodeNodeBetweenLayers": "100", "elk.separateConnectedComponents": "true" },
      children: ids.map(id => ({ id, width: 260, height: 120 })),
      edges: edges.map(edge => ({ id: edge.id, sources: [edge.source], targets: [edge.target] })),
    })
    return new Map((result.children ?? []).map(node => [node.id, { x: node.x ?? 0, y: node.y ?? 0 }]))
  } finally { try { elk.terminateWorker() } catch { /* Bundled fallback has no native worker. */ } }
}

export const isObjectivePlanNode = (id: string) => id.startsWith("objective-plan:")
