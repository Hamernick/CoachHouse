"use client"
import { useEffect, useId, useState, type ReactNode } from "react"
import CalendarDaysIcon from "lucide-react/dist/esm/icons/calendar-days"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

import { calendarErrorMessage } from "../lib"
import { useGoogleCalendarController } from "../hooks/use-google-calendar-controller"
import { GoogleCalendarDialog } from "./google-calendar-dialog"

export function GoogleCalendarPanel({
  compact = false,
  brand,
  onConnectionChange,
}: {
  compact?: boolean
  brand?: ReactNode
  onConnectionChange?: (connected: boolean) => void
}) {
  const controller = useGoogleCalendarController()
  const { summary, pending, perform } = controller
  const [open, setOpen] = useState(false)
  const [callbackError, setCallbackError] = useState<string | null>(null)
  const switchId = useId()
  useEffect(() => {
    if (summary) onConnectionChange?.(summary.connected)
  }, [summary, onConnectionChange])
  useEffect(() => {
    if (compact) return
    const params = new URLSearchParams(window.location.search)
    const result = params.get("googleCalendar")
    if (!result) return
    setOpen(true)
    if (result !== "setup") setCallbackError(calendarErrorMessage(result))
  }, [compact])
  const status = !summary
    ? controller.error
      ? "Unavailable"
      : "Loading…"
    : !summary.configured
      ? "Unavailable"
      : summary.status === "reconnect_required"
        ? "Reconnect"
        : controller.error || summary.error
          ? "Needs attention"
          : summary.connected
            ? summary.enabled
              ? summary.syncing
                ? "Syncing…"
                : "Sync on"
              : "Sync off"
            : "Not connected"
  function onOpenChange(value: boolean) {
    setOpen(value)
    if (!value && !compact) {
      const url = new URL(window.location.href)
      url.searchParams.delete("googleCalendar")
      window.history.replaceState(window.history.state, "", url)
      setCallbackError(null)
    }
  }
  return (
    <div

      className={
        compact
          ? "flex flex-wrap items-center justify-between gap-2 pt-3"
          : "border-border/70 flex min-w-0 flex-col gap-3 rounded-xl border p-3"
      }
    >
      {compact ? (
        <>
          <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
            <CalendarDaysIcon data-icon="inline-start" aria-hidden />
            {summary?.connected
              ? "Manage Google Calendar"
              : "Connect Google Calendar"}
          </Button>
          {summary?.connected ? (
            <span className="text-muted-foreground text-xs" aria-live="polite">
              {status}
            </span>
          ) : null}
        </>
      ) : (
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {brand}
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <Label htmlFor={switchId} className="text-sm font-medium">
                Google Calendar
              </Label>
              <p className="text-muted-foreground truncate text-xs">
                {summary?.email ??
                  "Your calendar, alongside your board events."}
              </p>
              <p className="text-muted-foreground text-xs">
                Personal connection · Only you
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOpen(true)}
              aria-label="Manage Google Calendar"
            >
              Manage
            </Button>
            <Badge variant="secondary" aria-live="polite">
              {status}
            </Badge>
            <Switch
              id={switchId}
              aria-label="Google Calendar sync"
              checked={Boolean(summary?.enabled)}
              disabled={pending || (!summary && !controller.error)}
              onCheckedChange={(enabled) => {
                if (
                  !summary?.configured ||
                  !summary?.connected ||
                  (enabled &&
                    !summary.selectedCalendars.length &&
                    !summary.exportOrgId)
                )
                  setOpen(true)
                else void perform("enabled", { enabled })
              }}
            />
          </div>
        </div>
      )}
      <GoogleCalendarDialog
        open={open}
        onOpenChange={onOpenChange}
        controller={{ ...controller, error: callbackError ?? controller.error }}
      />
    </div>
  )
}
