"use client"

import BellIcon from "lucide-react/dist/esm/icons/bell"
import MailIcon from "lucide-react/dist/esm/icons/mail"
import MailOpenIcon from "lucide-react/dist/esm/icons/mail-open"
import Loader2Icon from "lucide-react/dist/esm/icons/loader-2"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Empty } from "@/components/ui/empty"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { NotificationToneIcon } from "./notification-tone-icon"
import type { NotificationItem } from "./types"

type NotificationsListProps = {
  items: NotificationItem[]
  loading: boolean
  error: string | null
  updating: boolean
  activeActionId: string | null
  requestUpdating: "accepted" | "declined" | null
  className?: string
  viewportClassName?: string
  onRetry: () => void
  emptyLabel?: string
  onOpen: (item: NotificationItem) => void
  onToggleRead: (item: NotificationItem) => void
  onRespond: (item: NotificationItem, status: "accepted" | "declined") => void
}

export function NotificationsList({ items, loading, error, updating, activeActionId, requestUpdating, className, viewportClassName, onRetry, emptyLabel = "No notifications yet.", onOpen, onToggleRead, onRespond }: NotificationsListProps) {
  return (
    <ScrollArea className={cn("overflow-hidden", className)} viewportClassName={viewportClassName}>
      {loading ? <div aria-busy="true" aria-label="Loading notifications" className="flex flex-col gap-1 p-2">
        {Array.from({ length: 4 }, (_, index) => <div key={index} className="flex items-start gap-3 rounded-xl p-3">
          <Skeleton className="size-9 shrink-0 rounded-xl" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-16" />
          </div>
        </div>)}
      </div> : error ? <Empty size="sm" variant="subtle" className="m-2 border-0 shadow-none" role="alert"
        description="Unable to load notifications." actions={<Button type="button" size="sm" variant="outline" onClick={onRetry}>Retry</Button>} />
      : items.length === 0 ? <Empty size="sm" variant="subtle" className="m-2 border-0 shadow-none" role="status" icon={<BellIcon aria-hidden="true" className="size-5" />} description={emptyLabel} />
      : <ul aria-label="Notifications" className="flex flex-col gap-1 p-2 pt-0">
        {items.map(item => {
          const active = activeActionId === item.id
          const text = <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className={cn("text-sm leading-5 break-words", item.unread ? "font-semibold text-foreground" : "font-medium text-foreground/80")}>
              {item.title}<span className="sr-only">{item.unread ? ", unread" : ", read"}</span>
            </span>
            <span className="text-sm leading-5 whitespace-pre-wrap break-words font-normal text-muted-foreground">{item.description}</span>
            <span className="mt-0.5 text-xs font-normal text-muted-foreground">{item.time}</span>
          </span>
          return <li key={item.id} className={cn("rounded-xl p-3 transition-colors", item.unread ? "bg-muted/60 hover:bg-muted" : "hover:bg-muted/40")}>
            <div className="flex items-start gap-3">
              <NotificationToneIcon tone={item.tone} />
              {item.href ? <Button type="button" variant="ghost" disabled={updating} onClick={() => onOpen(item)}
                className="h-auto min-w-0 flex-1 items-start justify-start rounded-md p-0 text-left whitespace-normal hover:bg-transparent">
                {text}
              </Button> : text}
              <Button type="button" variant="ghost" size="icon" disabled={updating}
                className="-mt-1 -mr-1 shrink-0 rounded-lg text-muted-foreground"
                aria-label={`${item.unread ? "Mark as read" : "Mark as unread"}: ${item.title}`}
                title={item.unread ? "Mark as read" : "Mark as unread"} onClick={() => onToggleRead(item)}>
                {active && updating && !requestUpdating ? <Loader2Icon aria-hidden="true" className="motion-safe:animate-spin" />
                  : item.unread ? <MailOpenIcon aria-hidden="true" /> : <MailIcon aria-hidden="true" />}
              </Button>
            </div>
            {item.organizationAccessRequestId ? <div className="mt-3 flex flex-wrap justify-end gap-2">
              <Button type="button" size="sm" variant="outline" className="rounded-full" disabled={updating} onClick={() => onRespond(item, "declined")}>
                {active && requestUpdating === "declined" ? <Loader2Icon aria-hidden="true" className="motion-safe:animate-spin" /> : null}Decline
              </Button>
              <Button type="button" size="sm" className="rounded-full" disabled={updating} onClick={() => onRespond(item, "accepted")}>
                {active && requestUpdating === "accepted" ? <Loader2Icon aria-hidden="true" className="motion-safe:animate-spin" /> : null}Accept access
              </Button>
            </div> : null}
          </li>
        })}
      </ul>}
    </ScrollArea>
  )
}
