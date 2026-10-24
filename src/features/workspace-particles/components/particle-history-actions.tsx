"use client"

import UndoIcon from "lucide-react/dist/esm/icons/undo-2"
import RedoIcon from "lucide-react/dist/esm/icons/redo-2"
import { Button } from "@/components/ui/button"

import type { useParticleHistoryControls } from "../hooks/use-particle-history-controls"

export function ParticleHistoryActions({
  history,
  disabled,
}: {
  history: ReturnType<typeof useParticleHistoryControls>
  disabled: boolean
}) {
  return (
    <div
      className="nodrag nopan flex flex-col gap-1 border-t px-2 py-2"
      role="group"
      aria-label="Particle history"
    >
      {(["undo", "redo"] as const).map((direction) => {
        const label =
          direction === "undo" ? history.undoLabel : history.redoLabel
        const Icon = direction === "undo" ? UndoIcon : RedoIcon
        return (
          <Button
            key={direction}
            type="button"
            variant="ghost"
            className="h-11 justify-start rounded-xl px-3"
            disabled={disabled || history.busy || !label}
            onClick={() => void history[direction]()}

          >
            <Icon aria-hidden className="size-4" />
            {direction === "undo" ? "Undo" : "Redo"}
            {label ? ` ${label}` : ""}
          </Button>
        )
      })}
      {history.message ? (
        <p
          role="status"
          className="text-muted-foreground max-w-64 px-3 text-xs"
        >
          {history.message}
        </p>
      ) : null}
    </div>
  )
}
