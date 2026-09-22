"use client"
import { useCallback, useState, type MutableRefObject } from "react"
import type { ReactFlowInstance } from "reactflow"
import {
  chooseObjectiveDecision,
  completeDecisionAction,
  setObjectiveStepComplete,
  type ObjectivePlan,
} from "@/features/workspace-objective-planner/client"
import type { WorkspaceParticleState } from "../types"
import { placeObjectivePlan } from "../lib/particle-plan-state"

export function useParticlePlanController(
  stateRef: MutableRefObject<WorkspaceParticleState>,
  commit: (next: WorkspaceParticleState) => void,
  canEdit: boolean,
  flow: MutableRefObject<ReactFlowInstance | null>
) {
  const [editingPlan, setEditingPlan] = useState<string | null>(null)
  const savePlan = useCallback(
    (plan: ObjectivePlan) => {
      if (!canEdit) return false
      const isNew = !stateRef.current.plans?.some(
        (entry) => entry.id === plan.id
      )
      const next = placeObjectivePlan(stateRef.current, plan)
      if (!next) return false
      commit(next)
      if (isNew)
        window.setTimeout(() => {
          void flow.current?.fitView({
            nodes: next.items
              .filter(
                (item) =>
                  item.source.kind === "plan" &&
                  item.source.id.startsWith(`${plan.id}:`)
              )
              .map((item) => ({ id: item.id })),
            padding: 0.2,
            maxZoom: 0.8,
          })
        }, 150)
      return true
    },
    [canEdit, commit, flow, stateRef]
  )
  const completePlanStep = useCallback(
    (planId: string, stepId: string, complete: boolean) => {
      if (!canEdit) return
      commit({
        ...stateRef.current,
        plans: stateRef.current.plans?.map((plan) =>
          plan.id === planId
            ? setObjectiveStepComplete(plan, stepId, complete)
            : plan
        ),
      })
    },
    [canEdit, commit, stateRef]
  )
  const updateDecision = useCallback(
    (planId: string, choice: "yes" | "no" | null, complete?: boolean) => {
      if (!canEdit) return
      commit({
        ...stateRef.current,
        plans: stateRef.current.plans?.map((plan) =>
          plan.id !== planId
            ? plan
            : complete !== undefined && choice
              ? completeDecisionAction(plan, choice, complete)
              : chooseObjectiveDecision(plan, choice)
        ),
      })
    },
    [canEdit, commit, stateRef]
  )
  return {
    editingPlan,
    setEditingPlan,
    savePlan,
    completePlanStep,
    updateDecision,
  }
}
