"use client"

import Link from "next/link"
import { CalendarBlank, CaretRight } from "@phosphor-icons/react/dist/ssr"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import type { PlatformAdminDashboardLabProject } from "@/features/platform-admin-dashboard"
import type { TimelineTask } from "../../lib/project-timeline-types"
import { MemberWorkspaceProjectTimelineDraggableBar } from "./member-workspace-project-timeline-draggable-bar"
import type { TimelineEditor } from "./project-timeline-date-dialog"

export type ProjectTimelineRowData = {
  key: string
  project: PlatformAdminDashboardLabProject
  task?: TimelineTask
  message?: string
  retry?: boolean
  start: string
  end: string
  expanded?: boolean
  canEdit: boolean
}
export function ProjectTimelineRow({
  row,
  names,
  width,
  days,
  cellWidth,
  origin,
  pending,
  todayOffset,
  onToggle,
  onRetry,
  onStatus,
  onEdit,
  onChange,
  onReveal,
}: {
  row: ProjectTimelineRowData
  names: boolean
  width: number
  days: number
  cellWidth: number
  origin: string
  pending: boolean
  todayOffset: number | null
  onToggle: () => void
  onRetry: () => void
  onStatus: () => void
  onEdit: (editor: TimelineEditor) => void
  onChange: (editor: TimelineEditor) => void
  onReveal: (day: string) => void
}) {
  const name = row.task?.name ?? row.project.name
  const edit: TimelineEditor = {
    name,
    projectId: row.project.id,
    taskId: row.task?.id,
    startDate: row.start,
    endDate: row.end,
    expectedStartDate: row.start,
    expectedEndDate: row.end,
  }
  const href = `/${row.project.projectKind === "organization_admin" ? "organizations" : "projects"}/${row.project.id}`
  return (
    <div
      className="border-border/60 flex h-12 border-b"
      data-timeline-row={name}
      aria-busy={pending}
    >
      {names && (
        <div className="bg-background sticky left-0 z-10 flex w-44 shrink-0 items-center gap-1 border-r px-2 sm:w-72">
          {row.message ? (
            <span className="text-muted-foreground truncate text-xs">
              Tasks
            </span>
          ) : row.task ? (
            <>
              <Checkbox
                aria-label={`Complete ${name}`}
                checked={row.task.status === "done"}
                disabled={!row.canEdit || pending}
                onCheckedChange={onStatus}
              />
              <Button
                variant="ghost"
                size="sm"
                className="min-w-0 flex-1 justify-start px-1"
                onClick={() =>
                  row.canEdit
                    ? onEdit(edit)
                    : onReveal(row.start || row.end || origin)
                }
                title={`${name} · ${row.task.status}`}
              >
                <span className="truncate text-xs">{name}</span>
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 shrink-0"
                aria-expanded={row.expanded}
                aria-label={`${row.expanded ? "Collapse" : "Expand"} ${name}`}
                onClick={onToggle}
              >
                <CaretRight className={cn(row.expanded && "rotate-90")} />
              </Button>
              <div className="min-w-0 flex-1">
                <Link
                  href={href}
                  className="block truncate text-sm font-medium hover:underline"
                  title={name}
                >
                  {name}
                </Link>
                <span className="text-muted-foreground block truncate text-xs">
                  {row.project.client ?? `${row.project.taskCount} tasks`}
                </span>
              </div>
            </>
          )}
          {!row.message && row.canEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8 shrink-0"
              aria-label={`Set dates for ${name}`}
              disabled={pending}
              onClick={() => onEdit(edit)}
            >
              <CalendarBlank />
            </Button>
          )}
        </div>
      )}
      <div
        className="relative h-12 shrink-0"
        style={{
          width,
          backgroundImage:
            "linear-gradient(to right, var(--border) 1px, transparent 1px)",
          backgroundSize: `${cellWidth}px 100%`,
        }}
      >
        {todayOffset !== null && (
          <div
            aria-hidden
            className="border-primary/50 pointer-events-none absolute inset-y-0 border-l-2"
            style={{ left: todayOffset * cellWidth }}
          />
        )}
        {row.message ? (
          <div className="text-muted-foreground sticky left-2 flex h-full w-fit items-center gap-2 px-2 text-xs">
            <span role={row.retry ? "alert" : undefined}>{row.message}</span>
            {row.retry && (
              <Button variant="ghost" size="sm" onClick={onRetry}>
                Retry
              </Button>
            )}
          </div>
        ) : (
          <MemberWorkspaceProjectTimelineDraggableBar
            name={name}
            start={row.start}
            end={row.end}
            origin={origin}
            days={days}
            cellWidth={cellWidth}
            task={Boolean(row.task)}
            disabled={!row.canEdit || pending}
            onEdit={() => onEdit(edit)}
            onReveal={onReveal}
            onChange={(startDate, endDate) =>
              onChange({ ...edit, startDate, endDate })
            }
          />
        )}
        {pending && (
          <span
            role="status"
            className="bg-background sticky left-2 rounded px-2 text-xs"
          >
            Saving…
          </span>
        )}
      </div>
    </div>
  )
}
