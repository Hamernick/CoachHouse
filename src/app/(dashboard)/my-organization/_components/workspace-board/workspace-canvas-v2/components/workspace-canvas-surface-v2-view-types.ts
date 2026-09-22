import type { KeyboardEventHandler } from "react"
import type {
  Node,
  NodeDragHandler,
  NodeMouseHandler,
  OnMoveEnd,
  OnNodesChange,
  ReactFlowInstance,
  SelectionDragHandler,
} from "reactflow"

import type { DocumentsTabData } from "@/components/organization/org-profile-card/tabs/documents-tab/data"
import type { OrgPersonWithImage } from "@/components/people/supporters-showcase"
import type { WorkspaceReactFlowErrorHandler } from "@/components/workspace/workspace-reactflow-error-bootstrap"
import type { WorkspaceAcceleratorCardInput } from "@/features/workspace-accelerator-card"
import type { WorkspaceFinanceInput } from "@/features/workspace-finance"
import type { RoadmapSection } from "@/lib/roadmap"
import type { WorkspaceBoardUiPreferenceScope } from "../../workspace-board-ui-preferences"
import type { WorkspaceOrganizationEditorData } from "../../workspace-board-types"
import type { WorkspaceCardShortcutItemModel } from "../shortcuts/workspace-card-shortcut-model"
import type { useWorkspaceCanvasConnectionsController } from "../runtime/workspace-canvas-connections-controller"
import type { WorkspaceDataDrawerRequest } from "./workspace-canvas-overlay-drawer-tabs"
import type {
  WorkspaceCanvasPeopleAddRequest,
  WorkspaceCanvasPersonDropRequest,
} from "./workspace-canvas-people-dnd"

export type WorkspaceCanvasSurfaceV2ViewProps = {
  nodes: Node[]
  edges: ReturnType<typeof useWorkspaceCanvasConnectionsController>["edges"]
  allowEditing: boolean
  peopleCanvasInteractionEnabled: boolean
  workspaceDataDrawerCanEdit: boolean
  nodesDraggable: boolean
  tutorialActive: boolean
  layoutAnimating: boolean
  presentationMode: boolean
  workspaceDataDrawerPeople: OrgPersonWithImage[]
  placedWorkspacePersonIds: ReadonlySet<string>
  workspaceDataDrawerViewerId: string
  workspaceDataDrawerOrganization: WorkspaceOrganizationEditorData
  workspaceDataDrawerFinance: WorkspaceFinanceInput
  workspaceDataDrawerDocuments: DocumentsTabData
  workspaceAcceleratorDrawerInput: WorkspaceAcceleratorCardInput
  workspaceAcceleratorDrawerRoadmapSections: RoadmapSection[]
  workspaceAcceleratorDrawerHasAccess: boolean
  workspaceAcceleratorDrawerPaywallHref: string
  workspaceDataDrawerRequest: WorkspaceDataDrawerRequest | null
  uiPreferencesScope: WorkspaceBoardUiPreferenceScope
  edgeContextMenuState: ReturnType<
    typeof useWorkspaceCanvasConnectionsController
  >["edgeContextMenuState"]
  shortcutItems: WorkspaceCardShortcutItemModel[]
  tutorialCalendarButtonCallout?: { title: string; instruction: string } | null
  emptyStateMessage?: string | null
  showTutorialRestart: boolean
  onNodesChange: OnNodesChange
  onNodeClick: NodeMouseHandler
  onNodeDoubleClick: NodeMouseHandler
  onKeyDownCapture: KeyboardEventHandler<HTMLDivElement>
  onNodeDragStart?: NodeDragHandler
  onNodeDragStop: NodeDragHandler
  onSelectionDragStop: SelectionDragHandler
  onMoveStart: () => void
  onMoveEnd: OnMoveEnd
  onConnect: ReturnType<
    typeof useWorkspaceCanvasConnectionsController
  >["handleConnect"]
  isValidConnection: ReturnType<
    typeof useWorkspaceCanvasConnectionsController
  >["handleIsValidConnection"]
  onEdgeDoubleClick: ReturnType<
    typeof useWorkspaceCanvasConnectionsController
  >["handleEdgeDoubleClick"]
  onEdgeContextMenu: ReturnType<
    typeof useWorkspaceCanvasConnectionsController
  >["handleEdgeContextMenu"]
  onError: WorkspaceReactFlowErrorHandler
  onInit: (instance: ReactFlowInstance) => void
  onTutorialRestart: () => void
  onTutorialCalendarButtonComplete?: (() => void) | undefined
  onRecenterView: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onWorkspacePersonDropToCanvas: (
    request: WorkspaceCanvasPersonDropRequest
  ) => boolean
  onAddWorkspacePeopleToCanvas: (
    request: WorkspaceCanvasPeopleAddRequest
  ) => number
  onRemoveWorkspacePersonFromCanvas: (personId: string) => void
  onOpenWorkspaceDataDrawer: (
    request: Omit<WorkspaceDataDrawerRequest, "id">
  ) => void
  onCloseEdgeContextMenu: ReturnType<
    typeof useWorkspaceCanvasConnectionsController
  >["closeEdgeContextMenu"]
  onDisconnectEdge: ReturnType<
    typeof useWorkspaceCanvasConnectionsController
  >["handleContextDisconnectEdge"]
  onDisconnectFromSource: ReturnType<
    typeof useWorkspaceCanvasConnectionsController
  >["handleContextDisconnectFromSource"]
  onDisconnectToTarget: ReturnType<
    typeof useWorkspaceCanvasConnectionsController
  >["handleContextDisconnectToTarget"]
  onDisconnectAll: ReturnType<
    typeof useWorkspaceCanvasConnectionsController
  >["handleContextDisconnectAll"]
}
