import { WorkspaceChatPlanning } from "../../../src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-chat-planning"
import { WorkspaceCanvasChat, WorkspaceCanvasChatContext } from "../../../src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-chat"
import { PlanningFeedSection } from "../../../src/features/workspace-objectives/components/planning-sidebar-surface"
import { ReactFlow, ReactFlowProvider, applyNodeChanges, type Node } from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { useWorkspaceCanvasSurfaceGestureGuards } from "../../../src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-surface-v2-gesture-effect"
import { AiUsageProvider, useAiUsage } from "../../../src/features/ai-credits/client"
import { FolderLibraryFixture } from "./folder-library-fixture"
import { FolderAccessFixture } from "./folder-access-fixture"
import { WorkspaceAccessFixture } from "./workspace-access-fixture"
import { ToolsFixture } from "./tools-fixture"
import { OrganizationFormSourceEntry } from "@/features/organization-forms/client"
import { FormSourceFixture } from "./form-source-fixture"
import { FormIntakeFixture } from "./form-intake-fixture"
import { FormControlsFixture } from "./form-controls-fixture"
import { PublicSharingFixture, PublicSharingImageFixture, PublicSharingDocumentFixture } from "./public-sharing-fixture"
import { renderToString } from "react-dom/server"
import { WorkspacePageDirectory } from "../../../src/features/workspace-sharing/components/workspace-page-directory"
import { GuestFixture } from "./guest-fixture"
import { SharingFixture } from "./sharing-fixture"
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
import { createRoot, hydrateRoot } from "react-dom/client"
import { Toaster } from "sonner"
import { Button } from "../../../src/components/ui/button"
import { RichTextEditor } from "../../../src/components/rich-text-editor"
import { useRoadmapEditorState } from "../../../src/components/roadmap/roadmap-editor/hooks/use-roadmap-editor-state"
import { WorkspaceNewPlan } from "../../../src/features/workspace-ai/components/workspace-new-plan"
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
    <div className="fixed inset-x-0 bottom-4 z-20 mx-auto max-w-xl">
      <WorkspaceNewPlan {...sourceScope} canvasId={null} revision={0} disabled={false} enabled={new URLSearchParams(window.location.search).has("planner")} onProposal={async()=>false}>{planner => <WorkspaceAiComposer sourceScope={sourceScope} organizationName="Fictional Garden Collective">{assistant => <ParticleComposer disabled={false} pending={false} error={null}
        saved={false} assistant={assistant} planner={planner} onCreate={async () => false} onRetry={() => undefined} />}</WorkspaceAiComposer>}</WorkspaceNewPlan>
    </div>
    <Toaster />
  </main>
}
function ChatPlanningPreview() {
  const [objectives, setObjectives] = useState(false), [opportunities, setOpportunities] = useState(false)
  return <main className="workspace-layout-surface relative h-screen w-screen overflow-hidden"><ReactFlowProvider><ReactFlow nodes={[]} />
    <WorkspaceCanvasChatContext.Provider value><WorkspaceCanvasChat><WorkspaceChatPlanning planning={<>
      <PlanningFeedSection label="Objectives" count={2} open={objectives} onOpenChange={setObjectives}><input aria-label="Objective draft" />{Array.from({length: 16}, (_, i) => <p key={i}>Objective {i + 1}</p>)}</PlanningFeedSection>
      <PlanningFeedSection label="Opportunities" count={3} open={opportunities} onOpenChange={setOpportunities}><input aria-label="Opportunity draft" />{Array.from({length: 16}, (_, i) => <p key={i}>Opportunity {i + 1}</p>)}</PlanningFeedSection>
    </>}><ParticleComposer disabled={false} pending={false} error={null} saved={false} onCreate={async () => false} onRetry={() => {}} /></WorkspaceChatPlanning></WorkspaceCanvasChat></WorkspaceCanvasChatContext.Provider>
  </ReactFlowProvider></main>
}
function CanvasSelectionFixture() {
  const [surface, setSurface] = useState<HTMLDivElement | null>(null)
  const [nodes, setNodes] = useState<Node[]>([
    { id: "alpha", position: { x: 60, y: 60 }, data: { label: "First card" } },
    { id: "beta", position: { x: 320, y: 60 }, data: { label: "Second card" } },
  ])
  useWorkspaceCanvasSurfaceGestureGuards({ surfaceContainer: surface })
  return <><p data-testid="outside-text">Outside canvas text should stay unselected.</p><div ref={setSurface} className="h-[500px] w-[800px]">
    <ReactFlowProvider><ReactFlow nodes={nodes} onNodesChange={changes => setNodes(items => applyNodeChanges(changes, items))} multiSelectionKeyCode="Shift">
      <div className="nodrag nopan absolute bottom-2 left-2 z-10"><input aria-label="Canvas text field" defaultValue="Editable text" /></div>
    </ReactFlow></ReactFlowProvider>
  </div></>
}
function UsageDock() {
  return <AiUsageProvider enabled scope="fixture"><UsageDockContent /></AiUsageProvider>
}
function UsageDockContent() {
  const usage = useAiUsage()
  return <main className="mx-auto mt-48 w-[600px] bg-background">
    <ParticleComposer disabled={false} pending={false} error={null} saved={false} onRetry={() => {}} onCreate={async () => false} />
    <output data-testid="usage-manage-request">{usage?.manageRequest}</output>
  </main>
}
function UsageNavigation() {
  const actions = useAppShellAccountMenuActions()
  return <main className="mx-auto max-w-lg bg-background p-3 text-foreground">
    {actions.map(action => <Button key={action.id} onClick={action.onSelect}>{action.label}</Button>)}
    <WorkspaceAiComposer sourceScope={{ organizationId: creditOrg, userId: creditOrg }}>{() => null}</WorkspaceAiComposer>
  </main>
}
const root = document.getElementById("root")!
if (new URLSearchParams(location.search).has("unpublished-form")) {
  const target = { organizationId: "10000000-0000-4000-8000-000000000001", formId: "10000000-0000-4000-8000-000000000020" }
  root.innerHTML = renderToString(<OrganizationFormSourceEntry {...target} />)
  hydrateRoot(root, <OrganizationFormSourceEntry {...target} />)
} else if (new URLSearchParams(location.search).has("form-source")) {
  root.innerHTML = renderToString(<FormSourceFixture />)
  hydrateRoot(root, <FormSourceFixture />)
} else if (new URLSearchParams(location.search).has("form-intake") || location.pathname.startsWith("/forms/responses/")) {
  root.innerHTML = renderToString(<FormIntakeFixture />)
  hydrateRoot(root, <FormIntakeFixture />)
} else if (new URLSearchParams(location.search).has("form-controls")) {
  root.innerHTML = renderToString(<FormControlsFixture />)
  hydrateRoot(root, <FormControlsFixture />)
} else if (new URLSearchParams(location.search).has("public-documents")) {
  root.innerHTML = renderToString(<PublicSharingDocumentFixture />)
  hydrateRoot(root, <PublicSharingDocumentFixture />)
} else if (new URLSearchParams(location.search).has("public-images")) {
  root.innerHTML = renderToString(<PublicSharingImageFixture />)
  hydrateRoot(root, <PublicSharingImageFixture />)
} else if (new URLSearchParams(location.search).has("public-page")) {
  root.innerHTML = renderToString(<PublicSharingFixture />)
  hydrateRoot(root, <PublicSharingFixture />)
} else createRoot(root).render(<StrictMode>{new URLSearchParams(location.search).has("chat-planning") ? <ChatPlanningPreview /> : new URLSearchParams(location.search).has("canvas-selection") ? <CanvasSelectionFixture /> : new URLSearchParams(location.search).has("usage-dock") ? <UsageDock /> : new URLSearchParams(location.search).has("folder-library") ? <FolderLibraryFixture /> : new URLSearchParams(location.search).has("folder-access") ? <FolderAccessFixture /> : new URLSearchParams(location.search).has("workspace-access") ? <WorkspaceAccessFixture /> : window.location.pathname === "/workspace/shared-pages" ? <WorkspacePageDirectory pageId={new URLSearchParams(location.search).get("page") ?? undefined} after={new URLSearchParams(location.search).get("after") ?? undefined} /> : new URLSearchParams(window.location.search).has("guest") ? <GuestFixture /> : new URLSearchParams(window.location.search).has("sharing") ? <SharingFixture /> : new URLSearchParams(window.location.search).has("matching") ? <MatchingFixture/> : new URLSearchParams(window.location.search).has("revisions") ? <RevisionFixture /> : new URLSearchParams(window.location.search).has("usage-navigation") ? <AppShellAccountMenuActionsProvider><UsageNavigation /></AppShellAccountMenuActionsProvider> : new URLSearchParams(window.location.search).has("credits") ? <main className="mx-auto w-full max-w-sm bg-background p-3 text-foreground"><AiCreditsPanel account={creditAccount} organizationId={creditOrg} /></main> : new URLSearchParams(window.location.search).has("fixture-checkout") ? <p>Simulated checkout · no payment</p> : new URLSearchParams(window.location.search).has("selection-session") ? <SelectionSessionFixture /> : new URLSearchParams(window.location.search).has("objectives") ? <ObjectivesFixture /> : new URLSearchParams(window.location.search).has("tools") ? <ToolsFixture /> : <Fixture />}</StrictMode>)
