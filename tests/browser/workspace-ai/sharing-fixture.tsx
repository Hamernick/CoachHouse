import { useState } from "react"
import { WorkspaceSharePanel } from "../../../src/features/workspace-sharing/components/workspace-share-panel"
import { shareId } from "./sharing-actions"
const selected = [shareId(20), shareId(21)]
export function SharingFixture() {
  const [dirty, onDirtyChange] = useState(false)
  const canvasId = new URLSearchParams(location.search).has("main-canvas") ? null : shareId(70)
  return <main data-dirty={dirty} className="mx-auto w-full max-w-lg bg-background text-foreground">
    <WorkspaceSharePanel workspaceId={shareId(1)} canvasId={canvasId} particleId={shareId(20)} initialParticleIds={selected}
      onDirtyChange={onDirtyChange} onBack={() => {}} />
  </main>
}
