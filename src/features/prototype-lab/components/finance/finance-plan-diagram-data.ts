import { MarkerType, type Edge, type Node } from "@xyflow/react"

import type {
  FinanceReleasePlanDefinition,
  FinanceReleasePlanNodeData,
  FinanceReleasePlanNodeKind,
} from "./finance-release-plan-data"

export type FinancePlanDiagramEdgeDefinition = {
  dashed?: boolean
  id: string
  label?: string
  sourceStepCount?: number
  source: string
  target: string
}

export type FinancePlanNavigationTarget = {
  label: string
  nodeIds: readonly string[]
}

export type FinancePlanningViewId =
  | "roadmap"
  | "dependencies"
  | "system"
  | "custody"
  | "webhooks"
  | "data"
  | "signup"
  | "weather"
  | "assurance"

export type FinancePlanningView = {
  buildEdges: () => Edge[]
  buildNodes: () => Node<FinanceReleasePlanNodeData>[]
  id: FinancePlanningViewId
  initialNodeIds: readonly string[]
  label: string
  navigation: readonly FinancePlanNavigationTarget[]
  sourceSection: string
  summary: string
  title: string
}

export function financeDiagramNode({
  eyebrow,
  height = 180,
  id,
  kind = "service",
  sections = [],
  statusLabel,
  summary,
  title,
  width = 320,
  x,
  y,
}: {
  eyebrow: string
  height?: number
  id: string
  kind?: FinanceReleasePlanNodeKind
  sections?: FinanceReleasePlanNodeData["sections"]
  statusLabel: string
  summary: string
  title: string
  width?: number
  x: number
  y: number
}): FinanceReleasePlanDefinition {
  return {
    diagram: true,
    eyebrow,
    height,
    id,
    kind,
    sections,
    statusLabel,
    summary,
    title,
    width,
    x,
    y,
  }
}

export function buildFinanceDiagramNodes(
  definitions: readonly FinanceReleasePlanDefinition[]
): Node<FinanceReleasePlanNodeData>[] {
  return definitions.map((definition) => ({
    id: definition.id,
    type: "financeReleasePlan",
    data: {
      diagram: true,
      eyebrow: definition.eyebrow,
      kind: definition.kind,
      sections: definition.sections,
      statusLabel: definition.statusLabel,
      summary: definition.summary,
      title: definition.title,
    },
    draggable: true,
    focusable: false,
    position: { x: definition.x, y: definition.y },
    selectable: false,
    style: { height: definition.height, width: definition.width },
    height: definition.height,
    width: definition.width,
    zIndex: 10,
  }))
}

export function buildFinanceDiagramEdges(
  definitions: readonly FinancePlanDiagramEdgeDefinition[]
): Edge[] {
  return definitions.map((definition) => ({
    id: definition.id,
    source: definition.source,
    sourceHandle: "diagram-source",
    target: definition.target,
    targetHandle: "diagram-target",
    type: "smoothstep",
    interactionWidth: 16,
    label: definition.label,
    data: {
      sourceStepCount: definition.sourceStepCount ?? 1,
    },
    labelBgBorderRadius: 8,
    labelBgPadding: [6, 3],
    labelBgStyle: { fill: "var(--card)" },
    labelStyle: { fill: "var(--muted-foreground)", fontSize: 11 },
    markerEnd: {
      color: "#71717a",
      type: MarkerType.ArrowClosed,
    },
    style: {
      stroke: "#71717a",
      strokeDasharray: definition.dashed ? "6 6" : undefined,
      strokeOpacity: definition.dashed ? 0.72 : 0.9,
      strokeWidth: definition.dashed ? 1.6 : 2,
    },
  }))
}
