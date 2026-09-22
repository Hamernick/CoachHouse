import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  getRoadmapCalendarEventDates,
  roadmapCalendarEventOccursOnDay,
} from "@/components/roadmap/roadmap-calendar/helpers"
import type { RoadmapCalendarEvent } from "@/lib/roadmap/calendar"

const ROOT = process.cwd()

function readSource(relativePath: string) {
  return readFileSync(join(ROOT, relativePath), "utf8")
}

function buildEvent(
  overrides: Partial<RoadmapCalendarEvent> = {}
): RoadmapCalendarEvent {
  return {
    id: "event-1",
    orgId: "org-1",
    title: "Customer call",
    description: null,
    eventType: "meeting",
    startsAt: "2026-05-14T15:00:00.000Z",
    endsAt: "2026-05-14T16:00:00.000Z",
    allDay: false,
    recurrence: null,
    status: "active",
    assignedRoles: ["admin"],
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
    ...overrides,
  }
}

describe("roadmap calendar month agenda", () => {
  it("matches selected-day events by calendar day instead of the Today button path", () => {
    const event = buildEvent()

    expect(roadmapCalendarEventOccursOnDay(event, new Date(2026, 4, 14))).toBe(
      true
    )
    expect(roadmapCalendarEventOccursOnDay(event, new Date(2026, 4, 15))).toBe(
      false
    )
  })

  it("marks multi-day events on every visible day they touch", () => {
    const event = buildEvent({
      startsAt: new Date(2026, 4, 14, 23, 30).toISOString(),
      endsAt: new Date(2026, 4, 15, 0, 30).toISOString(),
    })

    expect(
      getRoadmapCalendarEventDates(event).map((date) => date.getDate())
    ).toEqual([14, 15])
    expect(roadmapCalendarEventOccursOnDay(event, new Date(2026, 4, 15))).toBe(
      true
    )
  })

  it("expands recurring events into agenda days and event dots", () => {
    const event = buildEvent({
      recurrence: { frequency: "weekly", count: 3 },
    })
    const dateKeys = getRoadmapCalendarEventDates(event).map((date) =>
      date.toISOString().slice(0, 10)
    )

    expect(roadmapCalendarEventOccursOnDay(event, new Date(2026, 4, 21))).toBe(
      true
    )
    expect(roadmapCalendarEventOccursOnDay(event, new Date(2026, 4, 28))).toBe(
      true
    )
    expect(roadmapCalendarEventOccursOnDay(event, new Date(2026, 5, 4))).toBe(
      false
    )
    expect(dateKeys).toEqual(["2026-05-14", "2026-05-21", "2026-05-28"])
  })

  it("keeps recurring event dots bounded by recurrence end dates", () => {
    const event = buildEvent({
      recurrence: { frequency: "monthly", endDate: "2026-07-31" },
    })
    const dateKeys = getRoadmapCalendarEventDates(event).map((date) =>
      date.toISOString().slice(0, 10)
    )

    expect(roadmapCalendarEventOccursOnDay(event, new Date(2026, 6, 14))).toBe(
      true
    )
    expect(roadmapCalendarEventOccursOnDay(event, new Date(2026, 7, 14))).toBe(
      false
    )
    expect(dateKeys).toEqual(["2026-05-14", "2026-06-14", "2026-07-14"])
  })

  it("loads month-overlapping and recurring events instead of only starts-inside-month rows", () => {
    const actionSource = readSource("src/actions/roadmap-calendar.ts")
    const calendar = readSource("src/components/roadmap/roadmap-calendar.tsx")

    expect(actionSource).toContain('query.lte("starts_at", to)')
    expect(actionSource).toContain("ends_at.gte.${from}")
    expect(actionSource).toContain("and(ends_at.is.null,starts_at.gte.${from})")
    expect(actionSource).toContain("recurrence.not.is.null")
    expect(actionSource).not.toContain('query.gte("starts_at", from)')
    expect(calendar).toContain("const monthEvents = useMemo")
    expect(calendar).toContain("getRoadmapCalendarEventDates(event).some")
    expect(calendar).toContain("events={monthEvents}")
  })

  it("keeps the popover chrome contained and limits scrolling to the agenda list", () => {
    const calendarAction = readSource(
      "src/components/app-shell/components/app-shell-calendar-action.tsx"
    )
    const agendaPanel = readSource(
      "src/components/roadmap/roadmap-calendar/components/roadmap-calendar-month-agenda-panel.tsx"
    )
    const agendaPanelParts = readSource(
      "src/components/roadmap/roadmap-calendar/components/roadmap-calendar-month-agenda-panel-parts.tsx"
    )
    const scrollFadeEffect = readSource("src/components/scroll-fade-effect.tsx")
    const popover = readSource("src/components/ui/popover.tsx")
    const drawer = readSource("src/components/ui/drawer.tsx")
    const agendaScrollContainers =
      agendaPanelParts.match(/overflow-y-auto/g) ?? []

    expect(calendarAction).toContain("bg-background/95")
    expect(calendarAction).toContain("w-[min(26rem,calc(100vw-1rem))]")
    expect(calendarAction).toContain("p-0 shadow-none backdrop-blur-xl")
    expect(calendarAction).not.toContain("bg-transparent")
    expect(calendarAction).not.toContain("backdrop-blur-0")
    expect(calendarAction).not.toContain("max-h-[min(43rem,calc(100svh-7rem))]")
    expect(agendaPanel).toContain("max-h-[min(42rem,calc(100svh-5.5rem))]")
    expect(agendaPanel).not.toContain(
      '"flex h-[min(42rem,calc(100svh-5.5rem))]'
    )
    expect(agendaPanel).toContain("className?: string")
    expect(agendaPanel).toContain("className,")
    expect(agendaPanel).toContain("overflow-hidden rounded-[30px]")
    expect(agendaPanelParts).toContain(
      'import { ScrollFadeEffect } from "@/components/scroll-fade-effect"'
    )
    expect(agendaPanelParts).toContain(
      "const RoadmapCalendarAgendaScroll = memo"
    )
    expect(agendaPanelParts).toContain("<ScrollFadeEffect")
    expect(agendaPanelParts).toContain("enabled={showScrollFade}")
    expect(agendaPanelParts).toContain("max-h-[clamp(6.5rem,30dvh,15rem)]")
    expect(agendaPanelParts).toContain(
      "const showScrollFade = fadeEligible && hasScrollableOverflow"
    )
    expect(agendaPanelParts).toContain(
      "node.scrollHeight > node.clientHeight + 1"
    )
    expect(agendaPanel).toContain(
      "fadeEligible={totalDayEvents > 1 && !isLoading}"
    )
    expect(agendaPanelParts).toContain(
      "[--mask-height:1.5rem] [--scroll-buffer:1rem]"
    )
    expect(agendaPanelParts).toContain("pt-1 pr-1 pb-4")
    expect(agendaPanel).not.toContain("mt-3 flex min-h-0 flex-1")
    expect(scrollFadeEffect).toContain(
      "export const ScrollFadeEffect = forwardRef<"
    )
    expect(scrollFadeEffect).toContain("HTMLDivElement,")
    expect(scrollFadeEffect).toContain("const mergedRef = useCallback(")
    expect(scrollFadeEffect).toContain("ref={mergedRef}")
    expect(popover).toContain("forceMount,")
    expect(popover).toContain(
      "<PopoverPrimitive.Portal forceMount={forceMount}>"
    )
    expect(popover).toContain("forceMount={forceMount}")
    expect(drawer).toContain("forceMount,")
    expect(drawer).toContain(
      '<DrawerPortal data-slot="drawer-portal" forceMount={forceMount}>'
    )
    expect(drawer).toContain("forceMount={forceMount}")
    expect(drawer).not.toContain("open === false ? false : modal")
    expect(drawer).toContain("data-[state=closed]:pointer-events-none")
    expect(drawer).toContain("data-[state=closed]:invisible")
    expect(agendaScrollContainers).toHaveLength(1)
    expect(agendaPanel).not.toContain("shadow-[")
    expect(agendaPanel).not.toContain("shadow-sm")
  })

  it("renders the calendar trigger as a shell-level header action", () => {
    const viewportControls = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-surface-v2-viewport-controls-panel.tsx"
    )
    const calendarAction = readSource(
      "src/components/app-shell/components/app-shell-calendar-action.tsx"
    )
    const appShellHeader = readSource(
      "src/components/app-shell/components/app-shell-header.tsx"
    )
    const headerActionSlotIndex = appShellHeader.indexOf(
      'id="site-header-actions-right"'
    )
    const calendarActionIndex = appShellHeader.indexOf(
      "<AppShellCalendarAction"
    )
    const notificationsIndex = appShellHeader.indexOf("<NotificationsMenu")

    expect(calendarAction).toContain('import dynamic from "next/dynamic"')
    expect(calendarAction).toContain("const RoadmapCalendar = dynamic")
    expect(calendarAction).not.toContain("setRoadmapCalendar")
    expect(calendarAction).not.toContain("await import(")
    expect(calendarAction).not.toContain("import { RoadmapCalendar }")
    expect(calendarAction).not.toContain(
      'from "@/components/workspace/workspace-tutorial-callout"'
    )
    expect(calendarAction).toContain("const WorkspaceTutorialCallout = dynamic")
    expect(calendarAction).toContain(
      "const handleCalendarOpenChange = useCallback"
    )
    expect(calendarAction).toContain("const isMobile = useIsMobile()")
    expect(calendarAction).toContain("if (isMobile)")
    expect(calendarAction).toContain("<Drawer")
    expect(calendarAction).toContain("open={calendarOpen}")
    expect(calendarAction).toContain(
      "<DrawerTrigger asChild>{calendarTrigger}</DrawerTrigger>"
    )
    expect(calendarAction).toContain("handleOnly")
    expect(calendarAction).toContain(
      '<DrawerTitle className="sr-only">Workspace calendar</DrawerTitle>'
    )
    expect(calendarAction).toContain("onOpenChange={handleCalendarOpenChange}")
    expect(calendarAction).not.toContain("forceMount")
    expect(calendarAction).toContain("initialView={calendarView}")
    expect(calendarAction).toContain("onViewChange={setCalendarView}")
    expect(calendarAction).toContain("h-[88dvh] max-h-[88dvh]")
    expect(calendarAction).toContain(
      "data-[vaul-drawer-direction=bottom]:max-h-[88dvh]"
    )
    expect(calendarAction).toContain(
      "pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    )
    expect(calendarAction).toContain(
      "overflow-y-auto overscroll-contain px-3 pt-3 pb-0"
    )
    expect(calendarAction).toContain(
      'aria-label={calendarOpen ? "Hide calendar" : "Show calendar"}'
    )
    expect(calendarAction).toContain("useAppShellCalendarActionRegistration")
    expect(viewportControls).toContain("useRegisterAppShellCalendarTutorial")
    expect(viewportControls).toContain(
      "WorkspaceCanvasSurfaceV2HelpOverlay integrated"
    )
    expect(viewportControls).not.toContain('<HeaderActionsPortal slot="right">')
    expect(viewportControls).not.toContain("PopoverAnchor")
    expect(headerActionSlotIndex).toBeGreaterThan(-1)
    expect(calendarActionIndex).toBeGreaterThan(headerActionSlotIndex)
    expect(notificationsIndex).toBeGreaterThan(calendarActionIndex)
  })

  it("stretches the month grid evenly across the calendar panel", () => {
    const agendaPanel = readSource(
      "src/components/roadmap/roadmap-calendar/components/roadmap-calendar-month-grid.tsx"
    )
    const dayButton = readSource(
      "src/components/roadmap/roadmap-calendar/components/roadmap-calendar-day-with-event-dots.tsx"
    )

    expect(agendaPanel).toContain(
      'month_grid: "w-full table-fixed border-collapse"'
    )
    expect(agendaPanel).toContain(
      'weekdays: "w-full border-b border-border/40"'
    )
    expect(agendaPanel).toContain('"w-[14.285714%] pb-2')
    expect(agendaPanel).toContain('weeks: "w-full"')
    expect(agendaPanel).toContain('week: "w-full"')
    expect(agendaPanel).toContain('"w-[14.285714%] min-w-0')
    expect(dayButton).toContain("mx-auto size-(--cell-size) min-h-10 min-w-0")
    expect(dayButton).toContain("getReactGrabOwnerProps")
    expect(dayButton).toContain('ownerId: "roadmap-calendar-month-agenda:day"')
    expect(dayButton).toContain('component: "RoadmapCalendarDayWithEventDots"')
  })

  it("attributes the shared shadcn calendar root back to the roadmap month-grid owner", () => {
    const agendaPanel = readSource(
      "src/components/roadmap/roadmap-calendar/components/roadmap-calendar-month-agenda-panel.tsx"
    )

    expect(agendaPanel).toContain("getReactGrabOwnerProps")
    expect(agendaPanel).toContain(
      'ownerId: "roadmap-calendar-month-agenda:month-grid"'
    )
    expect(agendaPanel).toContain(
      'component: "RoadmapCalendarMonthAgendaPanel"'
    )
    expect(agendaPanel).toContain('slot: "month-grid"')
    expect(agendaPanel).toContain('primitiveImport: "@/components/ui/calendar"')
  })

  it("keeps one add-event menu visible in the month header", () => {
    const agendaPanel = readSource(
      "src/components/roadmap/roadmap-calendar/components/roadmap-calendar-month-agenda-panel.tsx"
    )
    const agendaPanelParts = readSource(
      "src/components/roadmap/roadmap-calendar/components/roadmap-calendar-month-agenda-panel-parts.tsx"
    )
    const menuUsages = agendaPanel.match(/<RoadmapCalendarAddEventMenu/g) ?? []
    const addMenuIndex = agendaPanel.indexOf("<RoadmapCalendarAddEventMenu")
    const calendarGridIndex = agendaPanel.indexOf("<RoadmapCalendarMonthGrid")

    expect(menuUsages).toHaveLength(1)
    expect(addMenuIndex).toBeGreaterThan(-1)
    expect(calendarGridIndex).toBeGreaterThan(-1)
    expect(addMenuIndex).toBeLessThan(calendarGridIndex)
    expect(agendaPanelParts).toContain(
      "mt-3 flex max-h-[clamp(6.5rem,30dvh,15rem)] min-h-0 flex-col"
    )
    expect(agendaPanel).toContain(
      '"border-border/60 bg-muted/45 mx-auto flex max-h-[min(42rem,calc(100svh-5.5rem))] min-h-0 w-full max-w-3xl flex-col'
    )
    expect(agendaPanel).toContain(
      'className="bg-background flex min-h-0 w-full flex-col rounded-[24px]'
    )
    expect(agendaPanel).not.toContain(
      'className="flex min-h-0 flex-1 flex-col rounded-[24px]'
    )
    expect(agendaPanel).not.toContain("min-h-[7.5rem]")
    expect(agendaPanel).not.toContain(
      "border-border/40 mt-3 shrink-0 border-t pt-3"
    )
    expect(agendaPanel).toContain("disabled={!canManageCalendar}")
    expect(agendaPanelParts).toContain('variant="outline"')
    expect(agendaPanelParts).toContain(
      '"h-8 justify-start px-3 text-sm font-medium"'
    )
    expect(agendaPanelParts).toContain('{iconOnly ? null : "Add event"}')
  })

  it("scopes icon-only controls to the app-shell calendar", () => {
    const calendarAction = readSource(
      "src/components/app-shell/components/app-shell-calendar-action.tsx"
    )
    const calendar = readSource("src/components/roadmap/roadmap-calendar.tsx")
    const roadmapEditorShell = readSource(
      "src/components/roadmap/roadmap-editor/components/roadmap-editor-shell.tsx"
    )
    const agendaPanel = readSource(
      "src/components/roadmap/roadmap-calendar/components/roadmap-calendar-month-agenda-panel.tsx"
    )
    const agendaPanelParts = readSource(
      "src/components/roadmap/roadmap-calendar/components/roadmap-calendar-month-agenda-panel-parts.tsx"
    )

    expect(calendarAction).toMatch(
      /<RoadmapCalendar\s+hideHeaderCopy\s+compactHeaderControls/
    )
    expect(calendar).toContain("compactHeaderControls = false")
    expect(calendar).toContain("compactHeaderControls={compactHeaderControls}")
    expect(roadmapEditorShell).toContain("<RoadmapCalendar />")
    expect(agendaPanel).toContain("iconOnly={compactHeaderControls}")
    expect(agendaPanel).toContain(
      'aria-label={compactHeaderControls ? "Go to today" : undefined}'
    )
    expect(agendaPanel).toContain(
      '<CircleIcon className="size-2 fill-current" aria-hidden />'
    )
    expect(agendaPanelParts).toContain(
      'aria-label={iconOnly ? "Add event" : undefined}'
    )
    expect(agendaPanelParts).toContain('{iconOnly ? null : "Add event"}')
  })

  it("keeps coaching out of the month-grid header", () => {
    const agendaPanel = readSource(
      "src/components/roadmap/roadmap-calendar/components/roadmap-calendar-month-agenda-panel.tsx"
    )
    const agendaPanelParts = readSource(
      "src/components/roadmap/roadmap-calendar/components/roadmap-calendar-month-agenda-panel-parts.tsx"
    )
    const calendar = readSource("src/components/roadmap/roadmap-calendar.tsx")

    expect(agendaPanel).not.toContain("RoadmapCalendarCoachingHeaderAction")
    expect(agendaPanel).not.toContain("CoachingAvatarGroup")
    expect(agendaPanel).not.toContain('slot: "coaching-action"')
    expect(agendaPanel).not.toContain("useCoachingBooking")
    expect(agendaPanel).toContain("shrink-0 text-lg")
    expect(agendaPanel).toContain("whitespace-nowrap")
    expect(agendaPanel).not.toContain(
      '<span className="min-w-0 truncate whitespace-nowrap leading-snug">'
    )
    expect(agendaPanel).toContain(
      "grid grid-cols-1 items-center gap-2 px-2 pt-1 pb-3 sm:grid-cols-[minmax(0,1fr)_auto]"
    )
    expect(agendaPanel).toContain(
      "flex min-w-0 shrink-0 items-center gap-1.5 justify-self-end"
    )
    expect(agendaPanel).toContain(
      "const showTodayButton = !isSameCalendarMonth(month, new Date())"
    )
    expect(agendaPanel).toContain("{showTodayButton ? (")
    expect(agendaPanel).toContain(") : null}")
    const previousMonthIndex = agendaPanel.indexOf(
      'aria-label="Show previous month"'
    )
    const todayIndex = agendaPanel.indexOf("onClick={onGoToToday}")
    const nextMonthIndex = agendaPanel.indexOf('aria-label="Show next month"')
    expect(previousMonthIndex).toBeGreaterThan(-1)
    expect(todayIndex).toBeGreaterThan(previousMonthIndex)
    expect(nextMonthIndex).toBeGreaterThan(todayIndex)
    expect(agendaPanel).not.toContain("RoadmapCalendarCoachingTab")
    expect(agendaPanel).not.toContain("Add hold")
    expect(agendaPanel).not.toContain("CardContent")
    expect(calendar).not.toContain("isTodaySelected")
  })

  it("keeps event-editor state changes off the month grid render path", () => {
    const calendar = readSource("src/components/roadmap/roadmap-calendar.tsx")
    const agendaPanel = readSource(
      "src/components/roadmap/roadmap-calendar/components/roadmap-calendar-month-agenda-panel.tsx"
    )
    const agendaPanelParts = readSource(
      "src/components/roadmap/roadmap-calendar/components/roadmap-calendar-month-agenda-panel-parts.tsx"
    )
    const eventDrawer = readSource(
      "src/components/roadmap/roadmap-calendar/components/roadmap-calendar-event-drawer.tsx"
    )

    expect(calendar).toContain("useCallback")
    expect(calendar).toContain("const handleEditEvent = useCallback")
    expect(calendar).toContain("const formatTimeRange = useCallback")
    expect(agendaPanel).toContain(
      "export const RoadmapCalendarMonthAgendaPanel = memo"
    )
    expect(agendaPanelParts).toContain("const RoadmapCalendarAgendaRow = memo")
    expect(eventDrawer).toContain(
      "export const RoadmapCalendarEventDrawer = memo"
    )
  })

  it("keeps the add-event controls aligned with shadcn select and menu composition", () => {
    const agendaPanel = readSource(
      "src/components/roadmap/roadmap-calendar/components/roadmap-calendar-month-agenda-panel.tsx"
    )
    const agendaPanelParts = readSource(
      "src/components/roadmap/roadmap-calendar/components/roadmap-calendar-month-agenda-panel-parts.tsx"
    )
    const eventDrawer = readSource(
      "src/components/roadmap/roadmap-calendar/components/roadmap-calendar-event-drawer.tsx"
    )

    expect(agendaPanelParts).toContain("DropdownMenuGroup")
    expect(eventDrawer).toContain("SelectGroup")
    expect(eventDrawer).toContain("DrawerDescription")
    expect(eventDrawer).toContain("ROADMAP_CALENDAR_EVENT_TYPE_META")
    expect(eventDrawer).toContain("eventTypeMeta.badgeClassName")
    expect(eventDrawer).toContain('data-icon="inline-start"')
    expect(eventDrawer).not.toContain("space-y-")
  })

  it("shows event row status and role targeting without adding a second calendar surface", () => {
    const agendaPanel = readSource(
      "src/components/roadmap/roadmap-calendar/components/roadmap-calendar-month-agenda-panel.tsx"
    )
    const agendaPanelParts = readSource(
      "src/components/roadmap/roadmap-calendar/components/roadmap-calendar-month-agenda-panel-parts.tsx"
    )

    expect(agendaPanelParts).toContain("ROLE_LABEL_BY_ID")
    expect(agendaPanelParts).toContain('roleLabels.join(", ")')
    expect(agendaPanelParts).toContain(
      "decoration-muted-foreground/60 line-through"
    )
    expect(agendaPanelParts).toContain("Canceled")
  })

  it("keeps full agenda times visible below the event title", () => {
    const agendaPanel = readSource(
      "src/components/roadmap/roadmap-calendar/components/roadmap-calendar-month-agenda-panel.tsx"
    )
    const agendaPanelParts = readSource(
      "src/components/roadmap/roadmap-calendar/components/roadmap-calendar-month-agenda-panel-parts.tsx"
    )

    expect(agendaPanelParts).toContain("grid-cols-[auto_minmax(0,1fr)]")
    expect(agendaPanelParts).toContain("whitespace-normal")
    expect(agendaPanelParts).not.toContain(
      "grid-cols-[auto_3.75rem_minmax(0,1fr)]"
    )
    expect(agendaPanelParts).not.toContain(
      "truncate text-left text-xs text-muted-foreground/70 tabular-nums"
    )
  })
})
