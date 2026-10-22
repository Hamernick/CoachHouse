import { RoadmapConflictReview } from "../../../src/components/roadmap/roadmap-editor/components/roadmap-conflict-review"
import { StrictMode, useEffect, useMemo, useState } from "react"
import { createRoot } from "react-dom/client"
import { Toaster } from "sonner"
import { Button } from "../../../src/components/ui/button"
import { RichTextEditor } from "../../../src/components/rich-text-editor"
import { useRoadmapEditorState } from "../../../src/components/roadmap/roadmap-editor/hooks/use-roadmap-editor-state"
import { WorkspaceAiComposer } from "../../../src/features/workspace-ai/components/workspace-ai-composer"
import { useAiDocumentBridge } from "../../../src/features/workspace-ai/hooks/document-bridge"
import { ParticleComposer } from "../../../src/features/workspace-particles/components/particle-composer"
import type { RoadmapSection } from "../../../src/lib/roadmap"
import { initialSection, scope } from "./fixture-data"
import { readFixture } from "./actions"
import "../../../src/app/globals.css"

function DocumentEditor({ section, sourceScope }: { section: RoadmapSection; sourceScope: typeof scope }) {
  const sections = useMemo(() => [section], [section])
  const editor = useRoadmapEditorState({ sourceScope, sections, publicSlug: null,
    initialSectionId: "mission", navigationMode: "embedded", canEdit: true })
  const target = useMemo(() => ({ ...sourceScope, sectionId: "mission", title: "Mission",
    revision: editor.activeSection?.lastUpdated ?? null }), [sourceScope, editor.activeSection?.lastUpdated])
  useAiDocumentBridge({ target, content: editor.activeDraft?.content ?? "", dirty: editor.isDirty,
    saving: Boolean(editor.savingId), apply: editor.applyAiProposal, application: editor.aiApplication })
  return <section className="flex min-w-0 flex-col gap-3" aria-label="Document editor">
    <div className="flex items-center justify-between gap-2">
      <h1 className="text-lg font-medium">Mission</h1>
      <div className="flex items-center gap-2">
        <Button variant="ghost" className="rounded-full" disabled={editor.statusSelectDisabled}
          onClick={() => editor.handleStatusChange("complete")}>Publish</Button>
        <Button className="rounded-full" variant="secondary" disabled={!editor.isDirty || Boolean(editor.savingId)}
          onClick={editor.handleSave}>{editor.savingId ? "Saving document…" : "Save document"}</Button>
      </div>
    </div>
    {editor.activeDraft ? <RoadmapConflictReview conflict={editor.saveConflict} draft={editor.activeDraft} onResolve={editor.resolveSaveConflict} /> : null}
    <RichTextEditor value={editor.activeDraft?.content ?? ""}
      onChange={content => editor.handleDraftChange({ content })} ariaLabel="Mission document"
      basicToolbar hideLinkPreviews minHeight={220} className="rounded-2xl border border-border/60" />
    <output data-testid="editor-state" className="text-xs text-muted-foreground">
      {editor.savingId ? "Saving" : editor.isDirty ? "Unsaved" : "Saved"} · {editor.activeSection?.isPublic ? "Public" : "Private"}
    </output>
  </section>
}

function Fixture() {
  const [section, setSection] = useState(initialSection)
  const [generation, setGeneration] = useState(0)
  const [ready, setReady] = useState(false)
  const [sourceScope, setSourceScope] = useState(scope)
  async function reopen() {
    const state = await readFixture()
    setSection(state.section); setGeneration(value => value + 1); setReady(true)
  }
  useEffect(() => { void reopen() }, [])
  return <main className="mx-auto grid min-h-dvh w-full max-w-3xl content-start gap-5 bg-background p-4 text-foreground">
    <div className="flex items-center justify-between gap-2">
      <p className="text-xs text-muted-foreground">Fictional local fixture · no provider or production connection</p>
      <Button variant="ghost" className="rounded-full" onClick={() => void reopen()}>Reopen document</Button>
    </div>
    <Button variant="ghost" className="w-fit rounded-full" onClick={() => {
      setSourceScope({ ...scope, organizationId: "00000000-0000-4000-8000-000000000021" })
      setSection({ ...initialSection, content: "<p>A separate fictional organization.</p>" })
      setGeneration(value => value + 1)
    }}>Switch fixture organization</Button>
    {ready ? <DocumentEditor key={generation} section={section} sourceScope={sourceScope} /> : null}
    <div className="min-w-0">
      <WorkspaceAiComposer>{assistant => <ParticleComposer disabled={false} pending={false} error={null}
        saved={false} assistant={assistant} onCreate={async () => false} onRetry={() => undefined} />}</WorkspaceAiComposer>
    </div>
    <Toaster />
  </main>
}
createRoot(document.getElementById("root")!).render(<StrictMode><Fixture /></StrictMode>)
