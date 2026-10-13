"use client"

import type { ColumnDef } from "@tanstack/react-table"

import type { OrgPersonWithImage } from "@/components/people/supporters-showcase"
import { Checkbox } from "@/components/ui/checkbox"
import type {
  OrganizationPeopleTag,
  OrganizationPeopleTagColor,
} from "@/lib/people/tags"

import type { WorkspaceCustomPeopleSegment } from "./workspace-canvas-people-segment-types"
import {
  WorkspacePeopleDrawerSegmentsCell,
  WorkspacePeopleDrawerTagsCell,
} from "./workspace-canvas-overlay-people-table-multi-value-cells"
import {
  WorkspacePeopleDrawerActionCell,
  WorkspacePeopleDrawerCanvasCell,
  WorkspacePeopleDrawerEmailCell,
  WorkspacePeopleDrawerPersonCell,
  WorkspacePeopleDrawerReportsToCell,
  WorkspacePeopleDrawerRelationshipCell,
  WorkspacePeopleDrawerSocialMediaCell,
} from "./workspace-canvas-overlay-people-table-cells"
import {
  WORKSPACE_PEOPLE_DRAWER_COLUMN_DIMENSIONS,
  type WorkspacePeopleTableContentMode,
  type WorkspacePeopleTableRowHeight,
} from "./workspace-canvas-overlay-people-table-sizing"

export const WORKSPACE_PEOPLE_DRAWER_COLUMN_LABELS: Record<string, string> = {
  person: "Person",
  role: "Role",
  segments: "Segments",
  tags: "Tags",
  reportsTo: "Reports To",
  email: "Email",
  linkedin: "Social Media",
  action: "Action",
  canvas: "Canvas",
}

type BuildWorkspacePeopleDrawerColumnsArgs = {
  peopleById: ReadonlyMap<string, OrgPersonWithImage>
  tags: OrganizationPeopleTag[]
  canEdit: boolean
  contentMode: WorkspacePeopleTableContentMode
  rowHeight: WorkspacePeopleTableRowHeight
  showReportsTo: boolean
  segments: WorkspaceCustomPeopleSegment[]
  customSegment: WorkspaceCustomPeopleSegment | null
  customSegmentMemberIds: ReadonlySet<string> | null
  onAdd: (personId: string) => void
  onRemove: (personId: string) => void
  onAddPeopleToCanvas: (personIds: string[]) => number
  onRemovePersonFromCanvas: (personId: string) => void
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
  onEditPerson: (person: OrgPersonWithImage) => void
  openSegmentMenuPersonId: string | null
  openTagMenuPersonId: string | null
  onSegmentMenuOpenChange: (personId: string, open: boolean) => void
  onTagMenuOpenChange: (personId: string, open: boolean) => void
  onUpdateTag: (input: {
    color: OrganizationPeopleTagColor
    label: string
    tagId: string
  }) => Promise<boolean>
  placedPersonIds: ReadonlySet<string>
}

