import {
  normalizeWorkspaceParticleState,
  preferNewerParticleState,
  type WorkspaceParticleState,
} from "@/features/workspace-particles/client"
import type { WorkspaceBoardForwardCompatibilityState } from "./workspace-board-types"

const RECOVERY_ID = "workspace-particles-state-v1"

export function resolveWorkspaceBoardParticleState(
  input: WorkspaceParticleState | undefined,
  forwarded: WorkspaceBoardForwardCompatibilityState | undefined
) {
  const recovery = forwarded?.nodes.find((node) => node.id === RECOVERY_ID)
  const particles = preferNewerParticleState(
    input ? normalizeWorkspaceParticleState(input) : undefined,
    recovery?.particles
      ? normalizeWorkspaceParticleState(recovery.particles)
      : undefined
  )
  if (!particles) return { particles, forwardCompatibility: forwarded }
  return {
    particles,
    forwardCompatibility: {
      connections: forwarded?.connections ?? [],
      hiddenCardIds: forwarded?.hiddenCardIds ?? [],
      nodes: [
        ...(forwarded?.nodes.filter((node) => node.id !== RECOVERY_ID) ?? []),
        { id: RECOVERY_ID, particles },
      ],
    },
  }
}
