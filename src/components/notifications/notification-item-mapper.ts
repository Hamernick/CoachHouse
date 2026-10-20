import { type AppNotification } from "@/app/actions/notifications"
import { type NotificationItem } from "@/components/notifications/types"
import { readOrganizationAccessRequestNotificationMetadata } from "@/features/organization-access"

export function readOrganizationAccessRequestIdFromNotificationHref(
  href: string | null | undefined,
) {
  if (typeof href !== "string" || href.trim().length === 0) {
    return null
  }

  try {
    const url = new URL(href, "https://coachhouse.test")
    if (url.pathname !== "/access-requests") {
      return null
    }

    const requestId = url.searchParams.get("request")?.trim() ?? ""
    return requestId.length > 0 ? requestId : null
  } catch {
    return null
  }
}

function resolveOrganizationAccessRequestId(item: AppNotification) {
  const metadata = readOrganizationAccessRequestNotificationMetadata(item.metadata)
  if (metadata?.requestId) {
    return metadata.requestId
  }

  return readOrganizationAccessRequestIdFromNotificationHref(item.href)
}

export function formatNotificationTime(createdAt: string) {
  const date = new Date(createdAt)
  const diffMs = Date.now() - date.getTime()

  if (Number.isFinite(diffMs) && diffMs >= 0 && diffMs < 60_000) {
    return "Just now"
  }

  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  const dayDiff = Math.round((startOfToday - startOfDate) / (24 * 60 * 60 * 1000))

  if (dayDiff === 0) return "Today"
  if (dayDiff === 1) return "Yesterday"

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  })
}

export function toNotificationItem(item: AppNotification): NotificationItem {
  const organizationAccessRequestId = resolveOrganizationAccessRequestId(item)
  // Old receipts retain their stored description/history, but make the actor's
  // receipt distinct from the assignee's personal task notification.
  const title = item.type === "task_assignment_confirmed" && item.title === "Task assignment confirmed"
    ? "You assigned a task"
    : item.title

  return {
    id: item.id,
    title,
    description: item.description,
    href: item.href,
    tone: item.tone ?? "info",
    time: formatNotificationTime(item.createdAt),
    unread: item.readAt == null,
    openLabel: organizationAccessRequestId ? "Review request" : undefined,
    organizationAccessRequestId,
  }
}
