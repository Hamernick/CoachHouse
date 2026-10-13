"use client"

import { memo } from "react"
import SearchIcon from "lucide-react/dist/esm/icons/search"

import type { OrgPersonWithImage } from "@/components/people/supporters-showcase"
import { Input } from "@/components/ui/input"
import { PersonRoleFilter } from "@/features/people-roles/client"
import type { PersonRoleFilterValue } from "@/lib/people/roles"

import type { WorkspaceCustomPeopleSegment } from "./workspace-canvas-people-segment-types"
import { WorkspacePeopleSegmentPersonPicker } from "./workspace-canvas-people-segment-person-picker"

type WorkspacePeopleDrawerControlsProps = {
  canEdit: boolean
  searchValue: string
  onSearchChange: (value: string) => void
  categoryFilter: PersonRoleFilterValue
  onCategoryFilterChange: (value: PersonRoleFilterValue) => void
  customSegment: WorkspaceCustomPeopleSegment | null
  people: OrgPersonWithImage[]
  availablePeople: OrgPersonWithImage[]
  onAddPeopleToSegment: (personIds: string[]) => void
}

export const WorkspacePeopleDrawerControls = memo(
  function WorkspacePeopleDrawerControls({
    canEdit,
    searchValue,
    onSearchChange,
    categoryFilter,
    onCategoryFilterChange,
    customSegment,
    people,
    availablePeople,
    onAddPeopleToSegment,
  }: WorkspacePeopleDrawerControlsProps) {
    return (
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <div className="relative w-48 min-w-0 max-w-full flex-none">
          {customSegment && canEdit ? (
            <WorkspacePeopleSegmentPersonPicker
              segmentLabel={customSegment.label}
              availablePeople={availablePeople}
              onAddPeople={onAddPeopleToSegment}
            />
          ) : (
            <>
              <SearchIcon aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="workspace-people-search"
                placeholder="Search people…"
                value={searchValue}
                onChange={(event) => onSearchChange(event.target.value)}
                className="h-8 rounded-xl pl-8 text-sm"
                aria-label="Search workspace people"
              />
            </>
          )}
        </div>
        <PersonRoleFilter value={categoryFilter} onChange={onCategoryFilterChange} people={people} />
      </div>
    )
  }
)
