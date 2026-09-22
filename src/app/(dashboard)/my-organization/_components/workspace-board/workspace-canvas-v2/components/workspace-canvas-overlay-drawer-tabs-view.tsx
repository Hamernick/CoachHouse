"use client"

import { WorkspaceParticlesPanel } from "@/features/workspace-particles/client"

import type { CSSProperties, RefObject } from "react"

import { DocumentsTab } from "@/components/organization/org-profile-card/tabs/documents-tab"
import type { DocumentsTabData } from "@/components/organization/org-profile-card/tabs/documents-tab/data"
import type { OrgPersonWithImage } from "@/components/people/supporters-showcase"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { WorkspaceAcceleratorCardInput } from "@/features/workspace-accelerator-card"
import {
  WorkspaceFinancePanel,
  type WorkspaceFinanceInput,
} from "@/features/workspace-finance"
import { WorkspaceToolsPanel } from "@/features/workspace-tools"
import type { RoadmapSection } from "@/lib/roadmap"
import { cn } from "@/lib/utils"

import type { WorkspaceBoardUiPreferenceScope } from "../../workspace-board-ui-preferences"
import type { WorkspaceOrganizationEditorData } from "../../workspace-board-types"
import { WorkspaceCanvasOverlayAcceleratorPanel } from "./workspace-canvas-overlay-accelerator-panel"
import type { WorkspacePeopleCanvasActions } from "./workspace-canvas-people-dnd"
import { WorkspaceCanvasOverlayOrganizationPanel } from "./workspace-canvas-overlay-organization-panel"
import { WorkspacePeopleDrawerPanel } from "./workspace-canvas-overlay-people-panel"
import { WorkspaceCanvasOverlayRoadmapPanel } from "./workspace-canvas-overlay-roadmap-panel"
import type {
  WorkspaceCanvasDrawerTab,
  WorkspaceDataDrawerRequest,
  WorkspaceDataDrawerTabIndicator,
} from "./workspace-canvas-overlay-drawer-tabs"

function WorkspaceDrawerTabTrigger({
  value,
  children,
  onOpen,
}: {
  value: WorkspaceCanvasDrawerTab
  children: string
  onOpen: () => void
}) {
  return (
    <TabsTrigger
      value={value}
      data-particle-return-target={value === "particles" ? "tab" : undefined}
      onClick={onOpen}
      className="h-7 min-w-0 flex-none gap-2 px-2 py-1 text-left after:hidden"
    >
      {children}
    </TabsTrigger>
  )
}

