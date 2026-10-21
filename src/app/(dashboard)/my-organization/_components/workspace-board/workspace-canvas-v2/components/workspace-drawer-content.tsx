"use client"
import { useState } from "react"
import dynamic from "next/dynamic"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import {
  WorkspaceRetainedPanel,
  useRetainedDrawerRequest,
} from "./workspace-retained-panel"
import type { WorkspaceDrawerTabsProps } from "./workspace-drawer-content-types"

// Unvisited retained panels never mount, so these boundaries load only when opened.
// Keep each definition stable so a visited editor retains its draft and identity.
function PanelLoading() {
  return (
    <div role="status" className="space-y-3 p-4">
      <span className="sr-only">Loading workspace content…</span>
      <Skeleton className="h-8 w-1/2 rounded-lg" />
      <Skeleton className="h-40 w-full rounded-2xl" />
    </div>
  )
}

const DocumentsTab = dynamic(
  () =>
    import("@/components/organization/org-profile-card/tabs/documents-tab").then(
      (module) => module.DocumentsTab
    ),
  { loading: PanelLoading }
)
const WorkspaceToolsPanel = dynamic(
  () =>
    import("@/features/workspace-tools").then(
      (module) => module.WorkspaceToolsPanel
    ),
  { loading: PanelLoading }
)
const WorkspaceCanvasOverlayAcceleratorPanel = dynamic(
  () =>
    import("./workspace-canvas-overlay-accelerator-panel").then(
      (module) => module.WorkspaceCanvasOverlayAcceleratorPanel
    ),
  { loading: PanelLoading }
)
const WorkspaceCanvasOverlayOrganizationPanel = dynamic(
  () =>
    import("./workspace-canvas-overlay-organization-panel").then(
      (module) => module.WorkspaceCanvasOverlayOrganizationPanel
    ),
  { loading: PanelLoading }
)
const WorkspacePeopleDrawerPanel = dynamic(
  () =>
    import("./workspace-canvas-overlay-people-panel").then(
      (module) => module.WorkspacePeopleDrawerPanel
    ),
  { loading: PanelLoading }
)
const WorkspaceCanvasOverlayRoadmapPanel = dynamic(
  () =>
    import("./workspace-canvas-overlay-roadmap-panel").then(
      (module) => module.WorkspaceCanvasOverlayRoadmapPanel
    ),
  { loading: PanelLoading }
)

