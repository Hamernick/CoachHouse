import { useNoteDocuments } from "@/features/workspace-particles/hooks/use-note-documents"
import { StrictMode, useEffect, useState } from "react"
import { createRoot } from "react-dom/client"
import { Button } from "@/components/ui/button"
import { WorkspaceWindowHeaderScope } from "@/components/workspace/workspace-window-header-slots"
import { useOrganizationDocumentFiles } from "@/components/organization/org-profile-card/tabs/documents-tab/hooks/use-organization-document-files"
import { useGoogleDriveLibrary } from "@/components/organization/org-profile-card/tabs/documents-tab/hooks/use-google-drive-library"
import { DocumentThumbnail } from "@/components/organization/org-profile-card/tabs/documents-tab/components/document-thumbnail"
import type { LibraryItem } from "@/components/organization/org-profile-card/tabs/documents-tab/components/documents-library-items"
import "@/app/globals.css"
const scope = { organizationId: "current-org", userId: "current-user" }
const common = { id: "file-1", name: "Private image", description: "", source: "uploaded" as const, fileType: "image" as const, updatedAt: null, deleted: false }
const card = (item: LibraryItem) => <article key={item.id}><span>{item.name}</span><div className="size-24"><DocumentThumbnail item={item} compact={false} organizationId={scope.organizationId} /></div></article>
function Native() {
  const library = useOrganizationDocumentFiles(scope)
  return <section aria-label="Native library">
    {library.files.map(file => card({ ...common, id: file.id, name: file.name, uploadedFile: file, previewPath: `/api/account/organization-document-files?id=${file.id}`, previewVersion: file.updatedAt }))}
    {library.error && <p role="status">{library.error}</p>}
    <Button onClick={library.reload}>Retry</Button>
    <Button disabled={!library.hasStorageAccess} onClick={() => void library.uploadFiles([new File(["test"], "Uploaded image.png", { type: "image/png" })])}>Upload</Button>
  </section>
}
function Drive() {
  const library = useGoogleDriveLibrary({ scope, enabled: true })
  return <section aria-label="Drive library">
    {library.documents.map(file => card({ ...common, id: file.id, name: file.name, driveDocument: file, previewPath: `/api/integrations/google-drive/documents/${file.id}/preview`, previewVersion: file.modifiedAt ?? undefined }))}
    {library.error && <p role="status">{library.error}</p>}
    <Button onClick={library.refresh}>Retry</Button>
  </section>
}
function Notes() {
  const [currentScope, setScope] = useState(scope)
  useEffect(() => {
    const change = (event: Event) => setScope((event as CustomEvent<typeof scope>).detail)
    window.addEventListener("fixture-note-scope", change)
    return () => window.removeEventListener("fixture-note-scope", change)
  }, [])
  const library = useNoteDocuments(currentScope)
  return <section aria-label="Notes library">
    {library.notes.map(note => <article key={note.id}><span>{note.title}</span><p>{note.summary}</p></article>)}
    {library.error && <p role="status">{library.error}</p>}
    <Button onClick={library.reload}>Retry</Button>
  </section>
}
function Fixture() {
  const [active, setActive] = useState(true)
  useEffect(() => {
    const change = (event: Event) => setActive((event as CustomEvent<boolean>).detail)
    window.addEventListener("fixture-window-active", change)
    return () => window.removeEventListener("fixture-window-active", change)
  }, [])
  return <main className="p-4"><WorkspaceWindowHeaderScope active={active}>
    {new URLSearchParams(location.search).get("kind") === "Notes" ? <Notes /> : new URLSearchParams(location.search).get("kind") === "Drive" ? <Drive /> : <Native />}
  </WorkspaceWindowHeaderScope></main>
}
createRoot(document.getElementById("root")!).render(<StrictMode><Fixture /></StrictMode>)
