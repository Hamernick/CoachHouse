"use client"

import * as React from "react"
import Loader2Icon from "lucide-react/dist/esm/icons/loader-2"
import type { useNotificationsMenuState } from "./hooks/use-notifications-menu-state"
import { NotificationsList } from "./notifications-list"
import { Button } from "@/components/ui/button"
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

const NOTIFICATIONS_MOBILE_SNAP_POINTS = [0.62, 0.92]
const NOTIFICATIONS_MOBILE_INITIAL_SNAP_POINT = NOTIFICATIONS_MOBILE_SNAP_POINTS[0]

export function NotificationsMenuOverlay({ state, isMobile, trigger, contentId }: {
  state: ReturnType<typeof useNotificationsMenuState>
  isMobile: boolean
  trigger: React.RefObject<HTMLButtonElement | null>
  contentId: string
}) {
  const [mobileSnapPoint, setMobileSnapPoint] = React.useState<number | string | null>(NOTIFICATIONS_MOBILE_INITIAL_SNAP_POINT)
  const [activeActionId, setActiveActionId] = React.useState<string | null>(null)
  const { open, tab, loading, filteredItems, loadError, bulkUpdating, selectedUpdating, requestUpdating,
    totalCount, unreadCount, refreshNotifications, setTab, handleOpenSelected, handleToggleRead,
    handleRespondToOrganizationAccessRequest, handleMarkAllRead, handleOpenChange } = state
  const updating = bulkUpdating || selectedUpdating || requestUpdating !== null
  React.useLayoutEffect(() => { if (open) setMobileSnapPoint(NOTIFICATIONS_MOBILE_INITIAL_SNAP_POINT) }, [open])
  const handleMobileOpenChange = (nextOpen: boolean) => {
    handleOpenChange(nextOpen)
    if (nextOpen) setMobileSnapPoint(NOTIFICATIONS_MOBILE_INITIAL_SNAP_POINT)
  }
  const restoreFocus = (event: Event) => {
    event.preventDefault()
    trigger.current?.focus()
  }

  const notificationsHeader = (
    <div className="flex shrink-0 items-center justify-between gap-3 px-4 pt-4 pb-3">
      <div className="flex min-w-0 items-center gap-2">
        <p className="text-foreground truncate text-sm font-semibold">Notifications</p>
        {totalCount !== null ? (
          <span className="text-sm tabular-nums text-muted-foreground">({totalCount})</span>
        ) : null}
      </div>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => { setActiveActionId(null); handleMarkAllRead() }}
        disabled={updating || loading || unreadCount === 0}
        className="shrink-0 rounded-lg"
      >
        {bulkUpdating ? (
          <Loader2Icon className="size-4 motion-safe:animate-spin" aria-hidden />
        ) : null}
        Mark all read
      </Button>
    </div>
  )

  const notificationsTabs = (
    <div className="shrink-0 px-4 pb-3">
      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as typeof tab)}
        className="w-full"
      >
        <TabsList aria-label="Filter notifications" className="h-9 w-full rounded-full p-1">
          <TabsTrigger
            value="all"
            className="rounded-full px-3 text-xs"
          >
            All
          </TabsTrigger>
          <TabsTrigger
            value="unread"
            className="rounded-full px-3 text-xs"
          >
            Unread {unreadCount > 0 ? `(${unreadCount})` : ""}
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  )

  const notificationsBody = (
    <>
      {notificationsHeader}
      {notificationsTabs}
      <div className="min-h-0 flex-1 overflow-hidden">
        <NotificationsList
          items={filteredItems}
          loading={loading}
          error={loadError}
          updating={updating}
          activeActionId={activeActionId}
          requestUpdating={requestUpdating}
          className={isMobile ? "h-full min-h-0" : "min-h-0"}
          viewportClassName={isMobile ? "h-full overscroll-contain touch-pan-y" : "h-auto max-h-[min(26rem,calc(100dvh-12rem))] overscroll-contain touch-pan-y"}
          onRetry={() => void refreshNotifications()}
          emptyLabel={tab === "unread" ? "You’re all caught up." : "No notifications yet."}
          onOpen={handleOpenSelected}
          onToggleRead={(item) => { setActiveActionId(item.id); handleToggleRead(item) }}
          onRespond={(item, status) => { setActiveActionId(item.id); handleRespondToOrganizationAccessRequest(item, status) }}
        />
      </div>
    </>
  )

  if (isMobile) {
    return (
      <Drawer
        open={open}
        onOpenChange={handleMobileOpenChange}
        snapPoints={NOTIFICATIONS_MOBILE_SNAP_POINTS}
        activeSnapPoint={mobileSnapPoint}
        setActiveSnapPoint={setMobileSnapPoint}
        snapToSequentialPoint
        handleOnly
      >
        <DrawerContent
          id={contentId}
          onCloseAutoFocus={restoreFocus}
          className={cn(
            "h-[92dvh] max-h-[92dvh] rounded-t-3xl p-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]",
            "overscroll-contain touch-pan-y data-[vaul-drawer-direction=bottom]:mt-0 data-[vaul-drawer-direction=bottom]:max-h-[92dvh]",
          )}
        >
          <DrawerTitle className="sr-only">Notifications</DrawerTitle>
          <div className="flex min-h-0 flex-1 touch-pan-y flex-col overflow-hidden">
            {notificationsBody}
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverAnchor virtualRef={{ current: { getBoundingClientRect: () => trigger.current?.getBoundingClientRect() ?? new DOMRect() } }} />
      <PopoverContent
        id={contentId}
        onCloseAutoFocus={restoreFocus}
        onInteractOutside={(event) => {
          if (event.target instanceof Node && trigger.current?.contains(event.target)) event.preventDefault()
        }}
        align="end"
        aria-label="Notifications"
        className="w-[min(92vw,26rem)] overflow-hidden rounded-2xl p-0"
      >
        <div className="flex flex-col overflow-hidden">
          {notificationsBody}
        </div>
      </PopoverContent>
    </Popover>
  )
}
