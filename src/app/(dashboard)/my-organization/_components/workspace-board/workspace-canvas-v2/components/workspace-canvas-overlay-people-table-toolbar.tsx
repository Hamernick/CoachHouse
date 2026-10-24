"use client"

import { cn } from "@/lib/utils"
import {
  WorkspaceWindowHeaderPortal,
  useWorkspaceWindowHeader,
  WORKSPACE_HEADER_BUTTON,
} from "@/components/workspace/workspace-window-header-slots"
import type { ReactNode } from "react"
import Columns3Icon from "lucide-react/dist/esm/icons/columns-3"
import FolderOpenIcon from "lucide-react/dist/esm/icons/folder-open"
import RotateCcwIcon from "lucide-react/dist/esm/icons/rotate-ccw"
import SaveIcon from "lucide-react/dist/esm/icons/save"
import ScanLineIcon from "lucide-react/dist/esm/icons/scan-line"
import Trash2Icon from "lucide-react/dist/esm/icons/trash-2"
import type { Table as ReactTable } from "@tanstack/react-table"

import type { OrgPersonWithImage } from "@/components/people/supporters-showcase"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import type { WorkspaceCustomPeopleSegment } from "./workspace-canvas-people-segment-types"
import { WORKSPACE_PEOPLE_DRAWER_COLUMN_LABELS } from "./workspace-canvas-overlay-people-table-columns"
import { WorkspacePeopleDrawerSelectionActions } from "./workspace-canvas-overlay-people-table-selection-actions"
import type {
  WorkspacePeopleTableContentMode,
  WorkspacePeopleTableRowHeight,
} from "./workspace-canvas-overlay-people-table-sizing"

type WorkspacePeopleDrawerTableToolbarProps = {
  addControls?: ReactNode
  segmentControls?: ReactNode
  controls?: ReactNode
  peopleCount: number
  selectedCount: number
  table: ReactTable<OrgPersonWithImage>
  allPeople: OrgPersonWithImage[]
  viewerId: string
  placedPersonIds: ReadonlySet<string>
  customSegment: WorkspaceCustomPeopleSegment | null
  customSegmentMemberIds: ReadonlySet<string> | null
  canEdit: boolean
  contentMode: WorkspacePeopleTableContentMode
  rowHeight: WorkspacePeopleTableRowHeight
  hasSavedLayout: boolean
  onApplySavedLayout: () => void
  onAutoSizeColumns: () => void
  onClearSavedLayout: () => void
  onContentModeChange: (contentMode: WorkspacePeopleTableContentMode) => void
  onResetColumnWidths: () => void
  onRowHeightChange: (rowHeight: WorkspacePeopleTableRowHeight) => void
  onSaveLayout: () => void
  onAddPeopleToCanvas: (personIds: string[]) => number
  onAddToSegment: (personIds: string[]) => void
  onRemoveFromSegment: (personIds: string[]) => void
}

