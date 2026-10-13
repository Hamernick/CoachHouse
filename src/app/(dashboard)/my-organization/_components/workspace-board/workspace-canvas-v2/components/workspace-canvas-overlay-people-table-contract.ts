import type { DragEvent, ReactNode } from "react"

import type { OrgPersonWithImage } from "@/components/people/supporters-showcase"
import type {
  OrganizationPeopleTag,
  OrganizationPeopleTagColor,
} from "@/lib/people/tags"

import type { WorkspaceBoardUiPreferenceScope } from "../../workspace-board-ui-preferences"
import type { WorkspaceCustomPeopleSegment } from "./workspace-canvas-people-segment-types"

export type WorkspacePeopleDrawerTableProps = {
  segmentControls?: ReactNode
  controls?: ReactNode
  emptyMessage?: string
  people: OrgPersonWithImage[]
  allPeople: OrgPersonWithImage[]
  viewerId: string
  uiPreferencesScope: WorkspaceBoardUiPreferenceScope
  placedPersonIds: ReadonlySet<string>
  customSegment: WorkspaceCustomPeopleSegment | null
  segments: WorkspaceCustomPeopleSegment[]
  tags: OrganizationPeopleTag[]
  draggingPersonIds: ReadonlySet<string>
  canEdit: boolean
  showReportsTo: boolean
  label: string
  onDragStart: (personIds: string[], event: DragEvent<HTMLElement>) => void
  onDragEnd: () => void
  onAdd: (personId: string) => void
  onRemove: (personId: string) => void
  onAddPersonToSegment: (segmentId: string, personId: string) => void
  onCreateSegment: (label: string, personId: string) => void
  onRemovePersonFromSegment: (segmentId: string, personId: string) => void
  onAddPersonToTag: (tagId: string, personId: string) => Promise<boolean>
  onCreateTag: (input: {
    color: OrganizationPeopleTagColor
    label: string
    personId?: string
  }) => Promise<boolean>
  onDeleteTag: (tagId: string) => Promise<boolean>
  onRemovePersonFromTag: (tagId: string, personId: string) => Promise<boolean>
  onUpdateTag: (input: {
    color: OrganizationPeopleTagColor
    label: string
    tagId: string
  }) => Promise<boolean>
  onAddPeopleToCanvas: (personIds: string[]) => number
  onRemovePersonFromCanvas: (personId: string) => void
}
