import { MarkerType, type Edge, type Node } from "@xyflow/react"

import {
  FINANCE_RELEASE_PLAN_NODE_IDS,
  type FinanceReleasePlanNodeData,
  type FinanceReleasePlanNodeKind,
} from "./finance-release-plan-data"
import { FINANCE_RELEASE_PLAN_BATCHES } from "./finance-release-plan-batches"
import { FINANCE_RELEASE_PLAN_GATES } from "./finance-release-plan-gates"
import { FINANCE_PLAN_DECISION_PROGRESS } from "./finance-plan-decision-progress"
import {
  FINANCE_PLAN_BATCH_READINESS,
  FINANCE_PLAN_GATE_READINESS,
} from "./finance-plan-readiness"
import { FINANCE_PLAN_RESEARCH_PROGRESS } from "./finance-plan-research-progress"
import { FINANCE_RELEASE_PLAN_RESEARCH } from "./finance-release-plan-research"
import { FINANCE_RELEASE_PLAN_SUPPORT_NODES } from "./finance-release-plan-support"
import {
  getFinancePlanNodeStatusTone,
  getFinancePlanStatusColor,
} from "./finance-plan-status"

const FINANCE_RELEASE_PLAN_DEFINITIONS = [
  ...FINANCE_RELEASE_PLAN_SUPPORT_NODES,
  ...FINANCE_RELEASE_PLAN_BATCHES,
  ...FINANCE_RELEASE_PLAN_GATES,
  ...FINANCE_RELEASE_PLAN_RESEARCH,
]

const RELEASE_EDGE_COLOR = "#71717a"
const RESEARCH_EDGE_COLOR = "#d97706"

const FINANCE_PLAN_BATCH_READINESS_INDEX = new Map(
  FINANCE_PLAN_BATCH_READINESS.map((batch) => [batch.batchId, batch])
)

const FINANCE_PLAN_GATE_READINESS_INDEX = new Map(
  FINANCE_PLAN_GATE_READINESS.map((gate) => [gate.gateId, gate])
)

const FINANCE_PLAN_RESEARCH_PROGRESS_INDEX = new Map(
  FINANCE_PLAN_RESEARCH_PROGRESS.map((research) => [research.nodeId, research])
)

const FINANCE_PLAN_DECISION_PROGRESS_INDEX = new Map(
  FINANCE_PLAN_DECISION_PROGRESS.map((decision) => [decision.nodeId, decision])
)

export const FINANCE_RELEASE_PLAN_NAVIGATION = [
  { label: "Start", nodeIds: [FINANCE_RELEASE_PLAN_NODE_IDS.start] },
  {
    label: "Decisions",
    nodeIds: [
      FINANCE_RELEASE_PLAN_NODE_IDS.approvalRelease,
      FINANCE_RELEASE_PLAN_NODE_IDS.approvalFiscal,
      FINANCE_RELEASE_PLAN_NODE_IDS.approvalFinance,
      FINANCE_RELEASE_PLAN_NODE_IDS.approvalVisual,
    ],
  },
  ...FINANCE_RELEASE_PLAN_BATCHES.map((batch) => ({
    label: String(batch.sequence),
    nodeIds: [batch.id],
  })),
  {
    label: "Research",
    nodeIds: FINANCE_RELEASE_PLAN_RESEARCH.map((research) => research.id),
  },
  { label: "End", nodeIds: [FINANCE_RELEASE_PLAN_NODE_IDS.finish] },
] as const

export function buildFinanceReleasePlanNodes(): Node<FinanceReleasePlanNodeData>[] {
  return FINANCE_RELEASE_PLAN_DEFINITIONS.map((definition) => {
    const readiness = FINANCE_PLAN_BATCH_READINESS_INDEX.get(definition.id)
    const gateReadiness = FINANCE_PLAN_GATE_READINESS_INDEX.get(definition.id)
    const researchProgress = FINANCE_PLAN_RESEARCH_PROGRESS_INDEX.get(
      definition.id
    )
    const decisionProgress = FINANCE_PLAN_DECISION_PROGRESS_INDEX.get(
      definition.id
    )
    const readinessDetails = readiness
      ? [
          `${readiness.workItemCounts.complete}/${readiness.workItemCounts.total} work items complete`,
          readiness.openInputIds.length
            ? `${readiness.openInputIds.length} open input${readiness.openInputIds.length === 1 ? "" : "s"}`
            : null,
          readiness.blockedByPredecessorBatch
            ? readiness.predecessorLabel
            : null,
          readiness.blockedByPredecessorGate
            ? readiness.predecessorGateLabel
            : null,
        ].filter((detail): detail is string => Boolean(detail))
      : gateReadiness
        ? [
            `${gateReadiness.evidenceCounts.verified}/${gateReadiness.evidenceCounts.total} proof items verified`,
          ]
        : researchProgress
          ? [
              `${researchProgress.itemCounts.verified}/${researchProgress.itemCounts.total} research items verified`,
            ]
          : decisionProgress
            ? [
                `${decisionProgress.itemCounts.approved}/${decisionProgress.itemCounts.total} approval criteria approved`,
              ]
            : undefined

    return {
      id: definition.id,
      type: "financeReleasePlan",
      data: {
        dependencies: definition.dependencies,
        decisionItems: decisionProgress?.items ?? definition.decisionItems,
        diagram: definition.diagram,
        eyebrow: definition.eyebrow,
        executionState: readiness?.executionState ?? definition.executionState,
        footer: definition.footer,
        gateEvidence: definition.gateEvidence,
        gateState: gateReadiness?.gateState ?? definition.gateState,
        inputNodeIds: definition.inputNodeIds,
        inputState:
          researchProgress?.inputState ??
          decisionProgress?.inputState ??
          definition.inputState,
        kind: definition.kind,
        readinessDetails,
        readinessState: readiness?.readinessState,
        researchItems: researchProgress?.items ?? definition.researchItems,
        sequence: definition.sequence,
        sections: definition.sections,
        statusLabel: definition.statusLabel,
        summary: definition.summary,
        title: definition.title,
        workItems: readiness?.workItems ?? definition.workItems,
      },
      position: { x: definition.x, y: definition.y },
      draggable: definition.kind !== "lane",
      focusable: false,
      selectable: false,
      style: {
        height: definition.height,
        width: definition.width,
      },
      height: definition.height,
      width: definition.width,
      zIndex: definition.kind === "lane" ? 1 : 10,
    }
  })
}

