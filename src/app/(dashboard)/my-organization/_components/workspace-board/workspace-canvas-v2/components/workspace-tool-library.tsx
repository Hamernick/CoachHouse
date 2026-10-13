"use client"

import type {
  ParticleLibraryTool,
  WorkspaceToolId,
} from "@/features/workspace-particles/client"
import { WorkspaceBoardCard } from "../../workspace-board-node-card"
import type { WorkspaceBoardNodeData } from "../../workspace-board-node-types"
import type { PlaceWorkspaceTool } from "../../workspace-board-tool-placement"

const TOOLS: { id: WorkspaceToolId; title: string; subtitle: string }[] = [
  {
    id: "organization-overview",
    title: "Organization",
    subtitle: "Profile and purpose",
  },
  { id: "programs", title: "Activities", subtitle: "Programs and events" },
  {
    id: "fiscal-sponsorship",
    title: "Fiscal Sponsorship",
    subtitle: "Application and documents",
  },
]

export function buildWorkspaceToolLibrary({
  workspaceId,
  cardData,
  hiddenIds,
  onPlace,
}: {
  workspaceId: string
  cardData: Record<WorkspaceToolId, WorkspaceBoardNodeData>
  hiddenIds: readonly string[]
  onPlace: PlaceWorkspaceTool
}): ParticleLibraryTool[] {
  return TOOLS.map((entry) => ({
    ...entry,
    visible: !hiddenIds.includes(entry.id),
    // Same renderer and data as the canvas. The library's inert wrapper owns
    // interaction; never replay a canvas action request in a preview.
    preview: (
      <WorkspaceBoardCard
        data={{
          ...cardData[entry.id],
          canEdit: false,
          ontologyActionRequest: null,
          ontologyRootControl: undefined,
          organizationMapButtonCallout: null,
          tutorialStepId: null,
          onReturnToLibrary: undefined,
        }}
      />
    ),
    drag: { kind: "tool", workspaceId, id: entry.id },
    onPlace: (visible) => onPlace(entry.id, visible),
  }))
}
