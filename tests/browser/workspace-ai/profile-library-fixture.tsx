import { StrictMode, useEffect, useState } from "react"
import { createRoot } from "react-dom/client"
import { NuqsAdapter } from "nuqs/adapters/react"
import { DocumentsTab } from "@/components/organization/org-profile-card/tabs/documents-tab"
import { WorkspaceWindowHeaderScope } from "@/components/workspace/workspace-window-header-slots"
import { WorkspaceEditorStatusProvider, useWorkspaceWindowStatus } from "@/components/workspace/workspace-editor-status"
import "@/app/globals.css"
const originalScope = { userId: "00000000-0000-4000-8000-000000000001", organizationId: "00000000-0000-4000-8000-000000000002" }
function Status() {
  const status = useWorkspaceWindowStatus()
  return <output data-fixture-dirty={status.state}>{status.text}</output>
}
function Fixture() {
  const [active, setActive] = useState(true)
  const [scope, setScope] = useState(originalScope)
  useEffect(() => {
    const activate = (event: Event) => setActive((event as CustomEvent<boolean>).detail)
    const change = (event: Event) => setScope((event as CustomEvent<typeof originalScope>).detail)
    window.addEventListener("fixture-window-active", activate)
    window.addEventListener("fixture-profile-scope", change)
    return () => { window.removeEventListener("fixture-window-active", activate); window.removeEventListener("fixture-profile-scope", change) }
  }, [])
  return <main className="h-screen p-4"><NuqsAdapter><WorkspaceEditorStatusProvider><Status />
    <WorkspaceWindowHeaderScope active={active}>
      <DocumentsTab {...scope} documents={{}} policyEntries={[]} policyPeopleOptions={[]} policyProgramOptions={[]} roadmapSections={[]} canEdit editMode />
    </WorkspaceWindowHeaderScope>
  </WorkspaceEditorStatusProvider></NuqsAdapter></main>
}
createRoot(document.getElementById("root")!).render(<StrictMode><Fixture /></StrictMode>)
