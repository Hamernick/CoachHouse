"use client"

import { summarizeObjectiveProgress } from "../lib/particle-progress"
import { useParticleProgressClock } from "./use-particle-progress-clock"
import { useEffect, type Dispatch, type RefObject, type SetStateAction } from "react"
import type { Node } from "@xyflow/react"
import type { ParticleGraph } from "../types"
import type { ParticleNodeData } from "../components/particle-node"
import type { MembershipResponsibility } from "../lib/particle-membership-responsibility"
import { reconcileParticleNode } from "../lib/particle-node-state"
import { animateParticleNodes } from "../lib/particle-node-transition"

type Input = {
  graph: ParticleGraph | null
  previous: RefObject<Node<ParticleNodeData>[]>
  setNodes: Dispatch<SetStateAction<Node<ParticleNodeData>[]>>
  selectedId: string | null
  expandedId: string | null
  movable: boolean
  pending: boolean
  layoutBusy: boolean
  assignmentVersion: number
  positionVersion: number
  positionPending: (id: string) => boolean
  isResizing: (id: string) => boolean
  isAssignmentDirty: (id: string) => boolean
  memberships: Map<string, MembershipResponsibility[]>
  assignmentContext?: string
  walkthroughId: string | null
  data: Omit<ParticleNodeData, "particle">
}
/** One measured projection owns card and contextual rail bounds. */
export function useParticleNodeProjection(input: Input) {
  const { graph, previous, setNodes, selectedId, expandedId, movable, pending, layoutBusy, positionVersion, assignmentVersion,
    positionPending, isResizing, isAssignmentDirty, memberships, assignmentContext, walkthroughId, data } = input
  const now = useParticleProgressClock(Boolean(graph?.particles.some(item => item.type === "objective" && ["time", "both"].includes(item.data.progress?.mode ?? ""))))
  useEffect(() => {
    const before = previous.current
    const next = (graph?.particles ?? []).filter(particle => !particle.canvasHidden).map(particle => {
      const old = before.find(node => node.id === particle.id)
      return reconcileParticleNode({ old, particle, selectedId, movable, resizing: isResizing(particle.id),
        keepPosition: Boolean(old?.dragging || pending || layoutBusy || positionPending(particle.id)),
        data: { ...data, particle, objectiveProgress: particle.type === "objective" && !particle.data.source ? summarizeObjectiveProgress(particle, graph?.particles ?? [], now) : undefined, expanded: particle.id === expandedId,
          memberships: memberships.get(particle.id) ?? (old?.data.memberships && isAssignmentDirty(particle.id) ? [] : undefined),
          assignmentContext: particle.id === walkthroughId ? assignmentContext : undefined },
      })
    })
    return animateParticleNodes(before, next, setNodes, positionPending, layoutBusy)
  }, [now, graph, previous, setNodes, selectedId, expandedId, movable, pending, layoutBusy, positionVersion, assignmentVersion,
    positionPending, isResizing, isAssignmentDirty, memberships, assignmentContext, walkthroughId, data])
}
