import { getReactGrabLinkedSurfaceProps } from "@/components/dev/react-grab-surface"

export const WORKSPACE_PARTICLES_OWNER_ID = "workspace:particles"
export const WORKSPACE_PARTICLES_PANEL_SOURCE =
  "src/features/workspace-particles/components/workspace-particles-panel.tsx"
export const WORKSPACE_PARTICLES_PANEL_COMPONENT = "WorkspaceParticlesPanel"

export function workspaceParticleSurfaceProps({
  component,
  source,
  slot,
  surfaceKind = "content",
}: {
  component: string
  source: string
  slot: string
  surfaceKind?: "trigger" | "content" | "root"
}) {
  return getReactGrabLinkedSurfaceProps({
    ownerId: WORKSPACE_PARTICLES_OWNER_ID,
    component,
    source,
    slot,
    surfaceKind,
    canonicalOwnerSource: WORKSPACE_PARTICLES_PANEL_SOURCE,
    canonicalOwnerReason:
      "WorkspaceParticlesPanel owns its header, action controls, filters, search, and particle catalog layout.",
  })
}