export function WorkspaceDrawerContent({
  acceleratorHasAccess,
  acceleratorInput,
  acceleratorPaywallHref,
  acceleratorRoadmapSections,
  canEdit,
  documentsTab,
  drawerCollapsed,
  contentPresent = !drawerCollapsed,
  handleAcceleratorRequestHandled,
  peopleCanvasActions,
  organizationEditorData,
  financeInput,
  pendingAcceleratorRequest,
  people,
  placedPersonIds,
  request,
  tab,
  uiPreferencesScope,
  viewerId,
  bodyOverride,
  particleLibrary,
}: WorkspaceDrawerTabsProps) {
  const [drawerContainer, setDrawerContainer] = useState<HTMLDivElement | null>(
    null
  )
  const contentVisible = !drawerCollapsed && !bodyOverride
  const organizationRequest = useRetainedDrawerRequest(
    "organization",
    request,
    tab === "organization" && contentVisible
  )
  const documentsRequest = useRetainedDrawerRequest(
    "documents",
    request,
    tab === "documents" && contentVisible
  )
  const roadmapRequest = useRetainedDrawerRequest(
    "roadmap",
    request,
    tab === "roadmap" && contentVisible
  )
  return (
    <div
      data-workspace-data-drawer-body="true"
      aria-hidden={drawerCollapsed}
      inert={drawerCollapsed ? true : undefined}
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-hidden transition-opacity duration-150 motion-reduce:transition-none",
        contentPresent ? "opacity-100" : "pointer-events-none opacity-0"
      )}
    >
      <div
        hidden={!bodyOverride}
        className={cn(
          "min-h-0 flex-1 overflow-y-auto overscroll-contain",
          !bodyOverride && "hidden"
        )}
      >
        {bodyOverride}
      </div>
      <div
        hidden={Boolean(bodyOverride)}
        inert={bodyOverride ? true : undefined}
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-hidden",
          bodyOverride && "hidden"
        )}
      >
        <WorkspaceRetainedPanel
          activeTab={tab}
          visible={contentVisible}
          present={contentPresent && !bodyOverride}
          value="organization"
          data-organization-scroll-viewport="true"
          className="mx-auto min-h-0 w-full max-w-none min-w-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain data-[state=inactive]:hidden"
        >
          <WorkspaceCanvasOverlayOrganizationPanel
            key={uiPreferencesScope.orgId}
            data={organizationEditorData}
            request={organizationRequest}
          />
        </WorkspaceRetainedPanel>
        <WorkspaceRetainedPanel
          activeTab={tab}
          visible={contentVisible}
          present={contentPresent && !bodyOverride}
          value="accelerator"
          className="mx-auto flex min-h-0 w-full max-w-none min-w-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
        >
          <div
            ref={setDrawerContainer}
            data-workspace-accelerator-lesson-slot="true"
            className="flex min-h-0 flex-1 flex-col empty:hidden"
          />

          <WorkspaceCanvasOverlayAcceleratorPanel
            input={acceleratorInput}
            uiPreferencesScope={uiPreferencesScope}
            organizationLaunch={{
              ...organizationEditorData.initialProfile,
              ...organizationEditorData.organizationLocation,
              programCount: organizationEditorData.programs.length,
              programs: organizationEditorData.programs.map(
                ({ id, title, description }) => ({ id, title, description })
              ),
              canEdit: organizationEditorData.canEdit,
            }}
            drawerContainer={drawerContainer}
            roadmapSections={acceleratorRoadmapSections}
            hasAccess={acceleratorHasAccess}
            paywallHref={acceleratorPaywallHref}
            request={pendingAcceleratorRequest}
            onRequestHandled={handleAcceleratorRequestHandled}
          />
        </WorkspaceRetainedPanel>
        <WorkspaceRetainedPanel
          activeTab={tab}
          visible={contentVisible}
          present={contentPresent && !bodyOverride}
          value="roadmap"
          className="mx-auto flex min-h-0 w-full max-w-none min-w-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
        >
          <WorkspaceCanvasOverlayRoadmapPanel
            sourceScope={{
              userId: viewerId,
              organizationId: uiPreferencesScope.orgId,
            }}
            sections={acceleratorRoadmapSections}
            publicSlug={organizationEditorData.roadmapPublicSlug}
            canEdit={canEdit}
            request={roadmapRequest}
          />
        </WorkspaceRetainedPanel>
        <WorkspaceRetainedPanel
          activeTab={tab}
          visible={contentVisible}
          present={contentPresent && !bodyOverride}
          value="people"
          className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
        >
          <WorkspacePeopleDrawerPanel
            people={people}
            initialSegments={organizationEditorData.peopleSegments}
            initialTags={organizationEditorData.peopleTags}
            viewerId={viewerId}
            uiPreferencesScope={uiPreferencesScope}
            placedPersonIds={placedPersonIds}
            canEdit={canEdit}
            canvasActions={peopleCanvasActions}
          />
        </WorkspaceRetainedPanel>
        <WorkspaceRetainedPanel
          activeTab={tab}
          visible={contentVisible}
          present={contentPresent && !bodyOverride}
          value="documents"
          className="mx-auto flex min-h-0 w-full max-w-none min-w-0 flex-1 flex-col overflow-y-auto overscroll-contain data-[state=inactive]:hidden"
        >
          <div className="box-border min-h-full w-full max-w-full min-w-0 p-2 sm:py-3">
            <DocumentsTab
              focusRequestId={documentsRequest?.id}
              userId={viewerId}
              organizationId={uiPreferencesScope.orgId}
              {...documentsTab}
              editMode={canEdit}
              canEdit={canEdit}
              initialFocusKey={documentsRequest?.focusKey ?? null}
            />
          </div>
        </WorkspaceRetainedPanel>
        <WorkspaceRetainedPanel
          activeTab={tab}
          visible={contentVisible}
          present={contentPresent && !bodyOverride}
          value="particles"
          className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain data-[state=inactive]:hidden"
        >
          {particleLibrary}
        </WorkspaceRetainedPanel>
        <WorkspaceRetainedPanel
          activeTab={tab}
          visible={contentVisible}
          present={contentPresent && !bodyOverride}
          value="tools"
          className="mx-auto flex min-h-0 w-full max-w-none min-w-0 flex-1 flex-col overflow-y-auto overscroll-contain data-[state=inactive]:hidden"
        >
          <WorkspaceToolsPanel
            input={{
              stripeConnection: financeInput.stripeConnection ?? {
                state: "not_configured",
              },
            }}
          />
        </WorkspaceRetainedPanel>
      </div>
    </div>
  )
}
