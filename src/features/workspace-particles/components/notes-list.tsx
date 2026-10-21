"use client"

import { useEffect, useRef, useState } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Empty } from "@/components/ui/empty"
import { cn } from "@/lib/utils"
import type { NoteDocument } from "../lib/particle-notes"
import type { useNotePages } from "../hooks/use-note-pages"

export function NotesList({ pages, selectedId, onSelect, busy }: {
  pages: ReturnType<typeof useNotePages>
  selectedId?: string
  onSelect: (note: NoteDocument) => void
  busy: boolean
}) {
  const scroll = useRef<HTMLDivElement>(null)
  const pendingFocus = useRef(false)
  const [focused, setFocused] = useState(-1)
  const virtualizer = useVirtualizer({ count: pages.notes.length, getScrollElement: () => scroll.current,
    estimateSize: () => 68, overscan: 5, rangeExtractor: (range) => {
      const indexes = Array.from({ length: range.endIndex - range.startIndex + 1 + 2 * range.overscan }, (_, index) => index + range.startIndex - range.overscan)
      return [...new Set([...indexes.filter((index) => index >= 0 && index < range.count), ...(focused >= 0 && focused < range.count ? [focused] : [])])].sort((a, b) => a - b)
    } })
  useEffect(() => {
    if (!pendingFocus.current) return
    const target = scroll.current?.querySelector<HTMLButtonElement>(`[data-note-index="${focused}"]`)
    if (target) { target.focus({ preventScroll: true }); pendingFocus.current = false }
  }, [focused])
  return <div ref={scroll} className="h-full min-h-0 overflow-y-auto overscroll-contain p-2" aria-label="Notes list" onScroll={(event) => {
    const element = event.currentTarget
    if (element.scrollHeight - element.scrollTop - element.clientHeight < 180 && !pages.error) pages.more()
  }}>
    {pages.loading && !pages.notes.length ? <div aria-label="Loading notes" role="status" className="flex flex-col gap-2">
      {[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-16 w-full rounded-xl" />)}
    </div> : null}
    {!pages.loading && !pages.error && !pages.notes.length ? <Empty title="No notes" description="Notes you create in the workspace and Accelerator appear here." size="sm" className="border-0 bg-transparent px-2 shadow-none" /> : null}
    <ul className="relative m-0 p-0" style={{ height: virtualizer.getTotalSize() }}>
      {virtualizer.getVirtualItems().map((row) => {
        const note = pages.notes[row.index]
        return <li key={note.id} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: row.size, transform: `translateY(${row.start}px)` }}>
          <Button variant="ghost" disabled={busy} aria-current={selectedId === note.id ? "true" : undefined}
            data-note-index={row.index}
            onKeyDown={(event) => {
              const next = event.key === "ArrowDown" ? Math.min(pages.notes.length - 1, row.index + 1)
                : event.key === "ArrowUp" ? Math.max(0, row.index - 1)
                : event.key === "Home" ? 0 : event.key === "End" ? pages.notes.length - 1 : null
              if (next === null) return
              event.preventDefault(); pendingFocus.current = true; setFocused(next); virtualizer.scrollToIndex(next)
            }}
            onFocus={() => setFocused(row.index)} onClick={() => onSelect(note)}
            className={cn("h-[64px] w-full flex-col items-start justify-center gap-1 rounded-xl px-3 text-left shadow-none", selectedId === note.id && "bg-accent text-accent-foreground")}
          >
            <span className="w-full truncate text-sm font-medium">{note.title}</span>
            <span className="text-muted-foreground flex w-full min-w-0 gap-2 text-xs font-normal">
              <time className="shrink-0 tabular-nums" dateTime={note.updatedAt}>{new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(note.updatedAt))}</time>
              <span className="truncate">{note.summary || "No additional text"}</span>
            </span>
          </Button>
        </li>
      })}
    </ul>
    {pages.error ? <div role="alert" className="flex flex-col gap-2 p-2 text-sm"><p>{pages.error}</p><Button variant="ghost" size="sm" className="rounded-full" onClick={pages.hasMore ? pages.more : pages.reload}>Retry</Button></div> : null}
    {pages.hasMore && !pages.error ? <Button variant="ghost" size="sm" className="my-2 w-full rounded-full" disabled={pages.loading} onClick={pages.more}>{pages.loading ? "Loading…" : "Load more"}</Button> : null}
  </div>
}
