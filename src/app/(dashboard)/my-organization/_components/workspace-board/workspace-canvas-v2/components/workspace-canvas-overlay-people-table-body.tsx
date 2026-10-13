"use client"

import { memo, useEffect, type DragEvent, type RefObject } from "react"
import {
  flexRender,
  type ColumnDef,
  type PaginationState,
  type RowSelectionState,
  type Table as ReactTable,
  type VisibilityState,
} from "@tanstack/react-table"
import { useVirtualizer } from "@tanstack/react-virtual"

import type { OrgPersonWithImage } from "@/components/people/supporters-showcase"
import { TableBody, TableCell, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { workspacePeopleColumnStyle } from "./workspace-canvas-people-table-fill"

import {
  WorkspacePeopleRowResizeHandle,
  type WorkspacePeopleRowSizing,
  type WorkspacePeopleTableContentMode,
} from "./workspace-canvas-overlay-people-table-sizing"

type WorkspacePeopleDrawerTableBodyProps = {
  table: ReactTable<OrgPersonWithImage>
  columnDefinitions: ColumnDef<OrgPersonWithImage>[]
  people: OrgPersonWithImage[]
  pagination: PaginationState
  rowSelection: RowSelectionState
  columnVisibility: VisibilityState
  placedPersonIds: ReadonlySet<string>
  draggingPersonIds: ReadonlySet<string>
  rowSizing: WorkspacePeopleRowSizing
  defaultRowHeight: number
  contentMode: WorkspacePeopleTableContentMode
  tableScrollRef: RefObject<HTMLDivElement | null>
  onDragStart: (personIds: string[], event: DragEvent<HTMLElement>) => void
  onDragEnd: () => void
  onRowHeightChange: (rowId: string, rowHeight: number) => void
  onRowHeightReset: (rowId: string) => void
}

function tableBodyPropsAreEqual(
  previous: WorkspacePeopleDrawerTableBodyProps,
  next: WorkspacePeopleDrawerTableBodyProps
) {
  return (
    previous.table === next.table &&
    previous.columnDefinitions === next.columnDefinitions &&
    previous.people === next.people &&
    previous.pagination.pageIndex === next.pagination.pageIndex &&
    previous.pagination.pageSize === next.pagination.pageSize &&
    previous.rowSelection === next.rowSelection &&
    previous.columnVisibility === next.columnVisibility &&
    previous.placedPersonIds === next.placedPersonIds &&
    previous.draggingPersonIds === next.draggingPersonIds &&
    previous.rowSizing === next.rowSizing &&
    previous.defaultRowHeight === next.defaultRowHeight &&
    previous.contentMode === next.contentMode &&
    previous.tableScrollRef === next.tableScrollRef &&
    previous.onDragStart === next.onDragStart &&
    previous.onDragEnd === next.onDragEnd &&
    previous.onRowHeightChange === next.onRowHeightChange &&
    previous.onRowHeightReset === next.onRowHeightReset
  )
}

export const WorkspacePeopleDrawerTableBody = memo(
  function WorkspacePeopleDrawerTableBody({
    table,
    placedPersonIds,
    draggingPersonIds,
    rowSizing,
    defaultRowHeight,
    contentMode,
    tableScrollRef,
    onDragStart,
    onDragEnd,
    onRowHeightChange,
    onRowHeightReset,
  }: WorkspacePeopleDrawerTableBodyProps) {
    const rows = table.getRowModel().rows
    const shouldVirtualize = rows.length >= 100
    const rowVirtualizer = useVirtualizer({
      count: shouldVirtualize ? rows.length : 0,
      getScrollElement: () => tableScrollRef.current,
      estimateSize: (index) =>
        rowSizing[rows[index]?.id ?? ""] ?? defaultRowHeight,
      getItemKey: (index) => rows[index]?.id ?? index,
      overscan: 8,
    })

    useEffect(() => {
      if (!shouldVirtualize) return
      rowVirtualizer.measure()
    }, [
      contentMode,
      defaultRowHeight,
      rowSizing,
      rowVirtualizer,
      shouldVirtualize,
    ])

    const resolveRowDragPersonIds = (person: OrgPersonWithImage) => {
      const row = table.getRow(person.id)
      if (!row?.getIsSelected()) return [person.id]

      const selectedPersonIds = table
        .getSelectedRowModel()
        .rows.map((selectedRow) => selectedRow.original.id)

      return [person.id, ...selectedPersonIds.filter((id) => id !== person.id)]
    }

    const renderRow = (
      row: (typeof rows)[number],
      virtualPosition?: { index: number; start: number }
    ) => {
      const person = row.original
      const placed = placedPersonIds.has(person.id)
      const dragging = draggingPersonIds.has(person.id)
      const resolvedRowHeight = rowSizing[row.id] ?? defaultRowHeight

      return (
        <TableRow
          key={row.id}
          ref={
            virtualPosition
              ? (element) => rowVirtualizer.measureElement(element)
              : undefined
          }
          data-index={virtualPosition?.index}
          draggable
          data-state={row.getIsSelected() ? "selected" : undefined}
          data-workspace-person-placed={placed ? "true" : undefined}
          data-workspace-person-dragging={dragging ? "true" : undefined}
          style={{
            ...(virtualPosition
              ? {
                  minHeight: resolvedRowHeight,
                  position: "absolute",
                  transform: `translateY(${virtualPosition.start}px)`,
                  width: "100%",
                }
              : { minHeight: resolvedRowHeight }),
          }}
          onDragStart={(event) =>
            onDragStart(resolveRowDragPersonIds(person), event)
          }
          onDragEnd={onDragEnd}
          className={cn(
            "group flex cursor-grab transition-colors active:cursor-grabbing",
            virtualPosition && "top-0 left-0",
            dragging && "opacity-60"
          )}
        >
          {row.getVisibleCells().map((cell) => {
            const selectCell = cell.column.id === "select"
            const personCell = cell.column.id === "person"
            const actionCell = cell.column.id === "action"
            const canvasCell = cell.column.id === "canvas"
            const wrapsText =
              contentMode === "wrap" &&
              !selectCell &&
              cell.column.id !== "role" &&
              !actionCell &&
              !canvasCell

            return (
              <TableCell
                key={cell.id}
                data-workspace-people-column={cell.column.id}
                style={{
                  ...workspacePeopleColumnStyle(cell.column.id, cell.column.getCanResize()),
                  ...(personCell
                    ? {
                        left: "calc(var(--col-select-size) * 1px)",
                      }
                    : {}),
                }}
                className={cn(
                  "border-border flex min-w-0 shrink-0 items-center overflow-hidden border-r px-3 py-1 last:border-r-0 [&>*]:max-w-full",
                  wrapsText
                    ? "break-words whitespace-normal"
                    : "whitespace-nowrap",
                  selectCell &&
                    "border-border bg-background group-hover:bg-muted group-data-[state=selected]:bg-muted sticky left-0 z-20 grid place-items-center overflow-visible border-r p-0",
                  personCell &&
                    "border-border bg-background group-hover:bg-muted group-data-[state=selected]:bg-muted sticky z-10 border-r max-md:!left-auto",
                  cell.column.id === "email" && "text-muted-foreground text-sm",
                  wrapsText && cell.column.id === "email" && "break-all",
                  cell.column.id === "linkedin" && "text-sm",
                  actionCell && "grid place-items-center overflow-visible p-0",
                  canvasCell &&
                    "bg-background group-hover:bg-muted group-data-[state=selected]:bg-muted sticky right-0 z-20 border-l px-2 text-right"
                )}
              >
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                {selectCell ? (
                  <WorkspacePeopleRowResizeHandle
                    rowId={row.id}
                    rowLabel={person.name}
                    rowHeight={resolvedRowHeight}
                    defaultRowHeight={defaultRowHeight}
                    onRowHeightChange={onRowHeightChange}
                    onRowHeightReset={onRowHeightReset}
                  />
                ) : null}
              </TableCell>
            )
          })}
        </TableRow>
      )
    }

    return (
      <TableBody
        data-workspace-people-content-mode={contentMode}
        className={cn("grid shrink-0 [&_tr:last-child]:border-b", shouldVirtualize && "relative")}
        style={
          shouldVirtualize
            ? { height: rowVirtualizer.getTotalSize() }
            : undefined
        }
      >
        {shouldVirtualize
          ? rowVirtualizer
              .getVirtualItems()
              .map((virtualRow) =>
                renderRow(rows[virtualRow.index], virtualRow)
              )
          : rows.map((row) => renderRow(row))}
      </TableBody>
    )
  },
  tableBodyPropsAreEqual
)
