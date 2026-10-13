import type { Node } from "@xyflow/react"

import type { OrgPersonWithImage } from "@/components/people/supporters-showcase"

export const WORKSPACE_CANVAS_PERSON_NODE_SIZE = {
  width: 244,
  height: 64,
} as const

export type WorkspaceCanvasPersonPlacement = {
  personId: string
  x: number
  y: number
}

export function buildWorkspacePeopleDropPlacements(
  personIds: string[],
  center: { x: number; y: number }
): WorkspaceCanvasPersonPlacement[] {
  const columns = Math.ceil(Math.sqrt(personIds.length))
  return personIds.map((personId, index) => ({
    personId,
    x: Math.round(
      center.x - WORKSPACE_CANVAS_PERSON_NODE_SIZE.width / 2 +
      (index % columns) * (WORKSPACE_CANVAS_PERSON_NODE_SIZE.width + 24)
    ),
    y: Math.round(
      center.y - WORKSPACE_CANVAS_PERSON_NODE_SIZE.height / 2 +
      Math.floor(index / columns) * (WORKSPACE_CANVAS_PERSON_NODE_SIZE.height + 24)
    ),
  }))
}

export type WorkspaceCanvasPersonNodePerson = {
  id: string
  name: string
  title?: string | null
  email?: string | null
  image?: string | null
  category: OrgPersonWithImage["category"]
}

export type WorkspaceCanvasPersonNodeData = {
  kind: "workspace-person"
  person: WorkspaceCanvasPersonNodePerson
  canEdit: boolean
  onRemove: (personId: string) => void
}

export type WorkspaceCanvasPersonNode = Node<WorkspaceCanvasPersonNodeData>

export function getWorkspaceCanvasPersonNodeId(personId: string) {
  return `workspace-person:${personId}`
}

export function isWorkspaceCanvasPersonNodeData(
  value: unknown
): value is WorkspaceCanvasPersonNodeData {
  return (
    typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    value.kind === "workspace-person"
  )
}

function resolveWorkspaceCanvasPersonImage(person: OrgPersonWithImage) {
  return person.displayImage ?? person.image ?? null
}

export function toWorkspaceCanvasPersonNodePerson(
  person: OrgPersonWithImage
): WorkspaceCanvasPersonNodePerson {
  return {
    id: person.id,
    name: person.name,
    title: person.title ?? null,
    email: person.email ?? null,
    image: resolveWorkspaceCanvasPersonImage(person),
    category: person.category,
  }
}

export function buildWorkspaceCanvasPersonNode({
  placement,
  person,
  canEdit,
  onRemove,
}: {
  placement: WorkspaceCanvasPersonPlacement
  person: OrgPersonWithImage
  canEdit: boolean
  onRemove: (personId: string) => void
}): WorkspaceCanvasPersonNode {
  return {
    id: getWorkspaceCanvasPersonNodeId(placement.personId),
    type: "workspace-person",
    position: { x: placement.x, y: placement.y },
    zIndex: 8,
    draggable: canEdit,
    selectable: canEdit,
    dragHandle: ".workspace-person-node-drag-handle",
    style: {
      width: WORKSPACE_CANVAS_PERSON_NODE_SIZE.width,
      minHeight: WORKSPACE_CANVAS_PERSON_NODE_SIZE.height,
    },
    data: {
      kind: "workspace-person",
      person: toWorkspaceCanvasPersonNodePerson(person),
      canEdit,
      onRemove,
    },
  }
}
