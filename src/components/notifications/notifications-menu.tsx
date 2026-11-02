"use client"

import * as React from "react"
import { useNotificationsMenuState } from "./hooks/use-notifications-menu-state"
import { NotificationsBellButton } from "./notifications-bell-button"
import { useIsMobile } from "@/hooks/use-mobile"
import { toast } from "@/lib/toast"
import type { NotificationsMenuOverlay } from "./notifications-menu-overlay"

export function NotificationsMenu() {
  const state = useNotificationsMenuState()
  const isMobile = useIsMobile()
  const trigger = React.useRef<HTMLButtonElement>(null)
  const contentId = React.useId()
  const [Overlay, setOverlay] = React.useState<typeof NotificationsMenuOverlay | null>(null)
  const [failed, setFailed] = React.useState(false)
  const pending = React.useRef<Promise<void> | null>(null)
  const alive = React.useRef(true)
  React.useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  const load = React.useCallback(() => {
    if (Overlay || pending.current) return
    setFailed(false)
    pending.current = import("./notifications-menu-overlay").then((module) => {
      if (alive.current) setOverlay(() => module.NotificationsMenuOverlay)
    }).catch(() => {
      if (alive.current) {
        setFailed(true)
        toast.error("Unable to load notifications. Try again.")
      }
    }).finally(() => { pending.current = null })
  }, [Overlay])
  const opening = state.open && !Overlay && !failed

  return <>
    <NotificationsBellButton ref={trigger} unreadCount={state.unreadCount}
      aria-haspopup="dialog" aria-expanded={state.open} aria-controls={Overlay ? contentId : undefined}
      aria-busy={opening || undefined}
      onPointerEnter={load} onFocus={load}
      onClick={() => { load(); state.handleOpenChange(failed || !state.open) }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && state.open && !Overlay) {
          event.preventDefault(); state.handleOpenChange(false)
        }
      }} />
    {opening ? <span role="status" className="sr-only">Loading notifications…</span> : null}
    {failed && state.open ? <span role="alert" className="sr-only">Unable to load notifications. Activate Notifications to retry.</span> : null}
    {Overlay ? <Overlay state={state} isMobile={isMobile} trigger={trigger} contentId={contentId} /> : null}
  </>
}
