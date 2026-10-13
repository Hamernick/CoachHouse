import { isWorkspaceToolId } from "@/features/workspace-particles/client"
import type { useParticleFlow } from "@/features/workspace-particles/client"
import type { WorkspaceCanvasSurfaceV2ViewProps } from "./workspace-canvas-surface-v2-view-types"

type Legacy = Pick<
  WorkspaceCanvasSurfaceV2ViewProps,
  "onConnect" | "isValidConnection" | "onEdgeDoubleClick" | "onEdgeContextMenu"
>
export function createWorkspaceParticleConnectionHandlers(
  particles: Pick<
    ReturnType<typeof useParticleFlow>,
    "ids" | "connections" | "select"
  >,
  legacy: Legacy,
  openMenu?: (id: string, x: number, y: number) => void
): Legacy {
  const kind = (source: string, target: string) => {
    const from = particles.ids.has(source),
      to = particles.ids.has(target)
    return (from && (to || isWorkspaceToolId(target))) ||
      (to && isWorkspaceToolId(source))
      ? "particle"
      : from || to
        ? "mixed"
        : "legacy"
  }
  return {
    onConnect: (connection) => {
      const owner = kind(connection.source, connection.target)
      if (owner === "particle") void particles.connections.connect(connection)
      else if (owner === "legacy") legacy.onConnect(connection)
    },
    isValidConnection: (connection) => {
      const owner = kind(connection.source, connection.target)
      return owner === "particle"
        ? particles.connections.valid(connection)
        : owner === "legacy" && legacy.isValidConnection(connection)
    },
    onEdgeDoubleClick: (event, edge) => {
      if (kind(edge.source, edge.target) === "particle") {
        event.stopPropagation()
        particles.select(
          particles.ids.has(edge.source) ? edge.source : edge.target
        )
      } else if (kind(edge.source, edge.target) === "legacy")
        legacy.onEdgeDoubleClick(event, edge)
    },
    onEdgeContextMenu: (event, edge) => {
      if (kind(edge.source, edge.target) === "particle") {
        event.preventDefault()
        event.stopPropagation()
        if (openMenu) openMenu(edge.id, event.clientX, event.clientY)
        else
          particles.select(
            particles.ids.has(edge.source) ? edge.source : edge.target
          )
      } else if (kind(edge.source, edge.target) === "legacy")
        legacy.onEdgeContextMenu(event, edge)
    },
  }
}
