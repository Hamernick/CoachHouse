import { StrictMode, useState } from "react"
import { createRoot } from "react-dom/client"
import { LinkedDriveDocumentEditor } from "@/components/roadmap/core-document-source/linked-drive-document-editor"
import { WorkspaceWindowHeaderScope } from "@/components/workspace/workspace-window-header-slots"
import { Button } from "@/components/ui/button"
import { resolveRoadmapSections } from "@/lib/roadmap/sections"
import "@/app/globals.css"
const scope = { userId: "current-user", organizationId: "current-org" }
function Fixture() {
  const [file, setFile] = useState("selected-file")
  const [open, setOpen] = useState(true)
  const [active, setActive] = useState(true)
  const section = resolveRoadmapSections({ roadmap: { sections: [{ id: "vision", title: "Vision", documentSource: "google_drive", driveSource: { provider: "google_drive", fileId: file, name: file, webViewLink: `https://docs.google.com/document/d/${file}/edit` } }] } }).find(section => section.id === "vision")!
  return <main className="p-4">
    <Button onClick={() => setFile("replacement-file")}>Switch source</Button>
    <Button onClick={() => setOpen(!open)}>{open ? "Close editor" : "Open editor"}</Button>
    <Button onClick={() => setActive(!active)}>{active ? "Hide window" : "Show window"}</Button>
    <WorkspaceWindowHeaderScope active={active}>{open && <LinkedDriveDocumentEditor scope={scope} section={section} onReplace={() => setFile("replacement-file")} />}</WorkspaceWindowHeaderScope>
  </main>
}
createRoot(document.getElementById("root")!).render(<StrictMode><Fixture /></StrictMode>)
