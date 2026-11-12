import { useRef, useState } from "react"
import { createRoot } from "react-dom/client"
import "../../../src/app/globals.css"
import { ParticleFileViewer } from "@/features/workspace-particles/components/particle-file-viewer"
import { WorkspaceCanvasSurfaceV2ViewportControls } from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-surface-v2-viewport-controls-panel"
import { PlanningFeedSection } from "@/features/workspace-objectives/components/planning-sidebar-surface"
import { WorkspacePlanningSidebar } from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-planning-sidebar"
import { WorkspaceDockHost } from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-dock-host"

function FullscreenFileFixture() {
  const [open, setOpen] = useState(false)
  const [canvas, setCanvas] = useState<HTMLDivElement | null>(null)
  const origin = useRef<HTMLDivElement>(null)
  return <main className="workspace-layout-surface" style={{ height: "100dvh", position: "relative" }}>
    <div ref={setCanvas} data-workspace-canvas-flow-frame className="absolute inset-0 z-0">
      <article className="absolute left-[45%] top-40">
        <button aria-haspopup="menu" onClick={() => setOpen(true)}>Preview document</button>
        <div ref={origin}>Document card</div>
        <ParticleFileViewer open={open} onOpenChange={setOpen} title="Fullscreen document" origin={origin}>
          <textarea aria-label="Document text" defaultValue="Document content" />
        </ParticleFileViewer>
      </article>
    </div>
    <WorkspaceCanvasSurfaceV2ViewportControls onZoomIn={() => {}} onZoomOut={() => {}} onRecenterView={() => {}} />
    <WorkspaceDockHost floating container={canvas} onMinimize={() => {}} request={null}
      legacyRootProps={{}} legacyContentProps={{}} legacyTrigger={null}>
      <WorkspacePlanningSidebar hidden={false} header={<span>Organization</span>}>
        <PlanningFeedSection label="Objectives" count={1} open onOpenChange={() => {}}>
          <input aria-label="Retained planning draft" defaultValue="Keep this draft" />
        </PlanningFeedSection>
      </WorkspacePlanningSidebar>
    </WorkspaceDockHost>
  </main>
}

createRoot(document.getElementById("root")!).render(<FullscreenFileFixture />)
