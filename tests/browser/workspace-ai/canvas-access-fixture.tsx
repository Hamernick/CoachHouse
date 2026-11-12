import { StrictMode, useEffect, useRef, useState } from "react"
import { createRoot } from "react-dom/client"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { WorkspaceCanvasAccessBoundary } from "@/features/workspace-management/components/workspace-canvas-access-boundary"
import { WorkspaceManagementProvider, WorkspaceManagementBridge, useWorkspaceManagement } from "@/features/workspace-management/components/workspace-management-context"
import { useCanvasDocumentSource, useCanvasParticleSources } from "@/components/workspace/workspace-canvas-source-context"
import { particleSourceReferences } from "@/lib/workspace/canvas-source-references"
import { emptyParticleGraph } from "@/features/workspace-particles/lib/graph-validation"
import { createLibraryDocumentParticle } from "@/features/workspace-particles/lib/particle-library-document"
import { DocumentPreviewDialog } from "@/components/organization/org-profile-card/tabs/documents-tab/components/document-preview-dialog"
import type { LibraryItem } from "@/components/organization/org-profile-card/tabs/documents-tab/components/documents-library-items"
import "@/app/globals.css"

const orgId = "10000000-0000-4000-8000-000000000001"
const fileId = "10000000-0000-4000-8000-000000000070"
function sourceGraph(extra = false) {
  const graph = emptyParticleGraph(orgId)
  graph.particles = [createLibraryDocumentParticle(orgId, { name: "Private source", mimeType: "text/plain", fileId }, "10000000-0000-4000-8000-000000000010", "2026-11-08T00:00:00Z")]
  if (extra) graph.particles.push(createLibraryDocumentParticle(orgId, { name: "Second source", mimeType: "text/plain", fileId: "10000000-0000-4000-8000-000000000071" }, "10000000-0000-4000-8000-000000000011", "2026-11-08T00:00:00Z"))
  return graph
}
const initialGraph = sourceGraph()

const previewFile = { id: "10000000-0000-4000-8000-000000000072", name: "Library image", mimeType: "image/png", sizeBytes: 100, deletedAt: null, createdAt: "2026-11-08T00:00:00Z", updatedAt: "2026-11-08T00:00:00Z" }
const previewItem: LibraryItem = { id: `uploaded:${previewFile.id}`, name: previewFile.name, description: "", source: "uploaded", fileType: "image", updatedAt: previewFile.updatedAt, deleted: false, uploadedFile: previewFile, previewPath: `/api/account/organization-document-files?id=${previewFile.id}` }
function EditorSource({ id }: { id: string }) {
  useCanvasDocumentSource("editor", id)
  const [draft, setDraft] = useState("Core saved body")
  return <Textarea aria-label="Core editor draft" value={draft} onChange={event => setDraft(event.target.value)} />
}
function Canvas() {
  const [graph, setGraph] = useState(initialGraph)
  useCanvasParticleSources(graph)
  const [draft, setDraft] = useState("Saved document")
  const [open, setOpen] = useState(false)
  const [preview, setPreview] = useState<LibraryItem | null>(null)
  const [editor, setEditor] = useState<string | null>(null)
  const previewTrigger = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    document.documentElement.dataset.canvasActive = "true"
    return () => { document.documentElement.dataset.canvasActive = "false" }
  }, [])
  return <section aria-label="Protected canvas">
    <WorkspaceManagementBridge orgId="10000000-0000-4000-8000-000000000001" currentId={null} canEdit workspaces={workspaces} />
    <Button ref={previewTrigger} onClick={() => setPreview(previewItem)}>Open library preview</Button>
    <Button onClick={() => setEditor(editor ? null : "core-document-id")}>{editor ? "Close core editor" : "Open core editor"}</Button>
    <DocumentPreviewDialog item={preview} onClose={() => setPreview(null)} returnFocusRef={previewTrigger} />
    {editor && <EditorSource id={editor} />}
    <Button onClick={() => setGraph(sourceGraph(true))}>Add source</Button>
    <Button onClick={() => setGraph(emptyParticleGraph(orgId))}>Detach sources</Button>
    <Textarea aria-label="Canvas draft" value={draft} onChange={event => setDraft(event.target.value)} />
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button>Open document</Button></DialogTrigger>
      <DialogContent aria-describedby={undefined}><DialogTitle>Private document</DialogTitle><Textarea aria-label="Document draft" value={draft} onChange={event => setDraft(event.target.value)} /></DialogContent>
    </Dialog>
  </section>
}
const workspaces = [{ id: null, name: "Private finance" }]
function Catalog() {
  const management = useWorkspaceManagement()
  return <output aria-label="Sidebar catalog">{management?.scope?.workspaces.map(workspace => workspace.name).join(",")}</output>
}
function Fixture() {
  const [canvasId, setCanvasId] = useState<string | null>(null)
  return <main className="flex min-h-dvh flex-col p-4">
    <Catalog />
    <Button onClick={() => setCanvasId("10000000-0000-4000-8000-000000000003")}>Switch canvas</Button>
    <WorkspaceCanvasAccessBoundary initialSources={particleSourceReferences(initialGraph)} orgId="10000000-0000-4000-8000-000000000001" canvasId={canvasId}
      viewerId="10000000-0000-4000-8000-000000000002" role="staff" canEdit>
      <Canvas />
    </WorkspaceCanvasAccessBoundary>
  </main>
}
createRoot(document.getElementById("root")!).render(<StrictMode><WorkspaceManagementProvider><Fixture /></WorkspaceManagementProvider></StrictMode>)
