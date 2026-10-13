"use client"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { getReactGrabOwnerProps } from "@/components/dev/react-grab-surface"
import { particleConnectionMenuItems } from "../lib/connection-menu"
import { withPendingParticleConnection } from "../lib/particle-flow-adapters"
import type { ParticleConnection, ParticleGraph } from "../types"

export type ParticleConnectionMenuState = { id: string; x: number; y: number }
export function ParticleConnectionMenu({
  state,
  graph,
  editable,
  onClose,
  onDisconnect,
  preview = null,
}: {
  preview?: ParticleConnection | null
  state: ParticleConnectionMenuState | null
  graph: ParticleGraph | null
  editable: boolean
  onClose: () => void
  onDisconnect: (id: string, revision: number) => Promise<boolean>
}) {
  if (!state || !graph) return null
  const items = particleConnectionMenuItems(
    withPendingParticleConnection(graph, preview),
    state.id
  )
  if (!items.length) return null
  return (
    <DropdownMenu
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      modal={false}
    >
      <DropdownMenuTrigger asChild>
        <Button
          aria-label="Connection actions"
          tabIndex={-1}
          variant="ghost"
          className="pointer-events-none fixed size-px min-h-0 p-0 opacity-0"
          style={{ left: state.x, top: state.y }}
          {...getReactGrabOwnerProps({
            ownerId: "workspace-particle:connection-menu",
            component: "ParticleConnectionMenu",
            source:
              "src/features/workspace-particles/components/particle-connection-menu.tsx",
            slot: "trigger",
            primitiveImport: "@/components/ui/button",
          })}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side="bottom"
        collisionPadding={12}
        className="nodrag nopan nowheel w-80 max-w-[calc(100vw-24px)] rounded-2xl p-2 shadow-none motion-reduce:animate-none"
        aria-label="Disconnect a connection"
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          const edge = graph.connections.find((item) => item.id === state.id)
          if (edge)
            document
              .querySelector<HTMLElement>(
                `.react-flow__node[data-id="${edge.source}"]`
              )
              ?.focus({ preventScroll: true })
        }}
      >
        <DropdownMenuLabel>
          {preview?.id === state.id
            ? "Saving connection…"
            : "Disconnect connection"}
        </DropdownMenuLabel>
        {items.map((item, index) => (
          <div key={item.id}>
            {index === 1 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
                  Other connections on these cards
                </DropdownMenuLabel>
              </>
            )}
            <DropdownMenuItem
              disabled={!editable}
              className="min-h-11 flex-col items-start gap-0.5 rounded-lg py-2"
              aria-label={`Disconnect ${item.label}: ${item.detail}`}
              onSelect={() => {
                void onDisconnect(item.id, item.revision)
                onClose()
              }}
            >
              <span className="w-full text-sm break-words whitespace-normal">
                {item.label}
              </span>
              <span className="text-muted-foreground text-xs">
                {item.detail}
                {item.clicked ? " · Selected connection" : ""}
              </span>
            </DropdownMenuItem>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
