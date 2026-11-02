import type { DragEvent } from "react"
import type { OrgPersonWithImage } from "@/components/people/supporters-showcase"

export type NetworkMode = "segments" | "tags"
export type NetworkGroup = { id: string; label: string; memberIds: string[] }
export type NetworkMove = {
  mode: NetworkMode
  personId: string
  from: string | null
  to: string | null
}
export type NetworkMoveResult = { ok: true } | { ok: false; message: string }
export type WorkspacePeopleNetworkProps = {
  people: OrgPersonWithImage[]
  segments: NetworkGroup[]
  tags: NetworkGroup[]
  canEdit: boolean
  loading?: boolean
  expanded?: boolean
  onExpandedChange?: (expanded: boolean) => void
  placedPersonIds: ReadonlySet<string>
  onEdit: (person: OrgPersonWithImage) => void
  onMove: (move: NetworkMove) => Promise<NetworkMoveResult>
  onDragStart: (personIds: string[], event: DragEvent<HTMLElement>) => void
  onDragEnd: () => void
  hasDragPeople: (transfer: DataTransfer) => boolean
  readDragPeople: (transfer: DataTransfer) => string[]
  onAddToCanvas: (personIds: string[]) => number
}
