import type { ReactNode } from "react"
import type { DocumentsTabData } from "@/components/organization/org-profile-card/tabs/documents-tab/data"
import type { OrgPersonWithImage } from "@/components/people/supporters-showcase"
import type { WorkspaceAcceleratorCardInput } from "@/features/workspace-accelerator-card"
import type { WorkspaceFinanceInput } from "@/features/workspace-finance"
import type { RoadmapSection } from "@/lib/roadmap"
import type { WorkspaceBoardUiPreferenceScope } from "../../workspace-board-ui-preferences"
import type { WorkspaceOrganizationEditorData } from "../../workspace-board-types"
import type { WorkspacePeopleCanvasActions } from "./workspace-canvas-people-dnd"
import type { WorkspaceDataDrawerRequest } from "./workspace-canvas-overlay-drawer-tabs"

export type WorkspaceOverlayDrawerProps = {
  people: OrgPersonWithImage[]
  placedPersonIds: ReadonlySet<string>
  viewerId: string
  organizationEditorData: WorkspaceOrganizationEditorData
  financeInput: WorkspaceFinanceInput
  documentsTab: DocumentsTabData
  acceleratorInput: WorkspaceAcceleratorCardInput
  acceleratorRoadmapSections: RoadmapSection[]
  acceleratorHasAccess: boolean
  acceleratorPaywallHref: string
  request?: WorkspaceDataDrawerRequest | null
  canEdit: boolean
  uiPreferencesScope: WorkspaceBoardUiPreferenceScope
  peopleCanvasActions: WorkspacePeopleCanvasActions
  particleInspector?: ReactNode
  particleInspectorTitle?: string
  particleInspectorMaxWidth?: number
  particleLibrary?: ReactNode
  particleComposer?: ReactNode
  particleSelectionId?: string | null
  particleSelectionKey?: number
  onCloseParticleInspector?: (onAccepted?: () => void) => boolean
}
