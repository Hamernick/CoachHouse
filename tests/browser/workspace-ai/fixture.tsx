import { MatchingFixture } from "./matching-fixture"
import { RevisionFixture } from "./revision-fixture"
import { AppShellAccountMenuActionsProvider, useAppShellAccountMenuActions } from "../../../src/components/app-shell/account-menu-actions-context"
import { SelectionSessionFixture } from "./selection-session-fixture"
import { AiCreditsPanel } from "../../../src/features/ai-credits/components/ai-credits-panel"
import { creditAccount, creditOrg } from "./credit-actions"
import { ObjectivesFixture } from "./objectives-fixture"
import { RoadmapConflictReview } from "../../../src/components/roadmap/roadmap-editor/components/roadmap-conflict-review"
import { WorkspaceWindowHeaderScope,useWorkspaceWindowHeaderActive } from "../../../src/components/workspace/workspace-window-header-slots"
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
import { initialSection, additionalSection, scope } from "./fixture-data"
import { readFixture } from "./actions"
import "../../../src/app/globals.css"

function DocumentEditor({ section, sourceScope }: { section: RoadmapSection; sourceScope: typeof scope }) {
  const sections = useMemo(() => [section], [section])
  const editor = useRoadmapEditorState({ sourceScope, sections, publicSlug: null,
    initialSectionId: section.id, navigationMode: "embedded", canEdit: true })
  const target = useMemo(() => ({ ...sourceScope, sectionId: section.id, title: section.title,
    revision: editor.activeSection?.lastUpdated ?? null }), [sourceScope, editor.activeSection?.lastUpdated,section.id,section.title])
  const contextActive=useWorkspaceWindowHeaderActive()
  useAiDocumentBridge(contextActive ? { target, content: editor.activeDraft?.content ?? "", dirty: editor.isDirty,
    saving: Boolean(editor.savingId), apply: editor.applyAiProposal, application: editor.aiApplication } : null)
  return <section className="flex min-w-0 flex-col gap-3" aria-label="Document editor">
    <div className="flex items-center justify-between gap-2">
      <h1 className="text-lg font-medium">{section.title}</h1>
      <div className="flex items-center gap-2">
        <Button variant="ghost" className="rounded-full" disabled={editor.statusSelectDisabled}
          onClick={() => editor.handleStatusChange("complete")}>Publish</Button>
        <Button className="rounded-full" variant="secondary" disabled={!editor.isDirty || Boolean(editor.savingId)}
          onClick={editor.handleSave}>{editor.savingId ? "Saving document…" : "Save document"}</Button>
      </div>
    </div>
    {editor.activeDraft ? <RoadmapConflictReview conflict={editor.saveConflict} draft={editor.activeDraft} onResolve={editor.resolveSaveConflict} /> : null}
    <RichTextEditor value={editor.activeDraft?.content ?? ""}
      onChange={content => editor.handleDraftChange({ content })} ariaLabel={`${section.title} document`}
      basicToolbar hideLinkPreviews minHeight={220} className="rounded-2xl border border-border/60" />
    <output data-testid="editor-state" className="text-xs text-muted-foreground">
      {editor.savingId ? "Saving" : editor.isDirty ? "Unsaved" : "Saved"} · {editor.activeSection?.isPublic ? "Public" : "Private"}
    </output>
  </section>
}

function Fixture() {
  const [section, setSection] = useState(initialSection)
  const [generation, setGeneration] = useState(0)
  const [visible,setVisible]=useState(true)
  const [showAdditional,setShowAdditional]=useState(false)
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
    <div className="flex flex-wrap gap-2">
      <Button variant="ghost" onClick={()=>setVisible(!visible)}>{visible ? "Hide mission window" : "Show mission window"}</Button>
      <Button variant="ghost" onClick={()=>setShowAdditional(!showAdditional)}>{showAdditional ? "Close vision window" : "Open vision window"}</Button>
    </div>
    <WorkspaceWindowHeaderScope active={visible}><div hidden={!visible} inert={!visible}>
      {ready ? <DocumentEditor key={generation} section={section} sourceScope={sourceScope} /> : null}
    </div></WorkspaceWindowHeaderScope>
    {showAdditional ? <DocumentEditor section={additionalSection} sourceScope={sourceScope} /> : null}
    <div className="min-w-0">
      <WorkspaceAiComposer sourceScope={sourceScope} organizationName="Fictional Garden Collective">{assistant => <ParticleComposer disabled={false} pending={false} error={null}
        saved={false} assistant={assistant} onCreate={async () => false} onRetry={() => undefined} />}</WorkspaceAiComposer>
    </div>
    <Toaster />
  </main>
}
function UsageNavigation() {
  const actions = useAppShellAccountMenuActions()
  return <main className="mx-auto max-w-lg bg-background p-3 text-foreground">
    {actions.map(action => <Button key={action.id} onClick={action.onSelect}>{action.label}</Button>)}
    <WorkspaceAiComposer sourceScope={{ organizationId: creditOrg, userId: creditOrg }}>{() => null}</WorkspaceAiComposer>
  </main>
}
createRoot(document.getElementById("root")!).render(<StrictMode>{new URLSearchParams(window.location.search).has("matching") ? <MatchingFixture/> : new URLSearchParams(window.location.search).has("revisions") ? <RevisionFixture /> : new URLSearchParams(window.location.search).has("usage-navigation") ? <AppShellAccountMenuActionsProvider><UsageNavigation /></AppShellAccountMenuActionsProvider> : new URLSearchParams(window.location.search).has("credits") ? <main className="mx-auto w-full max-w-sm bg-background p-3 text-foreground"><AiCreditsPanel account={creditAccount} organizationId={creditOrg} /></main> : new URLSearchParams(window.location.search).has("fixture-checkout") ? <p>Simulated checkout · no payment</p> : new URLSearchParams(window.location.search).has("selection-session") ? <SelectionSessionFixture /> : new URLSearchParams(window.location.search).has("objectives") ? <ObjectivesFixture /> : <Fixture />}</StrictMode>)
