import { useRef, useState } from "react"
import { Tabs } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { ParticleLibrary } from "@/features/workspace-particles/components/particle-library"
import type { Particle } from "@/features/workspace-particles/types"
import { WorkspaceToolsPanel } from "@/features/workspace-tools/components/workspace-tools-panel"
import { WorkspaceRetainedPanel } from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-retained-panel"
import { WorkspaceDrawerNavigation } from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-drawer-navigation-view"
import { normalizeWorkspaceDrawerTab, type WorkspaceDrawerTab } from "@/lib/workspace/routes"

const workspaceId = "00000000-0000-4000-8000-000000000021"
export function ToolsFixture() {
  const [tab, setTab] = useState<WorkspaceDrawerTab>("tools")
  const [collapsed, setCollapsed] = useState(false)
  const [focusRequestId, setFocusRequestId] = useState<number>()
  const [particles, setParticles] = useState<Particle[]>([])
  const tabsHeaderRef = useRef<HTMLDivElement>(null)
  const tabsListRef = useRef<HTMLDivElement>(null)
  return <main className="mx-auto flex h-dvh max-w-3xl flex-col bg-background p-3 text-foreground">
    <div className="flex gap-2">
      <Button onClick={() => setCollapsed(value => !value)}>Toggle panel</Button>
      <Button onClick={() => { setTab(normalizeWorkspaceDrawerTab("particles")!); setCollapsed(false); setFocusRequestId(value => (value ?? 0) + 1) }}>Browse Particles</Button>
    </div>
    <Tabs value={tab} onValueChange={value => setTab(normalizeWorkspaceDrawerTab(value)!)} className="flex min-h-0 flex-1 flex-col">
      <WorkspaceDrawerNavigation drawerCollapsed={collapsed} handleTabOpen={value => setTab(value)} tabsHeaderRef={tabsHeaderRef} tabsListRef={tabsListRef} tabIndicator={{ left: 0, width: 0, visible: false }} />
      <WorkspaceRetainedPanel value="tools" activeTab={tab} visible={!collapsed} className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <ParticleLibrary beforeLibrary={<WorkspaceToolsPanel input={{ stripeConnection: { state: "not_configured" } }} />} backLabel="Back to Tools"
          focusRequestId={focusRequestId} workspaceId={workspaceId} particles={particles} editable canEdit pending={false} error={null}
          onRetry={() => {}} onCreate={async () => false} onAddPreset={async particle => { setParticles(value => [...value, particle]); return true }} />
      </WorkspaceRetainedPanel>
    </Tabs>
    <output data-testid="created-particles">{JSON.stringify(particles.map(particle => ({ id: particle.id, title: particle.title })))}</output>
  </main>
}