function edge({
  id,
  source,
  target,
  kind = "release",
}: {
  id: string
  kind?: "approval" | "release" | "research"
  source: string
  target: string
}): Edge {
  const isResearch = kind === "research"
  const isApproval = kind === "approval"
  const color = isResearch ? RESEARCH_EDGE_COLOR : RELEASE_EDGE_COLOR

  return {
    id,
    source,
    target,
    sourceHandle: isResearch
      ? "research-source"
      : isApproval
        ? "approval-source"
        : "source",
    targetHandle: isResearch
      ? "research-target"
      : isApproval
        ? "approval-target"
        : "target",
    type: "smoothstep",
    interactionWidth: 16,
    markerEnd: {
      color,
      type: MarkerType.ArrowClosed,
    },
    style: {
      stroke: color,
      strokeDasharray: isResearch ? "7 7" : isApproval ? "2 6" : undefined,
      strokeOpacity: isApproval ? 0.75 : 0.9,
      strokeWidth: isResearch ? 1.8 : 2,
    },
  }
}

export function buildFinanceReleasePlanEdges(): Edge[] {
  const releaseSequence = [
    FINANCE_RELEASE_PLAN_NODE_IDS.start,
    FINANCE_RELEASE_PLAN_NODE_IDS.batch1,
    FINANCE_RELEASE_PLAN_NODE_IDS.gate1,
    FINANCE_RELEASE_PLAN_NODE_IDS.batch2,
    FINANCE_RELEASE_PLAN_NODE_IDS.gate2,
    FINANCE_RELEASE_PLAN_NODE_IDS.batch3,
    FINANCE_RELEASE_PLAN_NODE_IDS.gate3,
    FINANCE_RELEASE_PLAN_NODE_IDS.batch4,
    FINANCE_RELEASE_PLAN_NODE_IDS.gate4,
    FINANCE_RELEASE_PLAN_NODE_IDS.batch5,
    FINANCE_RELEASE_PLAN_NODE_IDS.gate5,
    FINANCE_RELEASE_PLAN_NODE_IDS.batch6,
    FINANCE_RELEASE_PLAN_NODE_IDS.gate6,
    FINANCE_RELEASE_PLAN_NODE_IDS.batch7,
    FINANCE_RELEASE_PLAN_NODE_IDS.gate7,
    FINANCE_RELEASE_PLAN_NODE_IDS.finish,
  ]

  const sequenceEdges = releaseSequence.slice(0, -1).map((source, index) =>
    edge({
      id: `release-${index + 1}`,
      source,
      target: releaseSequence[index + 1],
    })
  )

  const inputEdges = FINANCE_RELEASE_PLAN_BATCHES.flatMap((batch) =>
    (batch.inputNodeIds ?? []).map((source) => {
      const sourceDefinition = FINANCE_RELEASE_PLAN_DEFINITIONS.find(
        (definition) => definition.id === source
      )
      const kind =
        sourceDefinition?.kind === "research" ? "research" : "approval"

      return edge({
        id: `${kind}-${source}-to-${batch.id}`,
        kind,
        source,
        target: batch.id,
      })
    })
  )

  const guardrailEdge = edge({
    id: "guardrails-to-start",
    kind: "approval",
    source: FINANCE_RELEASE_PLAN_NODE_IDS.guardrails,
    target: FINANCE_RELEASE_PLAN_NODE_IDS.start,
  })

  return [...sequenceEdges, ...inputEdges, guardrailEdge]
}

export function getFinanceReleasePlanNodeColor(
  data: Pick<
    FinanceReleasePlanNodeData,
    "gateState" | "inputState" | "kind" | "readinessState" | "workItems"
  >
) {
  return getFinancePlanStatusColor(getFinancePlanNodeStatusTone(data))
}

export const FINANCE_RELEASE_PLAN_COUNTS = {
  approvals: 4,
  batches: FINANCE_RELEASE_PLAN_BATCHES.length,
  gates: FINANCE_RELEASE_PLAN_GATES.length,
  researchTracks: FINANCE_RELEASE_PLAN_RESEARCH.length,
} as const
