"use client"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type WorkspaceCanvasEdgeContextMenuState = {
  x: number
  y: number
  edgeId: string
  sourceId: string
  targetId: string
  sourceTitle: string
  targetTitle: string
  sourceConnectionCount: number
  targetConnectionCount: number
}

type WorkspaceCanvasEdgeContextMenuProps = {
  state: WorkspaceCanvasEdgeContextMenuState
  onClose: () => void
  onDisconnectEdge: () => void
  onDisconnectFromSource: () => void
  onDisconnectToTarget: () => void
  onDisconnectAll: () => void
}

function menuSectionTitle(value: string) {
  return <p className="px-1 pb-1 text-[10px] font-semibold text-muted-foreground">{value}</p>
}

export function WorkspaceCanvasEdgeContextMenu({
  state,
  onClose,
  onDisconnectEdge,
  onDisconnectFromSource,
  onDisconnectToTarget,
  onDisconnectAll,
}: WorkspaceCanvasEdgeContextMenuProps) {
  return (
    <div
      className="fixed inset-0 z-50"
      onClick={onClose}
      onContextMenu={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      <div
        role="menu"
        aria-label="Connection context menu"
        className={cn(
          "absolute min-w-[250px] max-w-[320px] overflow-hidden rounded-xl canvas-glass border p-1",
          "max-h-[min(70vh,420px)] overflow-y-auto",
        )}
        style={{
          left: `${Math.max(8, state.x)}px`,
          top: `${Math.max(8, state.y)}px`,
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="space-y-1">
          {menuSectionTitle("Connection")}
          <p className="px-1 text-xs text-muted-foreground">
            {state.sourceTitle}
            {" -> "}
            {state.targetTitle}
          </p>
          <Button
            type="button"
            variant="ghost"
            className="w-full rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent/60"
            onClick={onDisconnectEdge}
          >
            Disconnect this link
          </Button>
        </div>

        <div className="mt-2 space-y-1">
          {menuSectionTitle("Batch")}
          <Button
            type="button"
            variant="ghost"
            className="w-full rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent/60"
            onClick={onDisconnectFromSource}
          >
            Disconnect all from {state.sourceTitle} ({state.sourceConnectionCount})
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent/60"
            onClick={onDisconnectToTarget}
          >
            Disconnect all into {state.targetTitle} ({state.targetConnectionCount})
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full rounded-md px-2 py-1.5 text-left text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={onDisconnectAll}
          >
            Disconnect all links
          </Button>
        </div>
      </div>
    </div>
  )
}
