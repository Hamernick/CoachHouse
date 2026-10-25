"use client"

import { useReactFlow } from "@xyflow/react"
import MaximizeIcon from "lucide-react/dist/esm/icons/maximize"
import MinusIcon from "lucide-react/dist/esm/icons/minus"
import PlusIcon from "lucide-react/dist/esm/icons/plus"
import ListIcon from "lucide-react/dist/esm/icons/list"
import WorkflowIcon from "lucide-react/dist/esm/icons/workflow"
import { Button } from "@/components/ui/button"

export function DecisionCanvasControls({
  list,
  onToggle,
}: {
  list: boolean
  onToggle: () => void
}) {
  const { fitView, zoomIn, zoomOut } = useReactFlow()
  return (
    <div
      role="group"
      aria-label="Canvas controls"
      className="border-border/60 bg-background/90 flex items-center gap-0.5 rounded-full border p-1 shadow-sm backdrop-blur-xl"
    >
      {!list && (
        <>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-11 rounded-full"
            aria-label="Zoom out"
            onClick={() => void zoomOut()}
          >
            <MinusIcon aria-hidden />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-11 rounded-full"
            aria-label="Zoom in"
            onClick={() => void zoomIn()}
          >
            <PlusIcon aria-hidden />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-11 rounded-full"
            aria-label="Fit all steps"
            onClick={() => void fitView({ padding: 0.25, maxZoom: 1.1 })}
          >
            <MaximizeIcon aria-hidden />
          </Button>
          <span aria-hidden className="bg-border mx-1 h-4 w-px" />
        </>
      )}
      <Button
        type="button"
        variant="ghost"
        className="min-h-11 rounded-full px-3 text-xs"
        onClick={onToggle}
      >
        {list ? <WorkflowIcon aria-hidden /> : <ListIcon aria-hidden />}
        {list ? "Canvas view" : "List view"}
      </Button>
    </div>
  )
}
