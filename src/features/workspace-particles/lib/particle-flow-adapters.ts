import { particlePlanBranchStates } from "./particle-plan-branches"
import { visibleParticleConnections } from "./particle-placement"
import type { Edge } from "@xyflow/react"
import type { ParticleLayout } from "./graph-layout"
import type { ParticleConnection, ParticleGraph } from "../types"

export function withPendingParticleConnection(
  graph: ParticleGraph,
  preview: ParticleConnection | null
) {
  return preview && !graph.connections.some((item) => item.id === preview.id)
    ? { ...graph, connections: [...graph.connections, preview] }
    : graph
}

export function particleConnectionsToFlow(
  graph: ParticleGraph,
  routes: ParticleLayout["routes"] = [],
  toolIds: readonly string[] = [],
  preview: ParticleConnection | null = null
): Edge[] {
  const visibleGraph = withPendingParticleConnection(graph, preview)
  const edges: Edge[] = visibleParticleConnections(visibleGraph, toolIds).map((connection) => {
    const source = graph.particles.find(
      (particle) => particle.id === connection.source
    )
    const outcome =
      source?.type === "decision"
        ? source.data.outcomes.find((item) => item.id === connection.outcome)
        : undefined
    const chosen =
      source?.type === "decision" && source.data.selectedOutcome !== null
    return {
      id: connection.id,
      source: connection.source,
      target: connection.target,
      sourceHandle: connection.sourceHandle,
      targetHandle: connection.targetHandle,
      type: "workspace-particle",
      data: {
        points: routes.find((route) => route.id === connection.id)?.points,
      },
      label: outcome?.label,
      interactionWidth: 28,
      selectable: false,
      deletable: false,
      style: {
        stroke: "var(--muted-foreground)",
        strokeWidth:
          chosen && source.data.selectedOutcome === connection.outcome
            ? 2.5
            : 2,
        opacity:
          chosen &&
          connection.relationship === "decision_outcome" &&
          source.data.selectedOutcome !== connection.outcome
            ? 0.35
            : 1,
      },
    }
  })
  // Membership is a projection, not a dependency or an editable graph edge.
  for (const objective of graph.particles) {
    if (objective.type !== "objective" || objective.canvasHidden) continue
    const branches = [...(objective.data.planning?.plans ?? []).map(plan=>({plan,pending:false})),...(objective.data.planning?.proposals ?? []).filter(proposal=>proposal.status === "pending").map(proposal=>({plan:proposal,pending:true}))]
    for(const {plan,pending} of branches) {
      const links=plan.links ?? []
      const states=particlePlanBranchStates(plan,graph.particles)
      const pairs=[...plan.particleIds.filter(id=>!links.some(link=>link.target===id)).map(id=>({source:objective.id,target:id,outcome:undefined})),...links]
      for(const pair of pairs) {
        if(![pair.source,pair.target].every(id=>graph.particles.some(item=>item.id===id&&!item.canvasHidden)))continue
        const decision=graph.particles.find(item=>item.id===pair.source)
        const outcome=decision?.type === "decision" ? decision.data.outcomes.find(item=>item.id===pair.outcome) : undefined
        const inactive=states.get(pair.target)==="inactive" || Boolean(pair.outcome && decision?.type === "decision" && decision.data.selectedOutcome && decision.data.selectedOutcome!==pair.outcome)
        edges.push({id:`plan-member:${objective.id}:${plan.id}:${pair.source}:${pair.target}${pair.outcome ? `:${pair.outcome}` : ""}`,source:pair.source,target:pair.target,
          sourceHandle:pair.outcome?`outcome:${pair.outcome}`:"out",label:outcome?.label,targetHandle:"in",type:"smoothstep",selectable:false,deletable:false,
          ariaLabel:pending?"Proposed plan relationship":"Plan membership",
          style:{stroke:pending?"var(--chart-3)":"var(--muted-foreground)",strokeWidth:2,opacity:inactive?0.3:states.get(pair.target)==="waiting"?0.65:1,...(pending?{strokeDasharray:"4 5"}:{})},
        })
      }
    }
  }
  return edges
}
