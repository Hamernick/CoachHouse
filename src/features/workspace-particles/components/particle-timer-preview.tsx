"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { useMediaActivity } from "@/components/media/media-activity"
import {
  changeTimer,
  timerRemaining,
  type TimerWidget,
} from "../lib/particle-timer"
import { PauseIcon, PlayIcon, ResetIcon } from "./shapeshift-icons"

export function ParticleTimerPreview({
  widget,
  editable,
  onChange,
}: {
  widget: TimerWidget
  editable: boolean
  onChange: (widget: TimerWidget) => void
}) {
  const active = useMediaActivity()
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    const endsAt = widget.endsAt
    if (!active || !endsAt) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const refresh = () => {
      clearTimeout(timer)
      if (document.visibilityState === "hidden") return
      const timestamp = Date.now()
      setNow(timestamp)
      const remaining = Date.parse(endsAt) - timestamp
      // The display changes once per second. Recompute from the deadline when
      // shown again; hidden panels/tabs need no background countdown work.
      if (remaining > 0) timer = setTimeout(refresh, Math.min(1000, remaining))
    }
    refresh()
    document.addEventListener("visibilitychange", refresh)
    return () => {
      clearTimeout(timer)
      document.removeEventListener("visibilitychange", refresh)
    }
  }, [active, widget.endsAt])
  const left =
    now === null
      ? (widget.remainingSeconds ?? widget.seconds)
      : timerRemaining(widget, now)
  const running = Boolean(widget.endsAt) && left > 0
  const circumference = 2 * Math.PI * 34
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div
        className="relative size-20 shrink-0"
        role="timer"
        aria-label={`${left} seconds remaining`}
      >
        <svg
          viewBox="0 0 80 80"
          className="size-full -rotate-90"
          fill="none"
          strokeWidth="4"
          aria-hidden="true"
        >
          <circle cx="40" cy="40" r="34" className="stroke-muted" />
          <circle
            cx="40"
            cy="40"
            r="34"
            className="stroke-primary"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - left / widget.seconds)}
          />
        </svg>
        <span className="absolute inset-0 grid place-items-center text-sm font-medium tabular-nums">
          {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
        </span>
      </div>
      <div className="nodrag nopan flex flex-wrap items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Reset timer"
          disabled={!editable}
          onClick={() => onChange(changeTimer(widget, "reset", Date.now()))}
        >
          <ResetIcon />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={!editable || left === 0}
          onClick={() =>
            onChange(
              changeTimer(widget, running ? "pause" : "start", Date.now())
            )
          }
        >
          {running ? (
            <PauseIcon data-icon="inline-start" />
          ) : (
            <PlayIcon data-icon="inline-start" />
          )}
          {running ? "Pause" : left < widget.seconds ? "Resume" : "Start"}
        </Button>
      </div>
      {left === 0 && (
        <span role="status" className="text-sm">
          Time’s up
        </span>
      )}
    </div>
  )
}
