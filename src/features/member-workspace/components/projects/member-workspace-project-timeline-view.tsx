"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { useVirtualizer } from "@tanstack/react-virtual"
import type { PlatformAdminDashboardLabProject } from "@/features/platform-admin-dashboard"
import type { ProjectTimelineActions } from "../../lib/project-timeline-types"
import {
  calendarDay,
  dateOnly,
  DAY_MS,
  formatTimelineDay,
  localToday,
  navigateTimeline,
  shiftDay,
  TIMELINE_MODES,
  timelineCellWidth,
  timelineDays,
  type TimelineMode,
} from "../../lib/project-timeline"
import { ProjectTimelineToolbar } from "./project-timeline-toolbar"
import { ProjectTimelineDateDialog } from "./project-timeline-date-dialog"
import {
  ProjectTimelineRow,
  type ProjectTimelineRowData,
} from "./project-timeline-row"
import { useProjectTimeline } from "./use-project-timeline"
import { cn } from "@/lib/utils"

export function MemberWorkspaceProjectTimelineView({
  projects,
  actions,
  updateProjectScheduleAction,
}: {
  projects: PlatformAdminDashboardLabProject[]
  actions?: ProjectTimelineActions
  updateProjectScheduleAction?: (
    projectId: string,
    startDate: string,
    endDate: string
  ) => Promise<{ ok: true; id: string } | { error: string }>
}) {
  const pathname = usePathname(),
    params = useSearchParams()
  const [today, setToday] = useState("")
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const update = () => {
      clearTimeout(timer)
      const now = new Date()
      setToday(localToday(now))
      const midnight = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1
      )
      timer = setTimeout(update, midnight.getTime() - now.getTime() + 100)
    }
    update()
    window.addEventListener("focus", update)
    return () => {
      clearTimeout(timer)
      window.removeEventListener("focus", update)
    }
  }, [])
  const requestedMode = params.get("timelineMode")
  const mode: TimelineMode = TIMELINE_MODES.includes(
    requestedMode as TimelineMode
  )
    ? (requestedMode as TimelineMode)
    : "Week"
  const requestedDate = params.get("timelineDate") ?? ""
  const start =
    calendarDay(requestedDate) !== null ? requestedDate : shiftDay(today, -7)
  const names = params.get("timelineNames") !== "hide"
  const rawZoom = Number(params.get("timelineZoom") ?? 1)
  const zoom = Number.isFinite(rawZoom)
    ? Math.min(2, Math.max(0.5, rawZoom))
    : 1
  const customSpan = Number(params.get("timelineSpan"))
  const days =
    customSpan >= 1 && customSpan <= 3660
      ? Math.ceil(customSpan)
      : timelineDays[mode]
  const cellWidth = timelineCellWidth[mode] * zoom
  const width = days * cellWidth
  const expanded = (params.get("timelineExpanded") ?? "")
    .split(",")
    .filter((id) => projects.some((project) => project.id === id))
  const controller = useProjectTimeline(
    projects,
    expanded,
    actions,
    updateProjectScheduleAction
  )
  const viewport = useRef<HTMLDivElement>(null)
  const writeState = (values: Record<string, string>) => {
    const next = new URLSearchParams(window.location.search)
    for (const [key, value] of Object.entries(values))
      value ? next.set(key, value) : next.delete(key)
    if ((values.timelineDate || values.timelineMode) && !values.timelineSpan)
      next.delete("timelineSpan")
    window.history.pushState(null, "", `${pathname}?${next}`)
  }
  const rows = useMemo(
    () =>
      projects.flatMap<ProjectTimelineRowData>((project) => {
        const schedule = controller.overrides[project.id]
        const result: ProjectTimelineRowData[] = [
          {
            key: project.id,
            project,
            start: schedule?.startDate ?? dateOnly(project.startDate),
            end: schedule?.endDate ?? dateOnly(project.endDate),
            canEdit: Boolean(
              (actions || updateProjectScheduleAction) &&
              project.canEditSchedule !== false
            ),
            expanded: expanded.includes(project.id),
          },
        ]
        if (!expanded.includes(project.id)) return result
        const loaded = controller.cache[project.id]
        const message = !actions
          ? "Open the project to view its tasks."
          : loaded?.loading || !loaded
            ? "Loading tasks…"
            : (loaded.error ?? (loaded.tasks.length ? "" : "No tasks yet."))
        if (message)
          result.push({
            key: `${project.id}-message`,
            project,
            message,
            retry: Boolean(loaded?.error),
            start: "",
            end: "",
            canEdit: false,
          })
        else
          for (const task of loaded.tasks)
            result.push({
              key: task.id,
              project,
              task,
              start: task.startDate,
              end: task.endDate,
              canEdit: task.canEdit,
            })
        return result
      }),
    [
      projects,
      controller.overrides,
      controller.cache,
      actions,
      updateProjectScheduleAction,
      expanded,
    ]
  )
  const virtual = useVirtualizer({
    count: rows.length,
    getScrollElement: () => viewport.current,
    estimateSize: () => 48,
    overscan: 8,
    enabled: rows.length > 50,
    scrollMargin: 48,
    initialRect: { width: 1000, height: 560 },
  })
  const visible =
    rows.length > 50
      ? virtual
          .getVirtualItems()
          .map((item) => ({
            row: rows[item.index],
            start: item.start - 48,
            key: item.key,
          }))
      : rows.map((row, index) => ({ row, start: index * 48, key: row.key }))
  const origin = calendarDay(start),
    now = calendarDay(today)
  const offset = origin !== null && now !== null ? (now - origin) / DAY_MS : -1
  const todayOffset = offset >= 0 && offset < days ? offset : null
  useEffect(() => {
    if (viewport.current) viewport.current.scrollLeft = 0
  }, [start, mode])
  const fit = () => {
    const dates = rows
      .flatMap((row) => [row.start, row.end])
      .filter((value) => calendarDay(value) !== null)
      .sort()
    if (!dates.length) {
      writeState({ timelineDate: shiftDay(today, -7) })
      return
    }
    const span = Math.min(
      3660,
      (calendarDay(dates.at(-1)!)! - calendarDay(dates[0])!) / DAY_MS + 7
    )
    const available = Math.max(
      300,
      (viewport.current?.clientWidth ?? 1000) - (names ? 288 : 0)
    )
    const fitMode =
      TIMELINE_MODES.find(
        (value) => timelineCellWidth[value] * span <= available * 2
      ) ?? "Quarter"
    writeState({
      timelineDate: shiftDay(dates[0], -3),
      timelineMode: fitMode,
      timelineSpan: String(span),
      timelineZoom: "0.5",
    })
  }
  if (!today)
    return (
      <div role="status" className="text-muted-foreground p-4 text-sm">
        Loading timeline…
      </div>
    )
  return (
    <section
      aria-label="Project timeline"
      className="flex h-[min(72vh,800px)] min-h-96 min-w-0 flex-col"
    >
      <ProjectTimelineToolbar
        start={start}
        end={shiftDay(start, days - 1)}
        mode={mode}
        zoom={zoom}
        sidebar={names}
        onChange={writeState}
        onNavigate={(direction) =>
          writeState({ timelineDate: navigateTimeline(start, mode, direction) })
        }
        onToday={() => writeState({ timelineDate: shiftDay(today, -7) })}
        onFit={fit}
        onRefresh={controller.refresh}
      />
      <div
        ref={viewport}
        className="relative min-h-0 flex-1 overflow-auto overscroll-contain"
        tabIndex={0}
        aria-label="Scrollable timeline"
      >
        <div className="min-w-max">
          <div className="bg-background sticky top-0 z-20 flex h-12 border-b">
            {names && (
              <div className="bg-background text-muted-foreground sticky left-0 z-30 flex w-44 shrink-0 items-center border-r px-3 text-xs sm:w-72">
                Name
              </div>
            )}
            <div className="relative flex shrink-0" style={{ width }}>
              {Array.from({ length: days }, (_, index) => {
                const day = shiftDay(start, index),
                  date = new Date(calendarDay(day)!)
                const show =
                  mode === "Day" ||
                  (mode === "Week" && index % 2 === 0) ||
                  (mode === "Month" && date.getUTCDay() === 1) ||
                  (mode === "Quarter" && date.getUTCDate() === 1)
                return (
                  <div
                    key={day}
                    className={cn(
                      "border-border/40 text-muted-foreground flex shrink-0 items-center justify-center border-r text-[10px]",
                      day === today &&
                        "bg-primary/10 text-foreground font-semibold"
                    )}
                    style={{ width: cellWidth }}
                    title={formatTimelineDay(day)}
                  >
                    {show
                      ? formatTimelineDay(
                          day,
                          mode === "Quarter"
                            ? { month: "short" }
                            : mode === "Day"
                              ? { weekday: "short", day: "numeric" }
                              : { day: "numeric" }
                        )
                      : ""}
                  </div>
                )
              })}
            </div>
          </div>
          <div
            className="relative"
            style={{
              height:
                rows.length > 50 ? virtual.getTotalSize() : rows.length * 48,
            }}
          >
            {visible.map(({ row, start: top, key }) => (
              <div
                key={key}
                className="absolute inset-x-0 top-0"
                style={{ transform: `translateY(${top}px)` }}
              >
                <ProjectTimelineRow
                  row={row}
                  names={names}
                  width={width}
                  days={days}
                  cellWidth={cellWidth}
                  origin={start}
                  todayOffset={todayOffset}
                  pending={controller.pending.has(
                    row.task?.id ?? row.project.id
                  )}
                  onToggle={() =>
                    writeState({
                      timelineExpanded: expanded.includes(row.project.id)
                        ? expanded
                            .filter((id) => id !== row.project.id)
                            .join(",")
                        : [...expanded, row.project.id].join(","),
                    })
                  }
                  onRetry={() => void controller.load(row.project.id)}
                  onStatus={() => {
                    if (row.task) void controller.toggleStatus(row.task)
                  }}
                  onEdit={controller.setEditor}
                  onChange={(editor) => void controller.drag(editor)}
                  onReveal={(day) =>
                    writeState({ timelineDate: shiftDay(day, -3) })
                  }
                />
              </div>
            ))}
          </div>
          {!rows.length && (
            <p className="text-muted-foreground p-4 text-sm">
              No projects match the current filters.
            </p>
          )}
        </div>
      </div>
      {controller.editor && (
        <ProjectTimelineDateDialog
          key={`${controller.editor.taskId ?? controller.editor.projectId}:${controller.editor.startDate}:${controller.editor.endDate}`}
          editor={controller.editor}
          saving={controller.pending.has(
            controller.editor.taskId ?? controller.editor.projectId
          )}
          onClose={() => controller.setEditor(null)}
          onSave={controller.save}
        />
      )}
    </section>
  )
}
