import type { WorkspaceContentWindowState } from "./workspace-content-window"
import type { ReactNode, RefObject } from "react"
import type { DocumentsTabData } from "@/components/organization/org-profile-card/tabs/documents-tab/data"
import type { OrgPersonWithImage } from "@/components/people/supporters-showcase"
import type { WorkspaceAcceleratorCardInput } from "@/features/workspace-accelerator-card"
import type { WorkspaceFinanceInput } from "@/features/workspace-finance"
import type { RoadmapSection } from "@/lib/roadmap"
import type { WorkspaceBoardUiPreferenceScope } from "../../workspace-board-ui-preferences"
import type { WorkspaceOrganizationEditorData } from "../../workspace-board-types"
import type { WorkspacePeopleCanvasActions } from "./workspace-canvas-people-dnd"
import type {
  WorkspaceCanvasDrawerTab,
  WorkspaceDataDrawerRequest,
  WorkspaceDataDrawerTabIndicator,
} from "./workspace-canvas-overlay-drawer-tabs"

export type WorkspaceDrawerTabsProps = {
  acceleratorHasAccess: boolean
  acceleratorInput: WorkspaceAcceleratorCardInput
  acceleratorPaywallHref: string
  acceleratorRoadmapSections: RoadmapSection[]
  canEdit: boolean
  documentsTab: DocumentsTabData
  drawerCollapsed: boolean
  contentPresent?: boolean
  handleAcceleratorRequestHandled: (requestId: number) => void
  handleTabOpen: (tab: WorkspaceCanvasDrawerTab, toggleCurrent?: boolean) => void
  handleTabChange: (value: string) => void
  peopleCanvasActions: WorkspacePeopleCanvasActions
  organizationEditorData: WorkspaceOrganizationEditorData
  financeInput: WorkspaceFinanceInput
  pendingAcceleratorRequest: WorkspaceDataDrawerRequest | null
  people: OrgPersonWithImage[]
  placedPersonIds: ReadonlySet<string>
  request?: WorkspaceDataDrawerRequest | null
  tab: WorkspaceCanvasDrawerTab
  tabIndicator: WorkspaceDataDrawerTabIndicator
  tabsHeaderRef: RefObject<HTMLDivElement | null>
  tabsListRef: RefObject<HTMLDivElement | null>
  uiPreferencesScope: WorkspaceBoardUiPreferenceScope
  viewerId: string
  endAction?: ReactNode
  bodyOverride?: ReactNode
  particleInspectorTitle?: string
  particleInspectorMaxWidth?: number
  particleLibrary?: ReactNode
  windowState?: WorkspaceContentWindowState
  composerMode?: boolean
}
