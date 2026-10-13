import type { CSSProperties } from "react"
import type { Table as ReactTable } from "@tanstack/react-table"

import type { OrgPersonWithImage } from "@/components/people/supporters-showcase"
import { TableBody, TableCell, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"

export function workspacePeopleColumnStyle(columnId: string, canGrow: boolean): CSSProperties {
  const width = `calc(var(--col-${columnId}-size) * 1px)`
  return { width, minWidth: width, flexGrow: canGrow ? 1 : 0 }
}

// Decorative cells continue the grid without adding fake, selectable people.
// CSS fills the actual remaining height, including wrapped and resized rows.
export function WorkspacePeopleTableFill({ table, rowHeight }: {
  table: ReactTable<OrgPersonWithImage>
  rowHeight: number
}) {
  return (
    <TableBody aria-hidden="true" className="flex min-h-0 flex-1">
      <TableRow className="flex flex-1 border-0 hover:bg-transparent">
        {table.getVisibleLeafColumns().map((column) => (
          <TableCell
            key={column.id}
            style={{
              ...workspacePeopleColumnStyle(column.id, column.getCanResize()),
              ...(column.id === "person" ? { left: "calc(var(--col-select-size) * 1px)" } : {}),
              backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${rowHeight - 1}px, var(--border) ${rowHeight - 1}px, var(--border) ${rowHeight}px)`,
            }}
            className={cn(
              "bg-background border-border min-w-0 shrink-0 border-r p-0 last:border-r-0",
              column.id === "select" && "sticky left-0 z-20",
              column.id === "person" && "sticky z-10 max-md:!left-auto",
              column.id === "canvas" && "sticky right-0 z-20 border-l"
            )}
          />
        ))}
      </TableRow>
    </TableBody>
  )
}