export function WorkspacePeopleDrawerTableToolbar({
  segmentControls,
  addControls,
  controls,
  peopleCount,
  selectedCount,
  table,
  allPeople,
  viewerId,
  placedPersonIds,
  customSegment,
  customSegmentMemberIds,
  canEdit,
  contentMode,
  rowHeight,
  hasSavedLayout,
  onApplySavedLayout,
  onAutoSizeColumns,
  onClearSavedLayout,
  onContentModeChange,
  onResetColumnWidths,
  onRowHeightChange,
  onSaveLayout,
  onAddPeopleToCanvas,
  onAddToSegment,
  onRemoveFromSegment,
}: WorkspacePeopleDrawerTableToolbarProps) {
  const inWindowHeader = useWorkspaceWindowHeader()
  const hideableColumns = table
    .getAllLeafColumns()
    .filter((column) => column.getCanHide())
  const resizableColumns = table
    .getAllLeafColumns()
    .filter((column) => column.getCanResize())
  const selectedPeople = table
    .getSelectedRowModel()
    .rows.map((row) => row.original)

  return (
    <>
      {inWindowHeader && segmentControls ? (
        <WorkspaceWindowHeaderPortal slot="accessory">
          <div data-workspace-people-header-segments="true" className="flex w-full min-w-0">
            {segmentControls}
          </div>
        </WorkspaceWindowHeaderPortal>
      ) : null}
      <WorkspaceWindowHeaderPortal>
        <div
          data-setup-guide-target="people"
          className={cn(
            "flex min-w-0 flex-wrap items-center justify-between gap-2",
            inWindowHeader
              ? "w-full"
              : "border-border/60 min-h-11 shrink-0 border-b px-3 py-2"
          )}
        >
          <div className={cn("flex min-w-0 flex-1 items-center gap-2", inWindowHeader && segmentControls && "sr-only")}>
            {!inWindowHeader && segmentControls}
            <p
              className={
                segmentControls
                  ? "sr-only"
                  : "text-muted-foreground max-w-52 min-w-0 truncate text-xs font-medium"
              }
            >
              {selectedCount > 0
                ? `${selectedCount} selected`
                : `${peopleCount} ${peopleCount === 1 ? "person" : "people"}`}
            </p>
          </div>

          <div className="ml-auto flex w-auto min-w-0 flex-wrap items-center justify-end gap-1.5">
            {controls}
            <div className="w-auto empty:hidden">
              <WorkspacePeopleDrawerSelectionActions
                selectedPeople={selectedPeople}
                allPeople={allPeople}
                viewerId={viewerId}
                placedPersonIds={placedPersonIds}
                customSegment={customSegment}
                customSegmentMemberIds={customSegmentMemberIds}
                canEdit={canEdit}
                onAddPeopleToCanvas={onAddPeopleToCanvas}
                onAddToSegment={onAddToSegment}
                onRemoveFromSegment={onRemoveFromSegment}
                onClearSelection={() => table.resetRowSelection()}
              />
            </div>
            {hideableColumns.length > 0 ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={cn(
                      "text-foreground hover:text-foreground h-8 w-auto shrink-0 gap-1.5 rounded-xl px-2.5",
                      inWindowHeader && WORKSPACE_HEADER_BUTTON
                    )}
                  >
                    <Columns3Icon aria-hidden />
                    <span>Columns</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuGroup>
                    {hideableColumns.map((column) => (
                      <DropdownMenuCheckboxItem
                        key={column.id}
                        checked={column.getIsVisible()}
                        onCheckedChange={(value) =>
                          column.toggleVisibility(Boolean(value))
                        }
                      >
                        {WORKSPACE_PEOPLE_DRAWER_COLUMN_LABELS[column.id] ??
                          column.id}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Row height</DropdownMenuLabel>
                    <DropdownMenuRadioGroup
                      value={rowHeight}
                      onValueChange={(value) =>
                        onRowHeightChange(value as WorkspacePeopleTableRowHeight)
                      }
                    >
                      <DropdownMenuRadioItem value="compact">
                        Compact
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="standard">
                        Default
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="spacious">
                        Spacious
                      </DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Cell content</DropdownMenuLabel>
                    <DropdownMenuRadioGroup
                      value={contentMode}
                      onValueChange={(value) =>
                        onContentModeChange(
                          value as WorkspacePeopleTableContentMode
                        )
                      }
                    >
                      <DropdownMenuRadioItem value="wrap">
                        Wrap previews
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="truncate">
                        Truncate previews
                      </DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={onAutoSizeColumns}>
                    <ScanLineIcon aria-hidden />
                    Auto-fit columns
                  </DropdownMenuItem>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      Reset one column
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-44">
                      {resizableColumns.map((column) => (
                        <DropdownMenuItem
                          key={column.id}
                          onSelect={() => column.resetSize()}
                        >
                          {WORKSPACE_PEOPLE_DRAWER_COLUMN_LABELS[column.id] ??
                            column.id}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuItem onSelect={onResetColumnWidths}>
                    <RotateCcwIcon aria-hidden />
                    Reset column widths
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Saved layout</DropdownMenuLabel>
                  <DropdownMenuItem onSelect={onSaveLayout}>
                    <SaveIcon aria-hidden />
                    Save current layout
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={!hasSavedLayout}
                    onSelect={onApplySavedLayout}
                  >
                    <FolderOpenIcon aria-hidden />
                    Apply saved layout
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    disabled={!hasSavedLayout}
                    onSelect={onClearSavedLayout}
                  >
                    <Trash2Icon aria-hidden />
                    Clear saved layout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
            {addControls}
          </div>
        </div>
      </WorkspaceWindowHeaderPortal>
    </>
  )
}
