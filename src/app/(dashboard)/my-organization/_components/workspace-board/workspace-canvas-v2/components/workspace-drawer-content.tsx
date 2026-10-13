"use client"
import { useState } from "react"
import { DocumentsTab } from "@/components/organization/org-profile-card/tabs/documents-tab"
import { WorkspaceToolsPanel } from "@/features/workspace-tools"
import { cn } from "@/lib/utils"
import { WorkspaceCanvasOverlayAcceleratorPanel } from "./workspace-canvas-overlay-accelerator-panel"
import { WorkspaceCanvasOverlayOrganizationPanel } from "./workspace-canvas-overlay-organization-panel"
import { WorkspacePeopleDrawerPanel } from "./workspace-canvas-overlay-people-panel"
import { WorkspaceCanvasOverlayRoadmapPanel } from "./workspace-canvas-overlay-roadmap-panel"
import {
  WorkspaceRetainedPanel,
  useRetainedDrawerRequest,
} from "./workspace-retained-panel"
import type { WorkspaceDrawerTabsProps } from "./workspace-drawer-content-types"

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
          className="mx-auto min-h-0 w-full max-w-none min-w-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain data-[state=inactive]:hidden md:px-8"
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
          className="mx-auto flex min-h-0 w-full max-w-7xl min-w-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden md:px-8"
        >
          <div
            ref={setDrawerContainer}
            data-workspace-accelerator-lesson-slot="true"
            className="flex min-h-0 flex-1 flex-col empty:hidden"
          />

          <WorkspaceCanvasOverlayAcceleratorPanel
            input={acceleratorInput}
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
          className="mx-auto flex min-h-0 w-full max-w-7xl min-w-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden md:px-8"
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
          className="mx-auto flex min-h-0 w-full max-w-none min-w-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden md:px-8"
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
          className="mx-auto flex min-h-0 w-full max-w-7xl min-w-0 flex-1 flex-col overflow-y-auto overscroll-contain data-[state=inactive]:hidden md:px-8"
        >
          <div className="box-border min-h-full w-full max-w-full min-w-0 p-2 sm:p-3">
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
          className="mx-auto flex min-h-0 w-full max-w-7xl min-w-0 flex-1 flex-col overflow-y-auto overscroll-contain data-[state=inactive]:hidden md:px-8"
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
