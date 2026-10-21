"use client"

import { memo } from "react"
import {
  ParticleDiscardDialog,
  particleInspectorMaxWidth,
  type ParticleLibraryTool,
  type useParticleFlow,
} from "@/features/workspace-particles/client"
import { WorkspaceCanvasOverlayDrawer } from "./workspace-canvas-overlay-drawer"
import type { WorkspaceOverlayDrawerProps } from "./workspace-overlay-drawer-props"
import {
  WorkspaceParticleComposerSlot,
  WorkspaceParticleInspectorSlot,
  WorkspaceParticleLibrarySlot,
} from "./workspace-particle-dock-content"

type Props = WorkspaceOverlayDrawerProps & {
  particles: ReturnType<typeof useParticleFlow>["controls"]
  tools: ParticleLibraryTool[]
  tutorialActive: boolean
}

// Position-only canvas changes must not rerender retained editors or previews.
export const WorkspaceParticleDock = memo(function WorkspaceParticleDock({
  particles,
  tools,
  tutorialActive,
  ...props
}: Props) {
  return (
    <>
    <ParticleDiscardDialog guard={particles.closeGuard} />
    <WorkspaceCanvasOverlayDrawer
      {...props}
      particleSelectionId={particles.selectedId}
      particleSelectionKey={particles.selectionRequest}
      particleInspectorTitle={particles.inspectorView === "share" ? "Share page" : particles.selected?.title}
      particleInspectorMaxWidth={
        particles.inspectorView === "share" ? 720 : particles.selected
          ? particleInspectorMaxWidth(particles.selected)
          : undefined
      }
      particleInspector={
        particles.selected ? (
          <WorkspaceParticleInspectorSlot session={particles} />
        ) : null
      }
      onCloseParticleInspector={particles.closeGuard.request}
      particleLibrary={
        <WorkspaceParticleLibrarySlot
          session={particles}
          tools={tools}
          canEdit={props.canEdit}
        />
      }
      particleComposer={
        !tutorialActive ? (
          <WorkspaceParticleComposerSlot session={particles} />
        ) : null
      }
    />
    </>
  )
})
