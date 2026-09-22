"use client"

import {
  CalendarBlank,
  CheckCircle,
  Clock,
  Flag,
} from "@phosphor-icons/react/dist/ssr"
import { differenceInCalendarDays, format } from "date-fns"

import type {
  ProjectActivityItem,
  ProjectDetails,
} from "@/features/platform-admin-dashboard"
import { Button } from "@/components/ui/button"
import { useProjectActivity } from "./use-project-activity"
import type { MemberWorkspaceAdminOrganizationSummary } from "../../types"

function toTitleCase(value: string | null) {
  if (!value) return null
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function eventSummary(item: ProjectActivityItem) {
  const fromStatus = toTitleCase(item.fromStatus)
  const toStatus = toTitleCase(item.toStatus)
  if (fromStatus && toStatus && fromStatus !== toStatus) {
    return `${fromStatus} to ${toStatus}`
  }
  if (toStatus) return toStatus
  return toTitleCase(item.eventType) ?? "Updated"
}

function programDuration(startAt: string | null, endAt: string | null) {
  if (!startAt) return "Start date not set"
  const start = new Date(startAt)
  const end = endAt ? new Date(endAt) : new Date()
  const days = Math.max(differenceInCalendarDays(end, start) + 1, 1)
  return endAt ? `${days} days scheduled` : `${days} days running`
}

export function MemberWorkspaceProjectActivityTimeline({
  organizationSummary,
  project,
}: {
  organizationSummary: MemberWorkspaceAdminOrganizationSummary
  project: ProjectDetails
}) {
  const { activity, state, refreshing, refresh } = useProjectActivity(
    organizationSummary.orgId,
    project
  )
  const programs = organizationSummary.programs ?? []

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div>
          <h2 className="text-foreground text-base font-semibold">
            Program timelines
          </h2>
          <p className="text-muted-foreground text-sm leading-6">
            Program run dates and elapsed or scheduled duration.
          </p>
        </div>

        {programs.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {programs.map((program) => (
              <article
                key={program.id}
                className="border-border bg-card/70 space-y-3 rounded-lg border p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-foreground truncate text-sm font-medium">
                      {program.title}
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {program.statusLabel}
                    </p>
                  </div>
                  {program.isPublic ? (
                    <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-200">
                      Public
                    </span>
                  ) : null}
                </div>
                <div className="text-muted-foreground flex items-center gap-2 text-xs">
                  <CalendarBlank className="h-4 w-4" />
                  <span>
                    {program.startAt
                      ? format(new Date(program.startAt), "MMM d, yyyy")
                      : "No start date"}
                    {program.endAt
                      ? ` – ${format(new Date(program.endAt), "MMM d, yyyy")}`
                      : ""}
                  </span>
                </div>
                <div className="text-muted-foreground flex items-center gap-2 text-xs">
                  <Clock className="h-4 w-4" />
                  <span>{programDuration(program.startAt, program.endAt)}</span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
            No programs have been added yet.
          </p>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-foreground text-base font-semibold">Activity</h2>
          <p className="text-muted-foreground text-sm leading-6">
            Recorded organization activity, including document and file changes.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          disabled={refreshing}
          onClick={() => void refresh()}
        >
          {refreshing ? "Refreshing…" : "Refresh activity"}
        </Button>
        {state !== "ready" ? (
          <p
            role="status"
            className="text-muted-foreground rounded-lg border p-4 text-sm"
          >
            {state === "forbidden"
              ? "You no longer have access to this activity."
              : state === "unavailable"
                ? "Activity history is not available yet."
                : "Activity could not refresh. Try again."}
            {activity.length > 0 ? " Showing the last loaded activity." : ""}
          </p>
        ) : null}
        {activity.length > 0 ? (
          <ol className="relative space-y-0 pl-6">
            {activity.map((item) => (
              <li
                key={item.id}
                className="border-border relative border-l pb-6 pl-6 last:border-transparent last:pb-0"
              >
                <span className="border-border bg-background absolute top-0 -left-2.5 flex h-5 w-5 items-center justify-center rounded-full border">
                  {item.eventType === "completed" ? (
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Flag className="text-muted-foreground h-3.5 w-3.5" />
                  )}
                </span>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div className="min-w-0">
                    <p className="text-foreground text-sm font-medium">
                      {item.title}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {toTitleCase(item.entityType)} · {eventSummary(item)}
                    </p>
                  </div>
                  <div className="text-muted-foreground shrink-0 text-xs sm:text-right">
                    <p>{format(item.occurredAt, "MMM d, yyyy, h:mm a")}</p>
                    {item.durationLabel ? (
                      <p>{item.durationLabel} in the prior step</p>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        ) : state === "ready" ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
            No activity recorded yet.
          </p>
        ) : null}
      </section>
    </div>
  )
}
