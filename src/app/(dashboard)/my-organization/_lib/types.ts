import type { ModuleCard } from "@/lib/accelerator/progress"
import type {
  RoadmapCalendarAssignedRole,
  RoadmapCalendarEventType,
  RoadmapCalendarRecurrence,
} from "@/lib/roadmap/calendar"

export type MyOrganizationSearchParams = Record<
  string,
  string | string[] | undefined
>

export type UpcomingEvent = {
  id: string
  source?: { kind: "workspace_particle"; particleId: string; workspaceCanvasId?: string }
  title: string
  description: string | null
  event_type: RoadmapCalendarEventType
  starts_at: string
  ends_at: string | null
  all_day: boolean
  recurrence: RoadmapCalendarRecurrence | null
  status: "active" | "canceled"
  assigned_roles: RoadmapCalendarAssignedRole[]
  updated_at: string
}

export type FormationStepState = "completed" | "active" | "pending"

export type MyOrganizationCalendarView = {
  monthLabel: string
  previousMonthHref: string
  nextMonthHref: string
  previousMonthLabel: string
  nextMonthLabel: string
  grid: Array<number | null>
  weekdayLabels: readonly string[]
  eventDays: Set<number>
  selectedDay: number | null
  upcomingEvents: UpcomingEvent[]
  nextEvent: UpcomingEvent | null
}

export type FormationSummary = {
  visibleModules: ModuleCard[]
  acceleratorModules: ModuleCard[]
  completedCount: number
  progressPercent: number
  nextHref: string
}
