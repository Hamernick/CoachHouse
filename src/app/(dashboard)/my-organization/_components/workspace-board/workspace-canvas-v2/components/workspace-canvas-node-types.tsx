import { WorkspaceParticleNode } from "@/features/workspace-particles/client"
import dynamic from "next/dynamic"
import type { ComponentProps } from "react"
import {
  WorkspaceOntologyEdge,
  WorkspaceOntologyNode,
} from "@/features/workspace-ontology"

import {
  WorkspaceBoardAcceleratorStepNode,
  WorkspaceBoardNode,
} from "../../workspace-board-node"
import { WorkspaceBoardOnboardingGuideNode } from "../../workspace-board-onboarding-guide-node"
import { WorkspaceCanvasPersonNode } from "./workspace-canvas-person-node"
import {
  WORKSPACE_CANVAS_PERSON_RELATIONSHIP_EDGE_TYPE,
  WorkspaceCanvasPersonRelationshipEdge,
} from "./workspace-canvas-person-relationship-edges"

const WorkspaceCanvasTutorialNode = dynamic<
  ComponentProps<
    typeof import("@/features/workspace-canvas-tutorial").WorkspaceCanvasTutorialNode
  >
>(
  () =>
    import("@/features/workspace-canvas-tutorial").then(
      (mod) => mod.WorkspaceCanvasTutorialNode
    ),
  {
    loading: () => null,
  }
)

export const WORKSPACE_CANVAS_V2_NODE_TYPES = Object.freeze({
  workspace: WorkspaceBoardNode,
  "workspace-particle": WorkspaceParticleNode,
  "accelerator-step": WorkspaceBoardAcceleratorStepNode,
  "onboarding-guide": WorkspaceBoardOnboardingGuideNode,
  "workspace-person": WorkspaceCanvasPersonNode,
  "workspace-tutorial": WorkspaceCanvasTutorialNode,
  "workspace-ontology": WorkspaceOntologyNode,
})

export const WORKSPACE_CANVAS_V2_EDGE_TYPES = Object.freeze({
  [WORKSPACE_CANVAS_PERSON_RELATIONSHIP_EDGE_TYPE]:
    WorkspaceCanvasPersonRelationshipEdge,
  "workspace-ontology": WorkspaceOntologyEdge,
})
