import "./test-utils"

import { describe, expect, it, vi } from "vitest"

import {
  loadOrganizationProjectActivity,
  loadOrganizationProjectActivityResult,
} from "@/features/member-workspace/server/project-activity"

function createActivityRow({
  id,
  occurredAt,
}: {
  id: string
  occurredAt: string
}) {
  return {
    id,
    org_id: "org-1",
    project_id: "project-1",
    entity_type: "task",
    entity_id: "task-1",
    event_type: "status_changed",
    title: "Prepare launch",
    from_status: "todo",
    to_status: "in-progress",
    actor_id: "admin-1",
    metadata: {},
    occurred_at: occurredAt,
  }
}

describe("organization project activity", () => {
  it.each([
    [
      {
        code: "42P01",
        message: "organization_project_activity_events does not exist",
      },
      "unavailable",
    ],
    [{ code: "XX000", message: "Database error" }, "error"],
    [null, "ready"],
  ])(
    "distinguishes missing schema, failed reads, and empty history",
    async (error, state) => {
      const query = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        returns: vi.fn().mockResolvedValue({ data: [], error }),
      }
      const result = await loadOrganizationProjectActivityResult({
        orgId: "org-1",
        projectId: "project-1",
        supabase: { from: () => query } as never,
      })
      expect(result).toEqual({ state, items: [] })
      expect(query.eq).toHaveBeenCalledWith("org_id", "org-1")
      expect(query.or).toHaveBeenCalledWith(
        "project_id.eq.project-1,entity_type.in.(program,document,file)"
      )
    }
  )

  it("loads the newest 200 events and displays them newest-first", async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      returns: vi.fn().mockResolvedValue({
        data: [
          createActivityRow({
            id: "event-newest",
            occurredAt: "2026-07-17T15:00:00.000Z",
          }),
          createActivityRow({
            id: "event-middle",
            occurredAt: "2026-07-16T15:00:00.000Z",
          }),
          createActivityRow({
            id: "event-oldest",
            occurredAt: "2026-07-15T15:00:00.000Z",
          }),
        ],
        error: null,
      }),
    }
    const supabase = {
      from: vi.fn(() => query),
    }

    const activity = await loadOrganizationProjectActivity({
      orgId: "org-1",
      projectId: "project-1",
      supabase: supabase as never,
    })

    expect(query.order).toHaveBeenCalledWith("occurred_at", {
      ascending: false,
    })
    expect(query.limit).toHaveBeenCalledWith(200)
    expect(activity.map((item) => item.id)).toEqual([
      "event-newest",
      "event-middle",
      "event-oldest",
    ])
    expect(activity.map((item) => item.durationLabel)).toEqual([
      "1 day",
      "1 day",
      null,
    ])
  })
})
