"use client"

import { useLayoutEffect, useRef, useState } from "react"
import PlusIcon from "lucide-react/dist/esm/icons/plus"
import ArrowUpIcon from "lucide-react/dist/esm/icons/arrow-up"
import ArrowDownIcon from "lucide-react/dist/esm/icons/arrow-down"
import TrashIcon from "lucide-react/dist/esm/icons/trash-2"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  CALENDAR_STATUSES,
  calendarPlanningOrder,
  createCalendarEntry,
  moveCalendarEntry,
  replaceCalendarEntry,
  type CalendarParticle,
  type CalendarEntry,
  type CalendarActivity,
} from "../lib/particle-calendar"
import { ParticleCalendarEntryFields } from "./particle-calendar-entry-fields"
import { useParticleSurface } from "./particle-surface"

const PAGE_SIZE = 8
export type CalendarEntryRequest = { id: string; key: number } | null

export function ParticleCalendarEditor({
  particle,
  disabled,
  onChange,
  activities = [],
  entryRequest = null,
}: {
  particle: CalendarParticle
  disabled: boolean
  onChange: (particle: CalendarParticle) => void
  activities?: readonly CalendarActivity[]
  entryRequest?: CalendarEntryRequest
}) {
  const surface = useParticleSurface()
  const entries = calendarPlanningOrder(particle.data.entries)
  const [selectedId, setSelectedId] = useState<string | null>(
    entryRequest?.id ?? null
  )
  const [page, setPage] = useState(0)
  const [removed, setRemoved] = useState<CalendarEntry | null>(null)
  const detail = useRef<HTMLDivElement>(null)
  const latestEntries = useRef(entries)
  latestEntries.current = entries
  const requestedId = entryRequest?.id
  useLayoutEffect(() => {
    if (!requestedId) return
    const requestedIndex = latestEntries.current.findIndex(
      (entry) => entry.id === requestedId
    )
    setSelectedId(requestedId)
    setPage(Math.floor(Math.max(0, requestedIndex) / PAGE_SIZE))
    const frame = requestAnimationFrame(() => {
      detail.current?.focus({ preventScroll: true })
      detail.current?.scrollIntoView({ block: "nearest" })
    })
    return () => cancelAnimationFrame(frame)
  }, [requestedId, entryRequest?.key])
  const selectedIndex = entries.findIndex((entry) => entry.id === selectedId)
  const selected = entries[selectedIndex]
  const pages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE))
  const currentPage = Math.min(page, pages - 1)
  const select = (id: string) => {
    setSelectedId(id)
    requestAnimationFrame(() => {
      detail.current?.focus({ preventScroll: true })
      detail.current?.scrollIntoView({ block: "nearest" })
    })
  }
  return (
    <div
      {...surface()}
      className="flex min-w-0 flex-col gap-4"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">
          Entries{" "}
          <span className="text-muted-foreground font-normal">
            ({entries.length})
          </span>
        </h3>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 rounded-xl"
          disabled={disabled || entries.length >= 250}
          {...surface()}
          onClick={() => {
            const entry = createCalendarEntry(
              crypto.randomUUID(),
              entries.length
            )
            onChange({
              ...particle,
              data: {
                ...particle.data,
                entries: [
                  ...entries.map((item, order) => ({ ...item, order })),
                  entry,
                ],
              },
            })
            setPage(Math.floor(entries.length / PAGE_SIZE))
            select(entry.id)
          }}
        >
          <PlusIcon aria-hidden />
          Add entry
        </Button>
      </div>
      {entries.length ? (
        <>
          <div className="border-border overflow-hidden rounded-2xl border">
            {entries
              .slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)
              .map((entry) => (
                <Button
                  key={entry.id}
                  type="button"
                  variant="ghost"
                  aria-pressed={entry.id === selectedId}
                  {...surface()}
                  onClick={() => select(entry.id)}
                  className={cn(
                    "flex h-auto min-h-11 w-full justify-between gap-3 rounded-none px-3 py-2 text-left whitespace-normal",
                    entry.id === selectedId &&
                      "bg-accent text-accent-foreground"
                  )}
                >
                  <span className="min-w-0 flex-1 break-words">
                    {entry.title || "Untitled entry"}
                  </span>
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {entry.delivery === "automatic" ? "Auto · " : ""}
                    {
                      CALENDAR_STATUSES.find(
                        (status) => status.value === entry.status
                      )?.label
                    }
                  </span>
                </Button>
              ))}
          </div>
          {pages > 1 ? (
            <div className="flex items-center justify-between gap-2 text-xs">
              <Button
                type="button"
                variant="ghost"
                disabled={currentPage === 0}
                onClick={() => setPage(currentPage - 1)}
              >
                Previous entries
              </Button>
              <span>
                Page {currentPage + 1} of {pages}
              </span>
              <Button
                type="button"
                variant="ghost"
                disabled={currentPage === pages - 1}
                onClick={() => setPage(currentPage + 1)}
              >
                Next entries
              </Button>
            </div>
          ) : null}
          <p className="text-muted-foreground text-xs">
            Planning order shown here. The canvas preview follows scheduled
            dates.
          </p>
        </>
      ) : (
        <p className="text-muted-foreground text-sm">
          Add a post, email, newsletter or article to this calendar.
        </p>
      )}
      {removed && !entries.some((entry) => entry.id === removed.id) ? (
        <Button
          type="button"
          variant="ghost"
          disabled={disabled || entries.length >= 250}
          onClick={() => {
            onChange({
              ...particle,
              data: { ...particle.data, entries: [...entries, removed] },
            })
            select(removed.id)
            setRemoved(null)
          }}
        >
          Restore removed entry
        </Button>
      ) : null}
      <div
        ref={detail}
        tabIndex={-1}
        className="focus-ring min-w-0 space-y-4 rounded-xl"
        aria-label="Calendar entry editor"
      >
        {selected ? (
          <>
            <div className="flex items-center justify-between gap-2 border-t pt-3">
              <h4 className="min-w-0 truncate text-sm font-semibold">
                {selected.title || "Untitled entry"}
              </h4>
              <div className="flex shrink-0 gap-1">
                {([-1, 1] as const).map((direction) => (
                  <Button
                    key={direction}
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-11"
                    aria-label={
                      direction === -1
                        ? "Move entry earlier"
                        : "Move entry later"
                    }
                    disabled={
                      disabled ||
                      (direction === -1
                        ? selectedIndex === 0
                        : selectedIndex === entries.length - 1)
                    }
                    {...surface()}
                    onClick={() => {
                      onChange(
                        moveCalendarEntry(particle, selected.id, direction)
                      )
                      setPage(
                        Math.floor((selectedIndex + direction) / PAGE_SIZE)
                      )
                    }}
                  >
                    {direction === -1 ? (
                      <ArrowUpIcon aria-hidden />
                    ) : (
                      <ArrowDownIcon aria-hidden />
                    )}
                  </Button>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-11"
                  disabled={disabled}
                  aria-label="Remove entry"
                  {...surface()}
                  onClick={() => {
                    setRemoved(selected)
                    onChange({
                      ...particle,
                      data: {
                        ...particle.data,
                        entries: entries.filter(
                          (entry) => entry.id !== selected.id
                        ),
                      },
                    })
                    setSelectedId(null)
                  }}
                >
                  <TrashIcon aria-hidden />
                </Button>
              </div>
            </div>
            <ParticleCalendarEntryFields
              key={selected.id}
              entry={selected}
              disabled={disabled}
              activities={activities}
              onChange={(entry) =>
                onChange(replaceCalendarEntry(particle, entry))
              }
            />
          </>
        ) : entries.length ? (
          <p className="text-muted-foreground text-sm">
            Choose an entry to edit its content and schedule.
          </p>
        ) : null}
      </div>
    </div>
  )
}
