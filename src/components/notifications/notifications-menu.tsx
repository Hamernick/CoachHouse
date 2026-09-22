"use client"

import * as React from "react"
import Bell from "lucide-react/dist/esm/icons/bell"
import Loader2Icon from "lucide-react/dist/esm/icons/loader-2"

import { NotificationPreview } from "@/components/notifications/notification-preview"
import { NotificationsList } from "@/components/notifications/notifications-list"
import { useNotificationsMenuState } from "@/components/notifications/hooks/use-notifications-menu-state"
import { type NotificationItem } from "@/components/notifications/types"
import { useIsMobile } from "@/hooks/use-mobile"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Drawer, DrawerContent, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

const NOTIFICATIONS_MOBILE_SNAP_POINTS = [0.62, 0.92]
const NOTIFICATIONS_MOBILE_INITIAL_SNAP_POINT =
  NOTIFICATIONS_MOBILE_SNAP_POINTS[0]

const NotificationsBellButton = React.forwardRef<
  React.ElementRef<typeof Button>,
  React.ComponentProps<typeof Button> & {
    showBellUnreadCue: boolean
    labelClassName?: string
  }
>(function NotificationsBellButton(
  { showBellUnreadCue, className, labelClassName, ...props },
  ref,
) {
  return (
    <Button
      ref={ref}
      variant="ghost"
      size={labelClassName ? "default" : "icon"}
      className={cn("relative", className)}
      aria-label="Notifications"
      {...props}
    >
      <span className="relative inline-flex">
        <Bell className={labelClassName ? "size-5" : "size-4"} aria-hidden />
        {showBellUnreadCue ? (
          <span
            className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-sky-500 dark:bg-sky-400"
            aria-hidden
          />
        ) : null}
      </span>
      {labelClassName ? <span className={labelClassName}>Notifications</span> : null}
    </Button>
  )
})

