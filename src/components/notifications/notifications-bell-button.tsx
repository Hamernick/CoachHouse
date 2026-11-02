"use client"

import * as React from "react"
import Bell from "lucide-react/dist/esm/icons/bell"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { BadgeCounter } from "@/components/ui/badge-counter"

function NotificationCount({ count }: { count: number }) {
  const [AnimatedBadge, setAnimatedBadge] = React.useState<typeof BadgeCounter | null>(null)
  React.useEffect(() => {
    if (count <= 0 || AnimatedBadge) return
    let active = true
    void import("@/components/ui/badge-counter").then(module => {
      if (active) setAnimatedBadge(() => module.BadgeCounter)
    }).catch(() => { /* Keep the current static count if optional animation cannot load. */ })
    return () => { active = false }
  }, [count, AnimatedBadge])
  // Once loaded, retain the same badge instance through zero for its exit motion.
  if (AnimatedBadge) return <AnimatedBadge count={count} />
  if (count <= 0) return null
  return <span aria-hidden className="pointer-events-none absolute inset-0">
    <span className="absolute -top-1 right-[-4px] origin-bottom-left">
      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[12px] leading-5 font-semibold text-background tabular-nums ring-2 ring-background">
        {count > 99 ? "99+" : count}
      </span>
    </span>
  </span>
}

export const NotificationsBellButton = React.forwardRef<
  React.ElementRef<typeof Button>, React.ComponentProps<typeof Button> & { unreadCount: number }
>(function NotificationsBellButton({ unreadCount, className, ...props }, ref) {
  return <Button ref={ref} variant="ghost" size="icon" className={cn("relative", className)}
    aria-label="Notifications" aria-description={`${unreadCount} unread notifications`} {...props}>
    <Bell className="h-4 w-4" />
    <NotificationCount count={unreadCount} />
    <span className="sr-only" aria-live="polite" aria-atomic>{unreadCount} unread notifications</span>
  </Button>
})
