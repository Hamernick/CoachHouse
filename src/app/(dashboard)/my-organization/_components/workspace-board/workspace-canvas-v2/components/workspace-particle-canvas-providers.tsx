"use client"

import { useMemo, type ComponentProps } from "react"
import { useParticleFlow, ParticleLibraryDragProvider, ParticleTeamProvider } from "@/features/workspace-particles/client"
import { useObjectivePlanningAccess } from "@/features/workspace-objectives/client"
import { WorkspaceCanvasOverlayDrawerContainerProvider } from "./workspace-canvas-overlay-drawer-container"

export function WorkspaceParticleCanvasProviders({
  children,
  container,
  onPlaceParticle,
  workspaceId,
  canPlaceParticles,
  ...props
}: ComponentProps<typeof WorkspaceCanvasOverlayDrawerContainerProvider> & {
  onPlaceParticle: ComponentProps<typeof ParticleLibraryDragProvider>["onPlace"]
  workspaceId: string
  canPlaceParticles: boolean
}) {
  return (
    <ParticleLibraryDragProvider
      canvas={container}
      onPlace={onPlaceParticle}
      workspaceId={workspaceId}
      enabled={canPlaceParticles}
    >
      <WorkspaceCanvasOverlayDrawerContainerProvider
        container={container}
        {...props}
      >
        <ParticleTeamProvider workspaceId={workspaceId}>{children}</ParticleTeamProvider>
      </WorkspaceCanvasOverlayDrawerContainerProvider>
    </ParticleLibraryDragProvider>
  )
}

/** Application composition supplies the same checked actor to both feature surfaces. */
export function useWorkspaceParticleFlow({ nodes, ...input }: Parameters<typeof useParticleFlow>[0] & { userId: string; nodes: readonly { id: string; hidden?: boolean }[] }) {
  const visibleKey = nodes.filter(node => !node.hidden).map(node => node.id).join("\0")
  const visibleToolIds = useMemo(() => visibleKey ? visibleKey.split("\0") : [], [visibleKey])
  const planningAccess = useObjectivePlanningAccess({ userId: input.userId, organizationId: input.workspaceId })
  return useParticleFlow({ ...input, planningAccess, visibleToolIds })
}
