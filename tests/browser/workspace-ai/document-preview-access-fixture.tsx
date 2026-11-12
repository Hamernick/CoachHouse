import { StrictMode, useEffect, useRef, useState } from "react"
import { createRoot } from "react-dom/client"
import { Button } from "@/components/ui/button"
import { WorkspaceWindowHeaderScope } from "@/components/workspace/workspace-window-header-slots"
import { DocumentPreviewDialog } from "@/components/organization/org-profile-card/tabs/documents-tab/components/document-preview-dialog"
import type { LibraryItem } from "@/components/organization/org-profile-card/tabs/documents-tab/components/documents-library-items"
import "@/app/globals.css"
const id = "10000000-0000-4000-8000-000000000073"
const common = { id, name: "Private image", description: "", fileType: "image" as const, updatedAt: null, deleted: false }
const drive: LibraryItem = { ...common, source: "uploaded", previewPath: `/api/integrations/google-drive/documents/${id}/preview`, driveDocument: { id, name: common.name, mimeType: "image/png", webViewLink: "https://drive.google.com/file/d/selected-file/view", status: "available", modifiedAt: null } }
const legacy: LibraryItem = { ...common, source: "uploaded", previewPath: "/api/account/org-documents?kind=board" }
function Fixture() {
  const [item, setItem] = useState<LibraryItem | null>(null)
  const [active, setActive] = useState(true)
  const trigger = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const change = (event: Event) => setActive((event as CustomEvent<boolean>).detail)
    window.addEventListener("fixture-window-active", change)
    return () => window.removeEventListener("fixture-window-active", change)
  }, [])
  return <main className="p-4">
    <Button ref={trigger} onClick={() => setItem(drive)}>Open Drive preview</Button>
    <Button onClick={() => setItem(legacy)}>Open legacy preview</Button>
    <WorkspaceWindowHeaderScope active={active}>
      <DocumentPreviewDialog organizationId="current-org" item={item} onClose={() => setItem(null)} returnFocusRef={trigger} />
    </WorkspaceWindowHeaderScope>
  </main>
}
createRoot(document.getElementById("root")!).render(<StrictMode><Fixture /></StrictMode>)
