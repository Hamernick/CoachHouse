"use client"

import { ParticleFormPreview } from "./particle-form-preview"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ParticleCopyButton } from "./particle-copy-button"
import { ParticleTimerPreview } from "./particle-timer-preview"
import { MinusIcon, PlusIcon } from "./shapeshift-icons"
import type { ParticlePreviewProps } from "./particle-preview"
import { ParticleModuleNotesEditor } from "./particle-module-notes-editor"

export function ParticleWidgetPreview({
  particle,
  editable,
  onEdit,
  onOpen,
  onNotesDraftChange,
}: ParticlePreviewProps) {
  if (particle.type !== "activity" || !particle.data.widget) return null
  const widget = particle.data.widget
  if (widget.kind === "form")
    return <ParticleFormPreview definition={widget.definition} />
  if (widget.kind === "notes") {
    if (widget.source.kind === "module")
      return (
        <ParticleModuleNotesEditor
          key={widget.source.moduleId}
          moduleId={widget.source.moduleId}
          readOnly={!editable}
        />
      )
    if (onNotesDraftChange)
      return (
        <Textarea
          aria-label="Draft notes"
          placeholder="Write a note…"
          value={widget.source.content}
          maxLength={20_000}
          disabled={!editable}
          onChange={(event) => onNotesDraftChange(event.currentTarget.value)}
          className="nodrag nopan nowheel max-h-64 min-h-32 resize-none overflow-y-auto rounded-xl border-0 bg-transparent px-1 pt-3 pb-2 shadow-none dark:bg-transparent"
        />
      )
    return (
      <Button
        variant="ghost"
        onClick={() => onOpen()}
        aria-label={`Open ${particle.title}`}
        className="nodrag nopan nowheel h-auto min-h-32 w-full items-start justify-start overflow-y-auto rounded-xl px-1 pt-3 pb-2 text-left hover:bg-transparent"
      >
        <span className="text-muted-foreground line-clamp-12 w-full text-sm break-words whitespace-pre-wrap">
          {widget.source.content || "Write a note…"}
        </span>
      </Button>
    )
  }
  if (
    widget.kind === "image" ||
    widget.kind === "image_placeholder" ||
    widget.kind === "document"
  )
    return null
  const update = (next: typeof widget) =>
    onEdit({ ...particle, data: { ...particle.data, widget: next } })
  if (widget.kind === "timer")
    return (
      <ParticleTimerPreview
        widget={widget}
        editable={editable}
        onChange={update}
      />
    )
  if (widget.kind === "split") {
    const amount = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: widget.currency,
    }).format(widget.total / widget.people)
    return (
      <div className="flex flex-col gap-3">
        <strong className="text-2xl tabular-nums">{amount}</strong>
        <span className="text-muted-foreground text-xs">
          Per person · equal split
        </span>
        <div className="nodrag nopan flex items-center gap-2">
          <Button
            type="button"
            size="icon"
            variant="secondary"
            aria-label="One fewer person"
            disabled={!editable || widget.people <= 1}
            onClick={() => update({ ...widget, people: widget.people - 1 })}
          >
            <MinusIcon />
          </Button>
          <span className="min-w-16 text-center text-sm tabular-nums">
            {widget.people} people
          </span>
          <Button
            type="button"
            size="icon"
            variant="secondary"
            aria-label="One more person"
            disabled={!editable || widget.people >= 10000}
            onClick={() => update({ ...widget, people: widget.people + 1 })}
          >
            <PlusIcon />
          </Button>
        </div>
        <ParticleCopyButton
          text={`${amount} per person (${widget.people} people)`}
        />
      </div>
    )
  }
  if (widget.kind === "color")
    return (
      <div className="flex flex-col gap-3">
        <div className="nodrag nopan flex items-center gap-3">
          <Input
            key={widget.hex}
            type="color"
            aria-label="Choose color"
            defaultValue={widget.hex}
            disabled={!editable}
            className="size-14 cursor-pointer overflow-hidden rounded-xl p-0 shadow-none [&::-moz-color-swatch]:rounded-[inherit] [&::-moz-color-swatch]:border-0 [&::-webkit-color-swatch]:rounded-[inherit] [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:rounded-[inherit] [&::-webkit-color-swatch-wrapper]:p-0"
            onBlur={(event) => {
              if (event.currentTarget.value !== widget.hex)
                update({ ...widget, hex: event.currentTarget.value })
            }}
          />
          <span className="font-mono text-sm">{widget.hex.toUpperCase()}</span>
        </div>
        <ParticleCopyButton text={widget.hex.toUpperCase()} label="Copy hex" />
      </div>
    )
  if (widget.kind === "calculate")
    return (
      <div className="flex flex-col gap-3">
        <span className="text-muted-foreground text-sm break-words">
          {widget.expression}
        </span>
        <strong className="text-2xl tabular-nums">
          {widget.result.toLocaleString()}
        </strong>
        <ParticleCopyButton text={String(widget.result)} label="Copy result" />
      </div>
    )
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">
        {widget.startsAt
          ? new Date(widget.startsAt).toLocaleString()
          : "Date to be confirmed"}
      </p>
      {widget.startsAt && (
        <ParticleCopyButton
          text={`${particle.title}\n${new Date(widget.startsAt).toLocaleString()}`}
          label="Copy event"
        />
      )}
    </div>
  )
}
