import type { z } from "zod"
import type { particleWidgetSchema } from "./particle-widget-schema"

export type TimerWidget = Extract<
  z.infer<typeof particleWidgetSchema>,
  { kind: "timer" }
>

export function timerRemaining(widget: TimerWidget, now: number) {
  return widget.endsAt
    ? Math.max(
        0,
        Math.min(
          widget.seconds,
          Math.ceil((Date.parse(widget.endsAt) - now) / 1000)
        )
      )
    : Math.min(widget.seconds, widget.remainingSeconds ?? widget.seconds)
}

export function changeTimer(
  widget: TimerWidget,
  action: "start" | "pause" | "reset",
  now: number
): TimerWidget {
  if (action === "reset")
    return { ...widget, endsAt: null, remainingSeconds: widget.seconds }
  const left = timerRemaining(widget, now)
  if (action === "pause")
    return { ...widget, endsAt: null, remainingSeconds: left }
  if (!left) return widget
  return {
    ...widget,
    remainingSeconds: left,
    endsAt: new Date(now + left * 1000).toISOString(),
  }
}
