"use client"

import ActivityIcon from "lucide-react/dist/esm/icons/activity"
import CalendarDaysIcon from "lucide-react/dist/esm/icons/calendar-days"

import { Badge } from "@/components/ui/badge"
import type { ParticleActivity } from "../types"

const dateTime = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
})

const SOURCE_LABELS: Record<ParticleActivity["source"], string> = {
  calendar: "Calendar",
  accelerator: "Accelerator",
  communications: "Communications",
  donations: "Donations",
}

export function ParticleActivityContent({
  activities,
  large,
}: {
  activities: ParticleActivity[]
  large: boolean
}) {
  const visibleActivities = activities.slice(0, large ? 6 : 2)
  const scheduledCount = activities.filter(
    (activity) => activity.status === "scheduled"
  ).length

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <div className="bg-primary/10 text-primary grid size-9 place-items-center rounded-xl">
          <ActivityIcon className="size-5" aria-hidden />
        </div>
        <div>
          <p className="text-sm font-medium">Workspace activity</p>
          <p className="text-muted-foreground text-[11px]">
            {activities.length} records · {scheduledCount} scheduled
          </p>
        </div>
      </div>
      {visibleActivities.length ? (
        <div className="min-h-0 space-y-2 overflow-hidden">
          {visibleActivities.map((activity) => (
            <ActivityRow key={activity.id} activity={activity} large={large} />
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground my-auto text-center text-xs">
          Activity will appear as work is scheduled and completed.
        </p>
      )}
    </div>
  )
}

function ActivityRow({
  activity,
  large,
}: {
  activity: ParticleActivity
  large: boolean
}) {
  const timestamp = new Date(activity.timestamp)
  const formattedTimestamp = Number.isFinite(timestamp.getTime())
    ? dateTime.format(timestamp)
    : "Date unavailable"

  return (
    <div className="bg-muted/30 rounded-lg border px-3 py-2">
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-xs font-medium">
          {activity.title}
        </p>
        {large ? (
          <Badge variant="secondary" className="shrink-0 text-[10px]">
            {SOURCE_LABELS[activity.source]}
          </Badge>
        ) : null}
      </div>
      <p className="text-muted-foreground mt-1 flex items-center gap-1.5 text-[10px]">
        <CalendarDaysIcon className="size-3 shrink-0" aria-hidden />
        <time dateTime={activity.timestamp}>{formattedTimestamp}</time>
      </p>
    </div>
  )
}
