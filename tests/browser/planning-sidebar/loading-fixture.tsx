import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Tabs } from "@/components/ui/tabs"
import { WorkspacePageLoading, WorkspacePanelLoading } from "@/components/workspace/workspace-page-loading"
import { WorkspaceRetainedPanel } from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-retained-panel"

export function LoadingFixture() {
  const [ready, setReady] = useState(false)
  return (
    <div>
      <Button onClick={() => setReady(true)}>Resolve workspace content</Button>
      <div className="flex h-[750px] flex-col" data-testid="loading-frame">
        {!ready ? <WorkspacePageLoading embedded /> : <div className="workspace-layout-surface flex-1" data-canvas-ready="true">Canvas ready</div>}
      </div>
      <Tabs value="people">
        <WorkspaceRetainedPanel activeTab="people" value="people">
          {!ready ? <WorkspacePanelLoading /> : <Button>Open contact</Button>}
        </WorkspaceRetainedPanel>
      </Tabs>
    </div>
  )
}
