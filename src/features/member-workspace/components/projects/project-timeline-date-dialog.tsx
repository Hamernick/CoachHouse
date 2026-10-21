"use client"
import { useId, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { TimelineDateChange } from "../../lib/project-timeline-types"
import { calendarDay } from "../../lib/project-timeline"

export type TimelineEditor = TimelineDateChange & {
  name: string
  error?: string
}
export function ProjectTimelineDateDialog({
  editor,
  saving,
  onClose,
  onSave,
}: {
  editor: TimelineEditor
  saving: boolean
  onClose: () => void
  onSave: (value: TimelineDateChange) => Promise<string | null>
}) {
  const id = useId()
  const [start, setStart] = useState(editor.startDate),
    [end, setEnd] = useState(editor.endDate)
  const [error, setError] = useState(editor.error ?? "")
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !saving) onClose()
      }}
    >
      <DialogContent
        className="sm:max-w-sm"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Timeline dates</DialogTitle>
          <DialogDescription>
            {editor.name}
            {editor.taskId ? "" : ". Task dates stay unchanged."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={async (event) => {
            event.preventDefault()
            if (saving) return
            if (
              (start && calendarDay(start) === null) ||
              (end && calendarDay(end) === null) ||
              (start && end && end < start)
            ) {
              setError(
                "Choose valid dates, with the due date on or after the start."
              )
              return
            }
            const result = await onSave({
              ...editor,
              startDate: start,
              endDate: end,
            })
            if (result) setError(result)
          }}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${id}-start`}>Start date (optional)</Label>
            <Input
              id={`${id}-start`}
              type="date"
              value={start}
              disabled={saving}
              onChange={(event) => setStart(event.currentTarget.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${id}-end`}>Due date (optional)</Label>
            <Input
              id={`${id}-end`}
              type="date"
              value={end}
              min={start || undefined}
              disabled={saving}
              onChange={(event) => setEnd(event.currentTarget.value)}
            />
          </div>
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              disabled={saving}
              onClick={onClose}
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
  )
}
