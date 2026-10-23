"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useVisibleRefresh } from "@/hooks/use-visible-refresh"
import { useRouter } from "next/navigation"

import {
  acceptOrganizationAccessRequestAction,
  declineOrganizationAccessRequestAction,
} from "@/app/actions/organization-access"
import {
  listNotificationsAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
  markNotificationUnreadAction,
} from "@/app/actions/notifications"
import { toast } from "@/lib/toast"

import {
  filterNotificationItems,
  markAllNotificationsRead,
  setInboxNotificationUnread,
  resolveSelectedNotificationId,
  type NotificationInboxState,
  type NotificationViewTab,
} from "@/components/notifications/notifications-menu-state-helpers"
import { toNotificationItem } from "@/components/notifications/notification-item-mapper"
import { type NotificationItem } from "@/components/notifications/types"

const EMPTY_INBOX: NotificationItem[] = []

export function useNotificationsMenuState() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<NotificationViewTab>("all")
  const currentTab = useRef<NotificationViewTab>("all")
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [inbox, setInbox] = useState<NotificationInboxState | null>(null)
  const inboxItems = inbox?.items ?? EMPTY_INBOX
  const refreshVersion = useRef(0)
  const pendingMutations = useRef(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [bulkUpdating, setBulkUpdating] = useState(false)
  const [selectedUpdating, setSelectedUpdating] = useState(false)
  const [requestUpdating, setRequestUpdating] = useState<
    "accepted" | "declined" | null
  >(null)

  const filteredItems = useMemo(
    () => filterNotificationItems(inboxItems, tab),
    [inboxItems, tab],
  )
  const selectedItem = useMemo(
    () => filteredItems.find((item) => item.id === selectedId) ?? null,
    [filteredItems, selectedId],
  )
  const totalCount = inbox?.totalCount ?? null
  const unreadCount = inbox?.unreadCount ?? 0
  const showBellUnreadCue = unreadCount > 0

  useEffect(() => {
    setMounted(true)
    return () => { refreshVersion.current += 1 }
  }, [])

  const refreshNotifications = useCallback(async () => {
    if (pendingMutations.current > 0) return
    const version = ++refreshVersion.current
    setLoading(true)
    setLoadError(null)
    try {
      const result = await listNotificationsAction(currentTab.current)
      if (version !== refreshVersion.current) return
      if ("error" in result) {
        setInbox(null)
        setSelectedId(null)
        setLoadError(result.error)
        toast.error(result.error)
        return
      }

      setInbox({
        items: result.inbox.map(toNotificationItem),
        totalCount: result.totalCount,
        unreadCount: result.unreadCount,
      })
    } catch {
      if (version !== refreshVersion.current) return
      setInbox(null)
      setSelectedId(null)
      const message = "Unable to load notifications."
      setLoadError(message)
      toast.error(message)
    } finally {
      if (version === refreshVersion.current) setLoading(false)
    }
  }, [])

  const beginMutation = useCallback(() => {
    pendingMutations.current += 1
    refreshVersion.current += 1
    setLoading(false)
  }, [])

  const finishMutation = useCallback(() => {
    pendingMutations.current -= 1
    if (pendingMutations.current === 0) void refreshNotifications()
  }, [refreshNotifications])

  useEffect(() => {
    currentTab.current = tab
    if (!mounted) return
    void refreshNotifications()
  }, [tab, mounted, refreshNotifications])

  useEffect(() => {
    if (!open) return
    void refreshNotifications()
  }, [open, refreshNotifications])

  useVisibleRefresh(
    refreshNotifications,
    mounted && !bulkUpdating && !selectedUpdating && !requestUpdating,
  )

  useEffect(() => {
    const nextSelectedId = resolveSelectedNotificationId(filteredItems, selectedId)
    if (nextSelectedId !== selectedId) {
      setSelectedId(nextSelectedId)
    }
  }, [filteredItems, selectedId])

  const persistUnreadState = useCallback(
    async (notificationId: string, unread: boolean) => {
      beginMutation()
      setInbox((prev) => setInboxNotificationUnread(prev, notificationId, unread))
      try {
        const result = await (unread
          ? markNotificationUnreadAction(notificationId)
          : markNotificationReadAction(notificationId))
        if ("error" in result) toast.error(result.error)
      } catch {
        toast.error("Unable to update notification.")
      } finally {
        finishMutation()
      }
    },
    [beginMutation, finishMutation],
  )

  const handleSelect = useCallback((item: NotificationItem) => {
    setSelectedId(item.id)
  }, [])

  const handleOpenSelected = useCallback(
    (item: NotificationItem) => {
      if (!item.href) return
      if (item.unread) {
        void persistUnreadState(item.id, false)
      }
      setOpen(false)
      router.push(item.href)
    },
    [persistUnreadState, router],
  )

  const handleToggleRead = useCallback(
    (item: NotificationItem) => {
      setSelectedUpdating(true)

      void persistUnreadState(item.id, !item.unread).finally(() =>
        setSelectedUpdating(false),
      )
    },
    [persistUnreadState],
  )

  const handleRespondToOrganizationAccessRequest = useCallback(
    (item: NotificationItem, nextStatus: "accepted" | "declined") => {
      const requestId = item.organizationAccessRequestId?.trim()
      if (!requestId) return

      setRequestUpdating(nextStatus)
      beginMutation()

      if (item.unread) {
        void persistUnreadState(item.id, false)
      }

      const respondAction =
        nextStatus === "accepted"
          ? acceptOrganizationAccessRequestAction
          : declineOrganizationAccessRequestAction

      void respondAction(requestId).then((result) => {
        if ("error" in result) {
          toast.error(result.error)
          return
        }

        toast.success(
          nextStatus === "accepted"
            ? "Organization access accepted"
            : "Organization access declined",
        )

        if (nextStatus === "accepted") {
          setOpen(false)
          router.push("/workspace?joined=1")
          return
        }
      }).catch(() => {
        toast.error("Unable to respond to organization access request.")
      }).finally(() => {
        setRequestUpdating(null)
        finishMutation()
      })
    },
    [beginMutation, finishMutation, persistUnreadState, router],
  )

  const handleMarkAllRead = useCallback(() => {
    if (unreadCount === 0) return

    beginMutation()
    setBulkUpdating(true)
    setInbox((prev) => prev
      ? { ...prev, items: markAllNotificationsRead(prev.items), unreadCount: 0 }
      : prev,
    )

    void markAllNotificationsReadAction().then((result) => {
      if ("error" in result) {
        toast.error(result.error)
      }
    }).catch(() => {
      toast.error("Unable to update notifications.")
    }).finally(() => {
      setBulkUpdating(false)
      finishMutation()
    })
  }, [beginMutation, finishMutation, unreadCount])

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen)
  }, [])

  return {
    open,
    tab,
    mounted,
    loading,
    inboxItems,
    filteredItems,
    selectedId,
    selectedItem,
    loadError,
    bulkUpdating,
    selectedUpdating,
    requestUpdating,
    totalCount,
    unreadCount,
    showBellUnreadCue,
    refreshNotifications,
    setTab,
    handleSelect,
    handleOpenSelected,
    handleToggleRead,
    handleRespondToOrganizationAccessRequest,
    handleMarkAllRead,
    handleOpenChange,
  }
}
