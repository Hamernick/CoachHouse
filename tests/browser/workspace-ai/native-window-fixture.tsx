import { StrictMode, useState } from "react"
import { createRoot } from "react-dom/client"
import { DocumentFileWindow } from "@/features/document-editing/components/document-file-window"
import { WorkspaceWindowHeaderScope, WorkspaceWindowHeaderProvider } from "@/components/workspace/workspace-window-header-slots"
import { Button } from "@/components/ui/button"
import "@/app/globals.css"
function Fixture() {
  const [fileId, setFileId] = useState("00000000-0000-4000-8000-000000000002")
  const [open, setOpen] = useState(true)
  const [active, setActive] = useState(true)
  const [actions, setActions] = useState<HTMLDivElement | null>(null)
  return <main className="p-4">
    <Button onClick={() => setOpen(!open)}>{open ? "Close fixture" : "Open fixture"}</Button>
    <Button onClick={() => setActive(!active)}>{active ? "Hide window" : "Show window"}</Button>
    <Button onClick={() => setFileId("00000000-0000-4000-8000-000000000004")}>Switch source</Button>
    <div data-testid="header-actions" ref={setActions}/>
    <WorkspaceWindowHeaderProvider enabled actions={actions} accessory={null}>
      <WorkspaceWindowHeaderScope active={active}>{open && <DocumentFileWindow
        source={{ provider: "coach_house", organizationId: "00000000-0000-4000-8000-000000000001", fileId }}
        label="Private file" onClose={() => setOpen(false)}/>}</WorkspaceWindowHeaderScope>
    </WorkspaceWindowHeaderProvider>
  </main>
}
createRoot(document.getElementById("root")!).render(<StrictMode><Fixture /></StrictMode>)