export function buildWorkspacePeopleDrawerColumns({
  peopleById,
  tags,
  canEdit,
  contentMode,
  rowHeight,
  showReportsTo,
  segments,
  customSegment,
  customSegmentMemberIds,
  onAdd,
  onRemove,
  onAddPeopleToCanvas,
  onRemovePersonFromCanvas,
  onAddPersonToSegment,
  onCreateSegment,
  onRemovePersonFromSegment,
  onAddPersonToTag,
  onCreateTag,
  onDeleteTag,
  onRemovePersonFromTag,
  onEditPerson,
  openSegmentMenuPersonId,
  openTagMenuPersonId,
  onSegmentMenuOpenChange,
  onTagMenuOpenChange,
  onUpdateTag,
  placedPersonIds,
}: BuildWorkspacePeopleDrawerColumnsArgs): ColumnDef<OrgPersonWithImage>[] {
  const columns: ColumnDef<OrgPersonWithImage>[] = [
    {
      id: "select",
      enableHiding: false,
      header: ({ table }) => (
        <div className="grid w-full place-items-center">
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
            onCheckedChange={(value) =>
              table.toggleAllPageRowsSelected(Boolean(value))
            }
            aria-label="Select all people"
          />
        </div>
      ),
      cell: ({ row }) => (
        <div className="grid w-full place-items-center">
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(Boolean(value))}
            aria-label={`Select ${row.original.name}`}
          />
        </div>
      ),
    },
    {
      id: "person",
      enableHiding: false,
      header: WORKSPACE_PEOPLE_DRAWER_COLUMN_LABELS.person,
      cell: ({ row }) => (
        <WorkspacePeopleDrawerPersonCell
          person={row.original}
          contentMode={contentMode}
          rowHeight={rowHeight}
          onOpenPerson={onEditPerson}
        />
      ),
    },
    {
      id: "role",
      header: WORKSPACE_PEOPLE_DRAWER_COLUMN_LABELS.role,
      cell: ({ row }) => (
        <WorkspacePeopleDrawerRelationshipCell
          person={row.original}
          canEdit={canEdit}
        />
      ),
    },
    {
      id: "segments",
      header: WORKSPACE_PEOPLE_DRAWER_COLUMN_LABELS.segments,
      cell: ({ row }) => (
        <WorkspacePeopleDrawerSegmentsCell
          person={row.original}
          segments={segments}
          canEdit={canEdit}
          contentMode={contentMode}
          rowHeight={rowHeight}
          open={openSegmentMenuPersonId === row.original.id}
          onOpenChange={(open) =>
            onSegmentMenuOpenChange(row.original.id, open)
          }
          onAdd={onAddPersonToSegment}
          onCreate={onCreateSegment}
          onRemove={onRemovePersonFromSegment}
        />
      ),
    },
    {
      id: "tags",
      header: WORKSPACE_PEOPLE_DRAWER_COLUMN_LABELS.tags,
      cell: ({ row }) => (
        <WorkspacePeopleDrawerTagsCell
          person={row.original}
          tags={tags}
          canEdit={canEdit}
          contentMode={contentMode}
          rowHeight={rowHeight}
          open={openTagMenuPersonId === row.original.id}
          onOpenChange={(open) => onTagMenuOpenChange(row.original.id, open)}
          onAdd={onAddPersonToTag}
          onCreate={onCreateTag}
          onDelete={onDeleteTag}
          onRemove={onRemovePersonFromTag}
          onUpdate={onUpdateTag}
        />
      ),
    },
  ]

  if (showReportsTo) {
    columns.push({
      id: "reportsTo",
      header: WORKSPACE_PEOPLE_DRAWER_COLUMN_LABELS.reportsTo,
      cell: ({ row }) => (
        <WorkspacePeopleDrawerReportsToCell
          person={row.original}
          peopleById={peopleById}
        />
      ),
    })
  }

  columns.push(
    {
      id: "email",
      header: WORKSPACE_PEOPLE_DRAWER_COLUMN_LABELS.email,
      cell: ({ row }) => (
        <WorkspacePeopleDrawerEmailCell person={row.original} />
      ),
    },
    {
      id: "linkedin",
      header: WORKSPACE_PEOPLE_DRAWER_COLUMN_LABELS.linkedin,
      cell: ({ row }) => (
        <WorkspacePeopleDrawerSocialMediaCell
          person={row.original}
          canEdit={canEdit}
          onEditPerson={onEditPerson}
        />
      ),
    }
  )

  columns.push({
    id: "action",
    enableHiding: false,
    header: WORKSPACE_PEOPLE_DRAWER_COLUMN_LABELS.action,
    cell: ({ row }) => (
      <WorkspacePeopleDrawerActionCell
        person={row.original}
        placed={placedPersonIds.has(row.original.id)}
        customSegment={customSegment}
        customSegmentMemberIds={customSegmentMemberIds}
        onAddToCanvas={onAddPeopleToCanvas}
        onRemoveFromCanvas={onRemovePersonFromCanvas}
        onAddToSegment={onAdd}
        onRemoveFromSegment={onRemove}
      />
    ),
  })

  columns.push({
    id: "canvas",
    header: () => <span className="sr-only">Canvas status and drag</span>,
    cell: ({ row }) => (
      <WorkspacePeopleDrawerCanvasCell
        person={row.original}
        placed={placedPersonIds.has(row.original.id)}
        onAddToCanvas={onAddPeopleToCanvas}
      />
    ),
  })

  return columns.map((column) => {
    const dimensions = column.id
      ? WORKSPACE_PEOPLE_DRAWER_COLUMN_DIMENSIONS[column.id]
      : undefined

    return dimensions ? { ...column, ...dimensions } : column
  })
}
