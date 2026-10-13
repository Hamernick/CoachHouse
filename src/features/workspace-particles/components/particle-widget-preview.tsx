"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import type { ParticlePreviewProps } from "./particle-preview"

export function ParticleWidgetPreview({
  particle,
  editable,
  onEdit,
}: ParticlePreviewProps) {
  const [now, setNow] = useState<number | null>(null)
  const widget = particle.type === "activity" ? particle.data.widget : undefined
  const endsAt = widget?.kind === "timer" ? widget.endsAt : null
  useEffect(() => {
    if (!endsAt) return
    const tick = () => setNow(Date.now())
    tick()
    if (Date.parse(endsAt) <= Date.now()) return
    const timer = setInterval(() => {
      tick()
      if (Date.parse(endsAt) <= Date.now()) clearInterval(timer)
    }, 1000)
    return () => clearInterval(timer)
  }, [endsAt])
  if (!widget || particle.type !== "activity") return null
  if (widget.kind === "timer") {
    const seconds =
      widget.endsAt && now !== null
        ? Math.max(0, Math.ceil((Date.parse(widget.endsAt) - now) / 1000))
        : widget.seconds
    return (
      <div className="flex items-center justify-between gap-3">
        <span
          className="text-3xl font-medium tabular-nums"
          aria-label={`${seconds} seconds remaining`}
        >
          {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
        </span>
        <Button
          size="sm"
          variant="secondary"
          className="nodrag nopan rounded-full"
          disabled={!editable}
          onClick={() =>
            onEdit({
              ...particle,
              data: {
                ...particle.data,
                widget: {
                  ...widget,
                  endsAt: widget.endsAt
                    ? null
                    : new Date(
                        Date.now() + widget.seconds * 1000
                      ).toISOString(),
                },
              },
            })
          }
        >
          {widget.endsAt ? "Reset" : "Start"}
        </Button>
      </div>
    )
  }
  if (widget.kind === "split")
    return (
      <div className="flex flex-col gap-1">
        <strong className="text-2xl tabular-nums">
          {new Intl.NumberFormat(undefined, {
            style: "currency",
            currency: widget.currency,
          }).format(widget.total / widget.people)}
        </strong>
        <span className="text-muted-foreground text-xs">
          Per person · {widget.people} people · equal split
        </span>
      </div>
    )
  if (widget.kind === "color")
    return (
      <div className="flex items-center gap-3">
        <span
          className="border-border size-14 rounded-xl border"
          style={{ backgroundColor: widget.hex }}
          aria-hidden
        />
        <span className="font-mono text-sm">{widget.hex.toUpperCase()}</span>
      </div>
    )
  if (widget.kind === "calculate")
    return (
      <div className="flex flex-col gap-1">
        <span className="text-muted-foreground text-sm break-words">
          {widget.expression}
        </span>
        <strong className="text-2xl tabular-nums">
          {widget.result.toLocaleString()}
        </strong>
      </div>
    )
  return (
    <p className="text-sm">
      {widget.startsAt
        ? new Date(widget.startsAt).toLocaleString()
        : "Date to be confirmed"}
    </p>
  )
}
