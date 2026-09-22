import { readFileSync } from "node:fs"
import { join } from "node:path"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { TimelineGantt } from "@/features/platform-admin-dashboard/upstream/components/projects/TimelineGantt"

describe("project timeline calendar", () => {
  it("keeps the calendar while displaying tasks, programs, activity, and creation", () => {
    const markup = renderToStaticMarkup(
      React.createElement(TimelineGantt, {
        tasks: [
          {
            id: "task-1",
            assignee: { id: "coach-1", name: "Assigned Coach", avatarUrl: "https://example.com/avatar.png" },
            name: "Review application",
            startDate: new Date("2026-07-14T12:00:00.000Z"),
            endDate: new Date("2026-07-16T12:00:00.000Z"),
            status: "in-progress" as const,
          },
        ],
        programs: [
          {
            id: "program-1",
            title: "Neighborhood grants",
            statusLabel: "Active",
            startAt: "2026-07-13T12:00:00.000Z",
            endAt: "2026-07-18T12:00:00.000Z",
          },
        ],
        activity: [
          {
            id: "event-1",
            entityType: "program" as const,
            eventType: "updated",
            title: "Neighborhood grants published",
            fromStatus: "draft",
            toStatus: "active",
            occurredAt: new Date("2026-07-15T15:00:00.000Z"),
            durationLabel: null,
          },
        ],
        onCreateTask: () => undefined,
      })
    )

    expect(markup).toContain("Expected Timeline")
    expect(markup).toContain("Review application")
    expect(markup).toContain("Neighborhood grants")
    expect(markup).toContain("Neighborhood grants published")
    expect(markup).toContain("1 activity events on")
    expect(markup).toContain('aria-label="Task assignee"')
    expect(markup).toContain('alt="Assigned Coach"')
    expect(markup).not.toContain(">1 event<")
    expect(markup).toContain("Recorded events")
    expect(markup).toContain("data-timeline-activity-row")
    expect(markup).toContain("data-timeline-activity-bar")
    expect(markup).not.toContain("Activity this week")
    expect(markup).toContain("Add task")
    expect(markup).toContain('aria-label="Previous week"')
    expect(markup).toContain('aria-label="Next week"')
    expect(markup).toContain('aria-label="Jump to date"')
    expect(markup).toContain('aria-label="Search timeline"')
    expect(markup).not.toContain("overflow-x-auto")
  })

  it("connects the calendar to loaded organization data and task creation", () => {
    const detailTabsSource = readFileSync(
      join(
        process.cwd(),
        "src/features/member-workspace/components/projects/member-workspace-project-detail-tabs.tsx"
      ),
      "utf8"
    )

    expect(detailTabsSource).toContain("activity={project.activity}")
    expect(detailTabsSource).toContain(
      "programs={organizationSummary.programs}"
    )
    expect(detailTabsSource).toContain(
      "() => onCreateTask({ projectId: project.id })"
    )
  })
})
