"use client"
import { useEffect, useRef, useState } from "react"
import type { ObjectiveIslandData, ObjectiveStep } from "../island-types"
import type { ObjectivePlan } from "../plan-types"
import type { ObjectivePlanProjection } from "../components/objective-plan-node"
import { connectedPlans, layoutPlanSteps } from "../lib/plan-projection"

export function usePlanProjection({ data, selected, scopeKey, pending, canEdit, onEdit, onStep, onProjection }: {
  data: ObjectiveIslandData | null; selected: string[]; scopeKey: string; pending: boolean; canEdit: boolean
  onEdit: (plan: ObjectivePlan) => void; onStep: (step: ObjectiveStep, done: boolean) => void
  onProjection?: (projection: ObjectivePlanProjection) => void
}) {
  const [error, setError] = useState<string | null>(null)
  const cache = useRef<{ key: string; positions: Promise<Map<string, { x: number; y: number }>> } | null>(null)
  useEffect(() => {
    if (!onProjection) return
    let canceled = false
    const plans = connectedPlans((data?.planning?.plans ?? []).filter(plan => data?.objectives.some(objective => objective.id === plan.objectiveId && objective.status !== "archived")), selected)
    const available = new Set((data?.steps ?? []).map(step => step.id))
    const ids = [...new Set(plans.flatMap(plan => plan.stepIds))].filter(id => available.has(id)).sort()
    const steps = (data?.steps ?? []).filter(step => ids.includes(step.id))
    const edges = plans.flatMap(plan => plan.edges).filter(edge => ids.includes(edge.source) && ids.includes(edge.target))
    const key = JSON.stringify([ids, edges.map(edge => [edge.id, edge.source, edge.target])])
    if (cache.current?.key !== key) cache.current = { key, positions: ids.length ? layoutPlanSteps(ids, edges) : Promise.resolve(new Map()) }
    void cache.current.positions.then(positions => {
      if (canceled) return
      setError(null)
      onProjection({ scopeKey, focusKey: selected.slice().sort().join(":"),
        nodes: steps.map(step => {
          const owners = plans.filter(plan => plan.stepIds.includes(step.id))
          return { id: `objective-plan:${step.id}`, type: "objectivePlanStep", width: 260, height: 120, position: positions.get(step.id) ?? { x: 0, y: 0 }, draggable: false, selectable: false, deletable: false, connectable: false,
            data: { step, plans: owners.map(plan => plan.title).join(" · "), canEdit: canEdit && step.editable, pending, onEdit: () => onEdit(owners[0]), onComplete: done => onStep(step, done) } }
        }),
        edges: edges.map(edge => ({ id: `objective-plan:${edge.id}`, source: `objective-plan:${edge.source}`, target: `objective-plan:${edge.target}`, label: edge.label, type: "smoothstep", deletable: false, selectable: false, style: { stroke: "var(--primary)" }, labelStyle: { fill: "var(--foreground)" }, labelBgStyle: { fill: "var(--card)" } })),
      })
    }).catch(() => { if (!canceled) { cache.current = null; setError("Unable to lay out this plan. Hide the tree and try again.") } })
    return () => { canceled = true }
  }, [data, selected, scopeKey, pending, canEdit, onEdit, onStep, onProjection])
  return error
}
