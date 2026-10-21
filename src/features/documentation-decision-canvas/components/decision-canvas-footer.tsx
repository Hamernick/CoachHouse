"use client"

import type { ReactNode } from "react"
import ArrowRightIcon from "lucide-react/dist/esm/icons/arrow-right"
import { Button } from "@/components/ui/button"

import { cn } from "@/lib/utils"
import type { DocumentationDecisionStep } from "../types"
import { DecisionCanvasControls } from "./decision-canvas-controls"

export function DecisionCanvasFooter({
  steps,
  reviewed,
  disabled,
  list,
  onToggle,
  onSelect,
  editorActions,
}: {
  steps: DocumentationDecisionStep[]
  reviewed: string[]
  disabled: boolean
  list: boolean
  onToggle: () => void
  onSelect: (id: string, trigger: HTMLButtonElement) => void
  editorActions?: ReactNode
}) {
  const next =
    steps.find((step) => !reviewed.includes(step.id)) ?? steps[steps.length - 1]
  return (
    <footer
      data-decision-footer
      className="flex flex-wrap items-center justify-between gap-3 p-3 sm:px-5"

    >
      <div role="status" className="order-1 flex shrink-0 items-center gap-3">
        <span aria-hidden className="hidden gap-1 sm:flex">
          {steps.map((step) => (
            <span
              key={step.id}
              className={cn(
                "border-border bg-background size-2 rounded-full border",
                reviewed.includes(step.id) && "border-chart-2 bg-chart-2"
              )}
            />
          ))}
        </span>
        <p className="text-muted-foreground text-xs">
          <span className="text-foreground tabular-nums">
            {reviewed.length}/{steps.length}
          </span>{" "}
          steps reviewed
        </p>
      </div>
      {editorActions ? (
        <div className="order-2 w-full min-w-0 sm:w-auto sm:min-w-80">
          {editorActions}
        </div>
      ) : (
        <>
          <div className="order-3 flex basis-full justify-center lg:order-2 lg:basis-auto">
            <DecisionCanvasControls list={list} onToggle={onToggle} />
          </div>
          <Button
            data-canvas-start
            type="button"
            disabled={disabled}
            className="order-2 min-h-11 rounded-full px-4 lg:order-3"
            onClick={(event) => onSelect(next.id, event.currentTarget)}
          >
            {reviewed.length === steps.length
              ? "Open your plan"
              : reviewed.length
                ? "Continue planning"
                : "Start planning"}
            <ArrowRightIcon aria-hidden />
          </Button>
        </>
      )}
    </footer>
  )
}
