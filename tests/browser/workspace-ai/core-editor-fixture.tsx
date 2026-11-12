import { StrictMode, useState } from "react"
import { createRoot } from "react-dom/client"
import { OrganizationCoreDocumentEditor } from "@/features/member-workspace/components/projects/organization-core-document-editor"
import { RoadmapEditor } from "@/components/roadmap/roadmap-editor"
import { WorkspaceWindowHeaderScope } from "@/components/workspace/workspace-window-header-slots"
import { Button } from "@/components/ui/button"
import { resolveRoadmapSections } from "@/lib/roadmap/sections"
import "@/app/globals.css"
const scope = { userId: "00000000-0000-4000-8000-000000000001", organizationId: "00000000-0000-4000-8000-000000000002" }
const sections = resolveRoadmapSections({ roadmap: { sections: [{ id: "vision", title: "Private vision", content: "<p>Private core content</p>" }] } }).filter(section => section.id === "vision")
const roadmap = new URLSearchParams(location.search).has("roadmap")
function Fixture() {
  const [open, setOpen] = useState(true)
  const [active, setActive] = useState(true)
  return <main className="h-screen p-4">
    <Button onClick={() => setOpen(!open)}>{open ? "Close editor" : "Open editor"}</Button>
    <Button onClick={() => setActive(!active)}>{active ? "Hide window" : "Show window"}</Button>
    <WorkspaceWindowHeaderScope active={active}>{open && (roadmap
      ? <RoadmapEditor sourceScope={scope} sections={sections} initialSectionId="vision" publicSlug={null} showRightRail={false} navigationMode="embedded" />
      : <OrganizationCoreDocumentEditor {...scope} section={sections[0]} onClose={() => setOpen(false)} onSaved={() => {}} />)}</WorkspaceWindowHeaderScope>
  </main>
}
createRoot(document.getElementById("root")!).render(<StrictMode><Fixture /></StrictMode>)
