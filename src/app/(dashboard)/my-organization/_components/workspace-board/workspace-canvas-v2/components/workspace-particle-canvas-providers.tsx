"use client"

import type { ComponentProps } from "react"
import { ParticleLibraryDragProvider } from "@/features/workspace-particles/client"
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
        {children}
      </WorkspaceCanvasOverlayDrawerContainerProvider>
    </ParticleLibraryDragProvider>
  )
}
