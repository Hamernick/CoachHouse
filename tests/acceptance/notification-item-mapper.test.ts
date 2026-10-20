import { describe, expect, it } from "vitest"

import type { AppNotification } from "@/app/actions/notifications"
import {
  readOrganizationAccessRequestIdFromNotificationHref,
  toNotificationItem,
} from "@/components/notifications/notification-item-mapper"
import { ORGANIZATION_ACCESS_REQUEST_NOTIFICATION_TYPE } from "@/features/organization-access"

function buildNotification(
  overrides: Partial<AppNotification> = {},
): AppNotification {
  return {
    id: "notification-1",
    title: "South Side Youth Alliance invited you to collaborate",
    description: "Joel requested staff access for you.",
    href: "/access-requests?request=request-123",
    tone: "info",
    createdAt: "2026-04-16T16:00:00.000Z",
    readAt: null,
    archivedAt: null,
    type: ORGANIZATION_ACCESS_REQUEST_NOTIFICATION_TYPE,
    metadata: {
      requestId: "request-123",
      role: "staff",
    },
    ...overrides,
  }
}

describe("notification item mapper", () => {
  it("distinguishes historical assigning-staff receipts from personal assignments", () => {
    const receipt = buildNotification({ type: "task_assignment_confirmed", title: "Task assignment confirmed", description: "A task was assigned to Caleb." })
    expect(toNotificationItem(receipt)).toMatchObject({ title: "You assigned a task", description: receipt.description })
    expect(toNotificationItem(buildNotification({ type: "task_assigned", title: "Task assigned to you" })).title).toBe("Task assigned to you")
    expect(toNotificationItem({ ...receipt, title: "You assigned a task to Caleb" }).title).toBe("You assigned a task to Caleb")
  })
  it("extracts organization access request ids from access-request review links", () => {
    expect(
      readOrganizationAccessRequestIdFromNotificationHref(
        "/access-requests?request=request-123",
      ),
    ).toBe("request-123")
    expect(
      readOrganizationAccessRequestIdFromNotificationHref("/workspace"),
    ).toBeNull()
  })

  it("falls back to the review href when legacy notification metadata is incomplete", () => {
    const item = toNotificationItem(
      buildNotification({
        metadata: {
          requestId: "request-123",
          role: "staff",
        },
      }),
    )

    expect(item.organizationAccessRequestId).toBe("request-123")
    expect(item.openLabel).toBe("Review request")
  })
})
