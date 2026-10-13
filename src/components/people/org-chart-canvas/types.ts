import type { Edge, Node } from "@xyflow/react"

import type { OrgPerson } from "@/actions/people"

export type ViewPerson = OrgPerson & { displayImage?: string | null }
export type OrgChartCanvasProps = {
  people: ViewPerson[]
  extras?: boolean
  canEdit?: boolean
}

export type PersonNodeData = {
  name: string
  title?: string | null
  image?: string | null
  category?: ViewPerson["category"]
}

export type FlowNode = Node<PersonNodeData>
export type PositionValue = { x: number; y: number }
export type PositionSnapshot = Record<string, PositionValue>
export type PositionPayload = { id: string; x: number; y: number }
export type GraphLayout = { defaultNodes: FlowNode[]; nodes: FlowNode[]; edges: Edge[] }
