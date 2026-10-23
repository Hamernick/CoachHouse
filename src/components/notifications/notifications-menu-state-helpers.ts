import { type NotificationItem } from "@/components/notifications/types"

export type NotificationViewTab = "all" | "unread"

export type NotificationInboxState = {
  items: NotificationItem[]
  totalCount: number
  unreadCount: number
}

export function setInboxNotificationUnread(
  inbox: NotificationInboxState | null,
  notificationId: string,
  unread: boolean,
): NotificationInboxState | null {
  if (!inbox) return inbox
  const item = inbox.items.find((item) => item.id === notificationId)
  if (!item || item.unread === unread) return inbox

  return {
    ...inbox,
    items: inbox.items.map((item) =>
      item.id === notificationId ? { ...item, unread } : item,
    ),
    unreadCount: Math.max(0, inbox.unreadCount + (unread ? 1 : -1)),
  }
}

export function countUnreadNotifications(items: NotificationItem[]) {
  return items.filter((item) => item.unread).length
}

export function filterNotificationItems(
  items: NotificationItem[],
  tab: NotificationViewTab,
) {
  if (tab === "unread") {
    return items.filter((item) => item.unread)
  }

  return items
}

export function resolveSelectedNotificationId(
  items: NotificationItem[],
  selectedId: string | null,
) {
  if (items.length === 0) {
    return null
  }

  if (selectedId && items.some((item) => item.id === selectedId)) {
    return selectedId
  }

  return items[0]?.id ?? null
}

export function markNotificationRead(
  items: NotificationItem[],
  notificationId: string,
) {
  return items.map((item) =>
    item.id === notificationId ? { ...item, unread: false } : item,
  )
}

export function markNotificationUnread(
  items: NotificationItem[],
  notificationId: string,
) {
  return items.map((item) =>
    item.id === notificationId ? { ...item, unread: true } : item,
  )
}

export function markAllNotificationsRead(items: NotificationItem[]) {
  return items.map((item) => (item.unread ? { ...item, unread: false } : item))
}
