"use client"

import type { Table as ReactTable } from "@tanstack/react-table"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

type PeopleTablePaginationProps<TData> = {
  table: ReactTable<TData>
  canEdit: boolean
  filteredCount: number
  className?: string
  pageSizeOptions?: number[]
  showSelectionCount?: boolean
  compactMobile?: boolean
}

export function PeopleTablePagination<TData>({
  table,
  canEdit,
  filteredCount,
  className,
  pageSizeOptions = [10, 20, 30, 40, 50],
  showSelectionCount = canEdit,
  compactMobile = false,
}: PeopleTablePaginationProps<TData>) {
  const pageCount = Math.max(table.getPageCount(), 1)

  return (
    <div
      className={cn(
        "text-muted-foreground flex flex-col gap-2 px-1 text-sm sm:flex-row sm:items-center sm:justify-between",
        compactMobile && "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-xs sm:flex",
        className
      )}
    >
      <div>
        {showSelectionCount ? (
          <>
            {table.getFilteredSelectedRowModel().rows.length} of {filteredCount}{" "}
            selected
          </>
        ) : (
          <>
            {filteredCount} {filteredCount === 1 ? "person" : "people"}
          </>
        )}
      </div>
      <div className={compactMobile ? "contents sm:flex sm:items-center sm:gap-2" : "flex items-center gap-2"}>
        <Label htmlFor="rows-per-page" className={cn("text-xs", compactMobile && "sr-only sm:not-sr-only")}>
          Rows per page
        </Label>
        <Select
          value={`${table.getState().pagination.pageSize}`}
          onValueChange={(value) => table.setPageSize(Number(value))}
        >
          <SelectTrigger id="rows-per-page" size="sm" className={cn("w-20", compactMobile && "data-[size=sm]:h-11 sm:data-[size=sm]:h-8")}>
            <SelectValue placeholder={table.getState().pagination.pageSize} />
          </SelectTrigger>
          <SelectContent align="end">
            {pageSizeOptions.map((pageSize) => (
              <SelectItem key={pageSize} value={`${pageSize}`}>
                {pageSize}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className={compactMobile ? "col-span-2 flex min-w-0 items-center justify-between gap-2 sm:ml-4 sm:inline-flex sm:justify-start sm:gap-3" : "ml-4 inline-flex items-center gap-3"}>
          <span>
            Page {table.getState().pagination.pageIndex + 1} of {pageCount}
          </span>
          <div className="inline-flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className={cn("size-7", compactMobile && "hidden size-11 sm:inline-flex sm:size-7")}
              aria-label="First page"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              «
            </Button>
            <Button
              variant="outline"
              size="icon"
              className={cn("size-7", compactMobile && "size-11 sm:size-7")}
              aria-label="Previous page"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              ‹
            </Button>
            <Button
              variant="outline"
              size="icon"
              className={cn("size-7", compactMobile && "size-11 sm:size-7")}
              aria-label="Next page"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              ›
            </Button>
            <Button
              variant="outline"
              size="icon"
              className={cn("size-7", compactMobile && "hidden size-11 sm:inline-flex sm:size-7")}
              aria-label="Last page"
              onClick={() => table.setPageIndex(pageCount - 1)}
              disabled={!table.getCanNextPage()}
            >
              »
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
