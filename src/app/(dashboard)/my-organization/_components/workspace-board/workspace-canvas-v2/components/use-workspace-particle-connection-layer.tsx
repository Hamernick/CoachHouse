"use client"

import { useMemo, useState } from "react"
import {
  ParticleConnectionMenu,
  type ParticleConnectionMenuState,
  type useParticleFlow,
} from "@/features/workspace-particles/client"
import { createWorkspaceParticleConnectionHandlers } from "./workspace-particle-connection-handlers"

export function useWorkspaceParticleConnectionLayer(
  particles: ReturnType<typeof useParticleFlow>,
  legacy: Parameters<typeof createWorkspaceParticleConnectionHandlers>[1],
  closeLegacyMenu: () => void
) {
  const [menu, setMenu] = useState<
    (ParticleConnectionMenuState & { workspaceId: string }) | null
  >(null)
  const { ids, connections, select, graph } = particles
  const { onConnect, isValidConnection, onEdgeDoubleClick, onEdgeContextMenu } =
    legacy
  const workspaceId = graph?.workspaceId
  const handlers = useMemo(
    () =>
      createWorkspaceParticleConnectionHandlers(
        { ids, connections, select },
        { onConnect, isValidConnection, onEdgeDoubleClick, onEdgeContextMenu },
        (id, x, y) => {
          closeLegacyMenu()
          if (workspaceId) setMenu({ id, x, y, workspaceId })
        }
      ),
    [
      ids,
      connections,
      select,
      onConnect,
      isValidConnection,
      onEdgeDoubleClick,
      onEdgeContextMenu,
      closeLegacyMenu,
      workspaceId,
    ]
  )
  return {
    handlers,
    menu: (
      <ParticleConnectionMenu
        preview={particles.connections.preview}
        state={menu?.workspaceId === particles.graph?.workspaceId ? menu : null}
        graph={particles.graph}
        editable={particles.editable}
        onClose={() => setMenu(null)}
        onDisconnect={particles.connections.disconnect}
      />
    ),
  }
}
