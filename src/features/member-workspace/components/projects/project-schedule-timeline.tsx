"use client"

import { useEffect, useId, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import type { TimeSummary } from "@/features/platform-admin-dashboard"
import { getProjectSchedule } from "../../lib/project-schedule"

export type UpdateScheduleAction = (
  id: string,
  startDate: string,
  endDate: string
) => Promise<{ ok: true; id: string } | { error: string }>

function formatDay(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`))
}

export function ProjectScheduleTimeline({
  projectId,
  time,
  onSave,
}: {
  projectId: string
  time: TimeSummary
  onSave?: UpdateScheduleAction
}) {
  const router = useRouter()
  const id = useId()
  const [now, setNow] = useState<Date | null>(null)
  const [open, setOpen] = useState(false)
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const refresh = () => {
      clearTimeout(timer)
      const current = new Date()
      setNow(current)
      const midnight = new Date(
        current.getFullYear(),
        current.getMonth(),
        current.getDate() + 1
      )
      timer = setTimeout(refresh, midnight.getTime() - current.getTime() + 100)
    }
    refresh()
    window.addEventListener("focus", refresh)
    document.addEventListener("visibilitychange", refresh)
    return () => {
      clearTimeout(timer)
      window.removeEventListener("focus", refresh)
      document.removeEventListener("visibilitychange", refresh)
    }
  }, [])
  const schedule = time.schedule
  const summary =
    schedule && now
      ? getProjectSchedule(schedule.startDate, schedule.endDate, now)
      : null
  const canEdit = Boolean(onSave && time.scheduleAvailable)

  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (!onSave || saving) return
    if (!getProjectSchedule(startDate, endDate)) {
      setError("Choose valid dates, with the due date on or after the start.")
      return
    }
    setSaving(true)
    setError(null)
    try {
      const result = await onSave(projectId, startDate, endDate)
      if ("error" in result) {
        setError(result.error)
        return
      }
      setOpen(false)
      router.refresh()
    } catch {
      setError("Could not save dates. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <section aria-label="Timeline" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-medium">Timeline</h3>
        {canEdit ? (
          <Dialog
            open={open}
            onOpenChange={(next) => {
              if (saving) return
              if (next) {
                setStartDate(schedule?.startDate ?? "")
                setEndDate(schedule?.endDate ?? "")
                setError(null)
              }
              setOpen(next)
            }}
          >
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm">
                {schedule ? "Edit dates" : "Set dates"}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>Timeline dates</DialogTitle>
                <DialogDescription>
                  Set the start and due date for this organization’s work.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={save} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor={`${id}-start`}>Start date</Label>
                  <Input
                    id={`${id}-start`}
                    type="date"
                    required
                    disabled={saving}
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${id}-end`}>Due date</Label>
                  <Input
                    id={`${id}-end`}
                    type="date"
                    required
                    min={startDate || undefined}
                    disabled={saving}
                    value={endDate}
                    onChange={(event) => setEndDate(event.target.value)}
                  />
                </div>
                {error ? (
                  <p role="alert" className="text-destructive text-sm">
                    {error}
                  </p>
                ) : null}
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={saving}
                    onClick={() => setOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? "Saving…" : "Save dates"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>
      {schedule && summary ? (
        <>
          <div className="text-muted-foreground flex justify-between gap-3 text-xs">
            <time dateTime={schedule.startDate}>
              {formatDay(schedule.startDate)}
            </time>
            <time dateTime={schedule.endDate}>
              {formatDay(schedule.endDate)}
            </time>
          </div>
          <Progress
            value={summary.progress}
            aria-label="Schedule elapsed"
            aria-valuetext={`${Math.round(summary.progress)}% of scheduled time elapsed`}
            className="h-1.5"
          />
          <p
            className={
              summary.overdue
                ? "text-destructive text-sm"
                : "text-muted-foreground text-sm"
            }
          >
            {summary.status}
          </p>
        </>
      ) : (
        <p className="text-muted-foreground text-sm">
          {schedule && !now ? "Loading timeline…" : "No dates set."}
        </p>
      )}
      {onSave && !time.scheduleAvailable ? (
        <p className="text-muted-foreground text-xs">
          Date editing is temporarily unavailable.
        </p>
      ) : null}
    </section>
  )
}