export function NotificationsMenu({
  triggerClassName,
  labelClassName,
}: {
  triggerClassName?: string
  labelClassName?: string
} = {}) {
  const isMobile = useIsMobile()
  const [mobileSnapPoint, setMobileSnapPoint] = React.useState<
    number | string | null
  >(NOTIFICATIONS_MOBILE_INITIAL_SNAP_POINT)
  const [mobileDetailItemId, setMobileDetailItemId] = React.useState<
    string | null
  >(null)
  const {
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
  } = useNotificationsMenuState()

  const mobileDetailItem = React.useMemo(
    () =>
      mobileDetailItemId
        ? inboxItems.find((item) => item.id === mobileDetailItemId) ?? null
        : null,
    [inboxItems, mobileDetailItemId],
  )

  React.useEffect(() => {
    if (!mobileDetailItemId) return
    if (inboxItems.some((item) => item.id === mobileDetailItemId)) return

    setMobileDetailItemId(null)
  }, [inboxItems, mobileDetailItemId])

  const handleMobileOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      handleOpenChange(nextOpen)

      if (nextOpen) {
        setMobileSnapPoint(NOTIFICATIONS_MOBILE_INITIAL_SNAP_POINT)
        return
      }

      setMobileDetailItemId(null)
    },
    [handleOpenChange],
  )

  const handleMobileSelect = React.useCallback(
    (item: NotificationItem) => {
      handleSelect(item)
      setMobileDetailItemId(item.id)
      setMobileSnapPoint(NOTIFICATIONS_MOBILE_SNAP_POINTS[1])
    },
    [handleSelect],
  )

  const trigger = (
    <NotificationsBellButton
      showBellUnreadCue={showBellUnreadCue}
      className={triggerClassName}
      labelClassName={labelClassName}
      aria-expanded={open}
    />
  )

  if (!mounted) {
    return trigger
  }

  const notificationsHeader = (
    <div className="border-border/60 flex items-center justify-between border-b px-4 py-3">
      <div className="flex min-w-0 items-center gap-2">
        <p className="text-foreground truncate text-sm font-semibold">Notifications</p>
        <Badge variant="secondary" className="rounded-full">
          {inboxItems.length}
        </Badge>
        {unreadCount > 0 ? (
          <Badge variant="secondary" className="rounded-full">
            {unreadCount} unread
          </Badge>
        ) : null}
      </div>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => handleMarkAllRead()}
        disabled={bulkUpdating || unreadCount === 0}
        className="shrink-0"
      >
        {bulkUpdating ? (
          <Loader2Icon className="h-4 w-4 animate-spin" aria-hidden />
        ) : null}
        <span className="hidden sm:inline">Mark all read</span>
        <span className="sm:hidden">Mark read</span>
      </Button>
    </div>
  )

  const notificationsTabs = (
    <div className="border-border/60 border-b px-4 py-2">
      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as typeof tab)}
        className="w-fit"
      >
        <TabsList className="inline-flex h-8 w-fit max-w-full items-center self-start rounded-full border border-border/50 bg-muted px-1 py-0.5">
          <TabsTrigger
            value="all"
            className="h-7 rounded-full px-3 text-xs data-[state=active]:bg-background"
          >
            All
          </TabsTrigger>
          <TabsTrigger
            value="unread"
            className="h-7 rounded-full px-3 text-xs data-[state=active]:bg-background"
          >
            Unread
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  )

  const desktopNotificationsBody = (
    <>
      {notificationsHeader}
      {notificationsTabs}

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div className="min-h-0 flex-1 md:max-w-[20rem] md:basis-[20rem]">
          <NotificationsList
            items={filteredItems}
            selectedId={selectedId}
            loading={loading}
            error={loadError}
            className="h-full min-h-0 max-h-none"
            viewportClassName="h-full overscroll-contain touch-pan-y"
            onRetry={() => void refreshNotifications()}
            emptyLabel={
              tab === "unread" ? "No unread notifications." : "Inbox is empty."
            }
            onSelect={handleSelect}
          />
        </div>
        <NotificationPreview
          item={selectedItem}
          loading={loading}
          updating={selectedUpdating}
          requestUpdating={requestUpdating}
          onOpen={handleOpenSelected}
          onToggleRead={handleToggleRead}
          onRespondToOrganizationAccessRequest={
            handleRespondToOrganizationAccessRequest
          }
        />
      </div>
    </>
  )

  const mobileNotificationsBody = (
    <>
      {notificationsHeader}
      {mobileDetailItem ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="border-border/60 flex shrink-0 items-center border-b px-4 py-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="-ml-2 h-8 px-2"
              onClick={() => setMobileDetailItemId(null)}
            >
              Back
            </Button>
          </div>
          <NotificationPreview
            item={mobileDetailItem}
            loading={loading}
            updating={selectedUpdating}
            requestUpdating={requestUpdating}
            className="min-h-0 max-h-none flex-1 border-t-0 md:border-l-0"
            onOpen={handleOpenSelected}
            onToggleRead={handleToggleRead}
            onRespondToOrganizationAccessRequest={
              handleRespondToOrganizationAccessRequest
            }
          />
        </div>
      ) : (
        <>
          {notificationsTabs}
          <div className="min-h-0 flex-1 overflow-hidden">
            <NotificationsList
              items={filteredItems}
              selectedId={selectedId}
              loading={loading}
              error={loadError}
              className="h-full min-h-0 max-h-none"
              viewportClassName="h-full overscroll-contain touch-pan-y"
              onRetry={() => void refreshNotifications()}
              emptyLabel={
                tab === "unread" ? "No unread notifications." : "Inbox is empty."
              }
              onSelect={handleMobileSelect}
            />
          </div>
        </>
      )}
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
        <DrawerTrigger asChild>
          {trigger}
        </DrawerTrigger>
        <DrawerContent
          className={cn(
            "h-[92dvh] max-h-[92dvh] rounded-t-3xl p-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]",
            "overscroll-contain touch-pan-y data-[vaul-drawer-direction=bottom]:mt-0 data-[vaul-drawer-direction=bottom]:max-h-[92dvh]",
          )}
        >
          <DrawerTitle className="sr-only">Notifications</DrawerTitle>
          <div className="flex min-h-0 flex-1 touch-pan-y flex-col overflow-hidden">
            {mobileNotificationsBody}
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        {trigger}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[min(92vw,42rem)] p-0"
      >
        <div className="flex max-h-[min(72vh,34rem)] min-h-[24rem] flex-col overflow-hidden">
          {desktopNotificationsBody}
        </div>
      </PopoverContent>
    </Popover>
  )
}
