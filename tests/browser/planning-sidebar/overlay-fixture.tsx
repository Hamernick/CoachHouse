import { useRef, useState, type ComponentProps } from "react"
import { Tabs } from "@/components/ui/tabs"
import { ParticleComposer } from "@/features/workspace-particles/components/particle-composer"
import { WorkspaceCanvasTopTabs } from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-top-tabs"
import { WorkspaceCanvasOrganizationButton } from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-organization-button"
import { WorkspaceCanvasSurfaceV2ViewportControls } from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-surface-v2-viewport-controls-panel"
import { PlanningSidebarSurface, PlanningFeedSection } from "@/features/workspace-objectives/components/planning-sidebar-surface"
import { WorkspacePlanningSidebar } from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-planning-sidebar"
import { WorkspaceDockHost } from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-dock-host"
import { WorkspaceContentWindow } from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-content-window"
import dock from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-dock.module.css"

export function OverlayFixture() {
  const [morph, setMorph] = useState(false)
  const [tab, setTab] = useState<ComponentProps<typeof WorkspaceCanvasTopTabs>["tab"]>("people")
  const changeTab = (value: string) => {
    if (value === "people" || value === "documents" || value === "tools" || value === "accelerator" || value === "organization") setTab(value)
  }
  const tabsListRef = useRef<HTMLDivElement>(null)
  const organizationEditorData = { initialProfile: { name: "Example organization", logoUrl: null } } as ComponentProps<typeof WorkspaceCanvasOrganizationButton>["organizationEditorData"]
  if (morph) return <OrganizationMorphFixture />
  return <main style={{ height: "100dvh", position: "relative", padding: 16, color: "var(--foreground)", background: "radial-gradient(circle at 25% 45%, #9ac7ca 0, transparent 40%), radial-gradient(circle at 80% 50%, #dbb09c 0, transparent 40%), var(--background)" }}>
    <button onClick={() => document.documentElement.classList.toggle("dark")}>Toggle theme</button>
    <button onClick={() => setMorph(true)}>Show organization morph</button>
    <div style={{ position: "relative", height: 70, marginTop: 12 }}>
      <WorkspaceCanvasOrganizationButton organizationEditorData={organizationEditorData} tab={tab} drawerCollapsed bodyOverride={null} handleTabChange={changeTab} />
      <WorkspaceCanvasSurfaceV2ViewportControls onZoomIn={() => {}} onZoomOut={() => {}} onRecenterView={() => {}} />
    </div>
    <Tabs value="objectives" style={{ width: 380, height: 420 }}>
      <PlanningSidebarSurface><PlanningFeedSection label="Objectives" count={3} open onOpenChange={() => {}}>
        <div style={{ padding: 20 }}>Planning surface</div>
      </PlanningFeedSection></PlanningSidebarSurface>
    </Tabs>
    <div className={`canvas-glass ${dock.contentWindow}`} style={{ left: 430, top: 100, right: 16, height: 280, padding: 20 }}>Content window</div>
    <Tabs value={tab} style={{ position: "absolute", bottom: 70, left: 0, right: 0, height: 80 }}>
      <WorkspaceCanvasTopTabs tab={tab} drawerCollapsed handleTabOpen={() => {}} handleTabChange={changeTab} tabsListRef={tabsListRef} />
    </Tabs>
    <div style={{ position: "absolute", bottom: 12, left: 200, right: 200 }}>
      <ParticleComposer disabled={false} pending={false} error={null} saved={false} onCreate={async () => true} onRetry={() => {}} />
    </div>
  </main>
}

function OrganizationMorphFixture() {
  const [collapsed, setCollapsed] = useState(true)
  const [open, setOpen] = useState(false)
  const [opportunities, setOpportunities] = useState(false)
  const [maximized, setMaximized] = useState(false)
  const [canvas, setCanvas] = useState<HTMLDivElement | null>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const close = () => { setCollapsed(true); setMaximized(false); requestAnimationFrame(() => trigger.current?.focus()) }
  const organizationEditorData = { initialProfile: { name: "Example organization", logoUrl: null } } as ComponentProps<typeof WorkspaceCanvasOrganizationButton>["organizationEditorData"]
  return <main className="workspace-layout-surface" style={{ height: "100dvh", position: "relative" }}>
    <div ref={setCanvas} className="absolute inset-0 z-0" />
    <WorkspaceDockHost floating container={canvas} onMinimize={close} request={null}
      legacyRootProps={{}} legacyContentProps={{}} legacyTrigger={null}>
      <WorkspacePlanningSidebar hidden={!collapsed} header={<WorkspaceCanvasOrganizationButton embedded organizationEditorData={organizationEditorData} triggerRef={trigger} tab="organization" drawerCollapsed={collapsed} bodyOverride={null} handleTabChange={() => setCollapsed(false)} />}>
        <PlanningFeedSection label="Objectives" count={3} open={open} onOpenChange={value => {setOpen(value);if(value)setOpportunities(false)}}>
          <input aria-label="Objective draft" className="min-w-0 w-full" />
        </PlanningFeedSection>
        <PlanningFeedSection label="Opportunities" count={2} open={opportunities} onOpenChange={value => {setOpportunities(value);if(value)setOpen(false)}}>
          <input aria-label="Opportunity draft" className="min-w-0 w-full" />
        </PlanningFeedSection>
      </WorkspacePlanningSidebar>
      <div data-testid="overlapping-chat" className={dock.composerShell} style={{ bottom: "auto", top: 8, left: 8, right: "auto", margin: 0, width: 288 }}>
        <ParticleComposer disabled={false} pending={false} error={null} saved={false} onCreate={async () => true} onRetry={() => {}} />
      </div>
      <WorkspaceContentWindow backToPlanning collapsed={collapsed} title="Organization" organizationTriggerRef={trigger} windowState={{
        geometry: { width: maximized ? 900 : Math.min(440, innerWidth - 16), height: maximized ? 1000 : 650 }, presentation: "sidebar", maximized,
        onClose: close, onMinimize: close, onToggleMaximize: () => setMaximized(value => !value),
      }}><input aria-label="Organization draft" className="m-3" /></WorkspaceContentWindow>
    </WorkspaceDockHost>
  </main>
}
