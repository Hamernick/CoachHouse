import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { TaskWeekBoard, type TaskWeekBoardProps } from "@/features/member-workspace/components/tasks/task-week-board"
import {
  addCalendarDays, calendarDay, formatCalendarDay, isCalendarDay,
  partitionTaskBoard, weekStartForDay,
} from "@/features/member-workspace/lib/task-board"
import type { MemberWorkspaceTaskItem } from "@/features/member-workspace/types"

const task = (id: string, startDate = "", endDate = "", status: MemberWorkspaceTaskItem["status"] = "todo"): MemberWorkspaceTaskItem => ({
  id, startDate, endDate, status, title: id, projectId: "project", projectName: "Project",
  projectClient: null, projectStatus: "active", projectPriority: "medium", projectTags: [],
  projectMembers: [], projectStartDate: "", projectEndDate: "", taskType: "task", canUpdate: true,
})

describe("weekly task board conservation", () => {
  const tasks = [
    task("monday", "2026-10-19"), task("friday", "2026-10-23"),
    task("saturday", "2026-10-24"), task("sunday", "2026-10-25"),
    task("past", "2026-10-18"), task("future", "2026-10-26"),
    task("undated"), task("due-only", "", "2026-10-19"),
    { ...task("fiscal"), canUpdate: false }, task("invalid", "2026-02-30"),
    task("waiting", "2026-10-20", "", "waiting"),
  ]
  it.each([false, true])("accounts for every task exactly once with weekends=%s", (showWeekend) => {
    const board = partitionTaskBoard(tasks, "2026-10-20", showWeekend, "2026-10-20")
    const accounted = [...board.days.flatMap((day) => day.tasks), ...board.unscheduled, ...board.hiddenWeekend, ...board.outsideWeek]
    expect(accounted.map((item) => item.id).sort()).toEqual(tasks.map((item) => item.id).sort())
    expect(new Set(accounted.map((item) => item.id)).size).toBe(tasks.length)
    expect(board.days[0].date).toBe("2026-10-19")
    expect(board.unscheduled.map((item) => item.id)).toEqual(["undated", "due-only", "fiscal", "invalid"])
    expect(board.hiddenWeekend.map((item) => item.id)).toEqual(showWeekend ? [] : ["saturday", "sunday"])
    expect(board.outsideWeek.map((item) => item.id)).toEqual(["past", "future"])
    expect(board.overdue.map((item) => item.id)).toEqual(["due-only"])
  })

  it("uses unfinished deadline rather than old start date for overdue", () => {
    const board = partitionTaskBoard([
      task("old-start", "2026-10-01", "2026-10-21"),
      task("done", "", "2026-10-01", "done"),
      task("due-today", "", "2026-10-20"),
      task("waiting-overdue", "", "2026-10-19", "waiting"),
      task("no-deadline", "2026-10-01"),
    ], "2026-10-19", false, "2026-10-20")
    expect(board.overdue.map((item) => item.id)).toEqual(["waiting-overdue"])
  })

  it("preserves server order and project IDs even when project names match", () => {
    const ordered = [
      { ...task("z", "2026-10-20"), projectId: "b" },
      { ...task("a", "2026-10-20"), projectId: "b" },
      { ...task("x", "2026-10-20"), projectId: "a" },
    ]
    const board = partitionTaskBoard(ordered, "2026-10-19", false, "2026-10-20")
    expect(board.days[1].tasks).toEqual(ordered)
    expect(ordered.map((item) => item.id)).toEqual(["z", "a", "x"])
  })
})

describe("task board calendar arithmetic", () => {
  it.each(["2026-02-30", "2026-13-01", "2026-1-01", "", "2026-10-20T00:00:00Z"])("rejects invalid calendar day %s", (value) => {
    expect(isCalendarDay(value)).toBe(false)
    expect(() => addCalendarDays(value, 1)).toThrow("Invalid calendar day")
  })

  it("handles leap days, month/year edges and Sunday as the end of a week", () => {
    expect(addCalendarDays("2028-02-28", 1)).toBe("2028-02-29")
    expect(addCalendarDays("2026-12-31", 1)).toBe("2027-01-01")
    expect(weekStartForDay("2027-01-03")).toBe("2026-12-28")
    expect(weekStartForDay("2026-10-19")).toBe("2026-10-19")
  })

  it("preserves days and Monday boundaries across DST in western and eastern timezones", () => {
    const original = process.env.TZ
    try {
      for (const zone of ["America/New_York", "Pacific/Honolulu", "Asia/Tokyo"]) {
        process.env.TZ = zone
        expect(calendarDay(new Date(2026, 9, 20, 1))).toBe("2026-10-20")
        expect(addCalendarDays("2026-03-07", 2)).toBe("2026-03-09")
        expect(addCalendarDays("2026-10-31", 2)).toBe("2026-11-02")
        expect(weekStartForDay("2026-11-01")).toBe("2026-10-26")
        expect(formatCalendarDay("2026-03-08", { month: "short", day: "numeric" })).toBe("Mar 8")
      }
    } finally {
      if (original === undefined) delete process.env.TZ
      else process.env.TZ = original
    }
  })
})

describe("task board permission-aware presentation", () => {
  const props: TaskWeekBoardProps = {
    tasks: [], weekStart: "2026-10-19", showWeekend: false, pendingTaskIds: new Set(),
    onWeekChange: () => {}, onWeekendChange: () => {}, onToggleTask: () => {},
    onOpenTask: () => {}, onScheduleTask: async () => true,
    capabilities: (item) => ({ status: true, details: item.canUpdate, schedule: item.canUpdate }),
  }
  it("retains fiscal completion without offering edit or scheduling", () => {
    const markup = renderToStaticMarkup(createElement(TaskWeekBoard, {
      ...props, tasks: [{ ...task("Review application"), canUpdate: false, organizationName: "Community House" }],
    }))
    expect(markup).toContain('aria-label="Mark Review application as done"')
    expect(markup).not.toContain('aria-label="Schedule Review application"')
    expect(markup).not.toContain('aria-label="Drag Review application')
    expect(markup).toContain("Community House")
    expect(markup).toContain("Unscheduled")
  })
  it("disables task controls while pending and provides a keyboard scheduling control", () => {
    const markup = renderToStaticMarkup(createElement(TaskWeekBoard, {
      ...props, tasks: [task("Prepare docs", "2026-10-20")], pendingTaskIds: new Set(["Prepare docs"]),
    }))
    expect(markup).toContain('aria-busy="true"')
    expect(markup).toContain('aria-label="Schedule Prepare docs"')
    expect(markup).toContain('aria-label="Mark Prepare docs as done"')
    expect(markup).toMatch(/disabled=""[^>]*aria-label="Schedule Prepare docs"/)
    expect(markup).toContain("Saving…")
  })
  it("keeps week navigation and contextual Add available on an empty board", () => {
    const markup = renderToStaticMarkup(createElement(TaskWeekBoard, { ...props, onAddTask: () => {} }))
    expect(markup).toContain('aria-label="Previous week"')
    expect(markup).toContain('aria-label="Next week"')
    expect(markup).toContain('aria-label="Add task to 19 Mon"')
    expect(markup).toContain("0 matching tasks")
  })
})
