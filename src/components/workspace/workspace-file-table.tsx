"use client"

import { useId, useState } from "react"
import { getReactGrabOwnerProps } from "@/components/dev/react-grab-surface"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

/** A bounded view over already parsed rows; never fetches, writes or parses. */
export function WorkspaceFileTable({
  rows,
  title,
  compact = false,
}: {
  rows: readonly (readonly string[])[]
  title: string
  compact?: boolean
}) {
  const id = useId()
  const [headerRow, setHeaderRow] = useState(true)
  const [page, setPage] = useState(0)
  const records = headerRow ? rows.slice(1) : rows
  const width = rows.reduce((max, row) => Math.max(max, row.length), 0)
  const columns = Array.from({ length: width }, (_, index) =>
    headerRow
      ? rows[0]?.[index] || `Column ${index + 1}`
      : `Column ${index + 1}`
  )
  const pageSize = compact ? 5 : 40
  const pages = Math.max(1, Math.ceil(records.length / pageSize))
  const currentPage = Math.min(page, pages - 1)
  const visible = records.slice(
    currentPage * pageSize,
    (currentPage + 1) * pageSize
  )
  return (
    <section
      aria-label={`${title} table`}
      className="flex min-h-0 min-w-0 flex-col gap-2"
      {...getReactGrabOwnerProps({
        ownerId: `workspace:file-table:${id}`,
        component: "WorkspaceFileTable",
        source: "src/components/workspace/workspace-file-table.tsx",
      })}
    >
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 px-1">
        <span className="text-muted-foreground text-xs tabular-nums">
          {records.length} rows · {columns.length} columns
        </span>
        <label
          htmlFor={id}
          className="nodrag nopan flex min-h-11 cursor-pointer items-center gap-2 text-xs"
        >
          Header row
          <Switch
            id={id}
            checked={headerRow}
            onCheckedChange={(value) => {
              setHeaderRow(value)
              setPage(0)
            }}
          />
        </label>
      </div>
      <div className="border-border/60 bg-background overflow-hidden rounded-2xl border">
        <Table>
          <TableCaption className="sr-only">{title}</TableCaption>
          <TableHeader className="bg-muted/50">
            <TableRow>
              {columns.map((column, index) => (
                <TableHead
                  key={index}
                  scope="col"
                  className="h-9 max-w-72 min-w-28 px-3 text-xs whitespace-normal"
                >
                  {column}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((row, index) => (
              <TableRow key={currentPage * pageSize + index}>
                {columns.map((_, column) => (
                  <TableCell
                    key={column}
                    className="max-w-72 px-3 py-2 align-top text-xs break-words whitespace-pre-wrap"
                  >
                    {row[column] ?? ""}
                  </TableCell>
                ))}
              </TableRow>
            ))}
            {!visible.length && (
              <TableRow>
                <TableCell
                  colSpan={Math.max(1, columns.length)}
                  className="text-muted-foreground py-5 text-center text-xs"
                >
                  No data rows.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {pages > 1 && (
        <div className="nodrag nopan flex items-center justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-11 rounded-full sm:min-h-8"
            disabled={currentPage === 0}
            onClick={() => setPage(currentPage - 1)}
          >
            Previous
          </Button>
          <span
            role="status"
            className="text-muted-foreground px-2 text-xs tabular-nums"
          >
            {currentPage + 1} / {pages}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-11 rounded-full sm:min-h-8"
            disabled={currentPage === pages - 1}
            onClick={() => setPage(currentPage + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </section>
  )
}
