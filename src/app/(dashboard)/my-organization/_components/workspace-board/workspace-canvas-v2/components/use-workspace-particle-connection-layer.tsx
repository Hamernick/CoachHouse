"use client"

import { useState } from "react"
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
  return {
    handlers: createWorkspaceParticleConnectionHandlers(
      particles,
      legacy,
      (id, x, y) => {
        closeLegacyMenu()
        if (particles.graph)
          setMenu({ id, x, y, workspaceId: particles.graph.workspaceId })
      }
    ),
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