export function WorkspaceDrawerTabs({
  acceleratorHasAccess,
  acceleratorInput,
  acceleratorPaywallHref,
  acceleratorRoadmapSections,
  canEdit,
  documentsTab,
  drawerCollapsed,
  handleAcceleratorRequestHandled,
  handleTabOpen,
  handleTabChange,
  peopleCanvasActions,
  organizationEditorData,
  financeInput,
  pendingAcceleratorRequest,
  people,
  placedPersonIds,
  request,
  tab,
  tabIndicator,
  tabsHeaderRef,
  tabsListRef,
  uiPreferencesScope,
  viewerId,
}: {
  acceleratorHasAccess: boolean
  acceleratorInput: WorkspaceAcceleratorCardInput
  acceleratorPaywallHref: string
  acceleratorRoadmapSections: RoadmapSection[]
  canEdit: boolean
  documentsTab: DocumentsTabData
  drawerCollapsed: boolean
  handleAcceleratorRequestHandled: (requestId: number) => void
  handleTabOpen: () => void
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
}) {
  return (
    <Tabs
      value={tab}
      onValueChange={handleTabChange}
      className={cn(
        "flex min-h-0 w-full min-w-0 flex-1 flex-col gap-0",
        drawerCollapsed ? "overflow-visible" : "overflow-hidden"
      )}
    >
      <div
        ref={tabsHeaderRef}
        className={cn(
          "border-border/60 relative flex min-w-0 shrink-0 items-end px-4 pb-0.5 md:px-8",
          drawerCollapsed ? "-mt-3 pt-0" : "border-b pt-0.5"
        )}
      >
        <TabsList
          variant="line"
          ref={tabsListRef}
          className="h-7 w-full min-w-0 justify-start overflow-x-auto p-0 [scrollbar-width:none] group-data-[orientation=horizontal]/tabs:!h-7 sm:w-auto [&::-webkit-scrollbar]:hidden"
        >
          <WorkspaceDrawerTabTrigger
            value="organization"
            onOpen={handleTabOpen}
          >
            Organization
          </WorkspaceDrawerTabTrigger>
          <WorkspaceDrawerTabTrigger value="finance" onOpen={handleTabOpen}>
            Finance
          </WorkspaceDrawerTabTrigger>
          <WorkspaceDrawerTabTrigger value="people" onOpen={handleTabOpen}>
            People
          </WorkspaceDrawerTabTrigger>
          <WorkspaceDrawerTabTrigger value="documents" onOpen={handleTabOpen}>
            Documents
          </WorkspaceDrawerTabTrigger>
          <WorkspaceDrawerTabTrigger value="particles" onOpen={handleTabOpen}>
            Particles
          </WorkspaceDrawerTabTrigger>
          <WorkspaceDrawerTabTrigger value="tools" onOpen={handleTabOpen}>
            Tools
          </WorkspaceDrawerTabTrigger>
          <WorkspaceDrawerTabTrigger value="accelerator" onOpen={handleTabOpen}>
            Accelerator
          </WorkspaceDrawerTabTrigger>
        </TabsList>
        <span
          aria-hidden
          data-workspace-data-drawer-tab-indicator="true"
          className={cn(
            "bg-foreground absolute bottom-[-1px] left-0 z-10 h-0.5 rounded-full transition-[transform,width,opacity] duration-200 ease-out motion-reduce:transition-none",
            tabIndicator.visible ? "opacity-100" : "opacity-0"
          )}
          style={
            {
              width: `${tabIndicator.width}px`,
              transform: `translateX(${tabIndicator.left}px)`,
            } satisfies CSSProperties
          }
        />
      </div>

      <div
        data-workspace-data-drawer-body="true"
        aria-hidden={drawerCollapsed}
        inert={drawerCollapsed ? true : undefined}
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-hidden transition-opacity duration-0",
          drawerCollapsed
            ? "pointer-events-none opacity-0 delay-500"
            : "opacity-100 delay-0"
        )}
      >
        <TabsContent
          value="particles"
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain data-[state=inactive]:hidden"
        >
          {tab === "particles" ? <WorkspaceParticlesPanel /> : null}
        </TabsContent>
        <TabsContent
          value="organization"
          className="mx-auto flex min-h-0 w-full max-w-7xl min-w-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden md:px-8"
        >
          {tab === "organization" ? (
            <WorkspaceCanvasOverlayOrganizationPanel
              data={organizationEditorData}
              request={request ?? null}
            />
          ) : null}
        </TabsContent>
        <TabsContent
          value="accelerator"
          className="mx-auto flex min-h-0 w-full max-w-7xl min-w-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden md:px-8"
        >
          {tab === "accelerator" ? (
            <WorkspaceCanvasOverlayAcceleratorPanel
              input={acceleratorInput}
              roadmapSections={acceleratorRoadmapSections}
              hasAccess={acceleratorHasAccess}
              paywallHref={acceleratorPaywallHref}
              request={pendingAcceleratorRequest}
              onRequestHandled={handleAcceleratorRequestHandled}
            />
          ) : null}
        </TabsContent>
        <TabsContent
          value="roadmap"
          className="mx-auto flex min-h-0 w-full max-w-7xl min-w-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden md:px-8"
        >
          {tab === "roadmap" ? (
            <WorkspaceCanvasOverlayRoadmapPanel
              draftScope={{
                userId: viewerId,
                organizationId: uiPreferencesScope.orgId,
              }}
              sections={acceleratorRoadmapSections}
              publicSlug={organizationEditorData.roadmapPublicSlug}
              canEdit={canEdit}
              request={request ?? null}
            />
          ) : null}
        </TabsContent>
        <TabsContent
          value="people"
          className="mx-auto flex min-h-0 w-full max-w-7xl min-w-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden md:px-8"
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
        </TabsContent>
        <TabsContent
          value="documents"
          className="mx-auto flex min-h-0 w-full max-w-7xl min-w-0 flex-1 flex-col overflow-y-auto overscroll-contain data-[state=inactive]:hidden md:px-8"
        >
          {tab === "documents" ? (
            <div className="box-border min-h-full w-full max-w-full min-w-0 p-2 sm:p-3">
              <DocumentsTab
                organizationId={uiPreferencesScope.orgId}
                key={`documents:${request?.id ?? 0}`}
                userId={viewerId}
                {...documentsTab}
                editMode={canEdit}
                canEdit={canEdit}
                initialFocusKey={
                  request?.tab === "documents" ? request.focusKey : null
                }
              />
            </div>
          ) : null}
        </TabsContent>
        <TabsContent
          value="tools"
          className="mx-auto flex min-h-0 w-full max-w-7xl min-w-0 flex-1 flex-col overflow-y-auto overscroll-contain data-[state=inactive]:hidden md:px-8"
        >
          {tab === "tools" ? (
            <WorkspaceToolsPanel
              input={{
                stripeConnection: financeInput.stripeConnection ?? {
                  state: "not_configured",
                },
              }}
            />
          ) : null}
        </TabsContent>
        <TabsContent
          value="finance"
          className="mx-auto flex min-h-0 w-full max-w-7xl min-w-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
        >
          {tab === "finance" ? (
            <WorkspaceFinancePanel input={financeInput} />
          ) : null}
        </TabsContent>
      </div>
    </Tabs>
  )
}
