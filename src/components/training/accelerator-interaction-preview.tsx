"use client"

import { useMemo, useState } from "react"
import type { ModuleNotesPayload } from "@/app/actions/module-notes"
import { ModuleNotesActionsContext } from "@/hooks/module-notes-actions-context"
import { Button } from "@/components/ui/button"
import {
  WorkspaceAcceleratorCardPanelComponent,
  WorkspaceAcceleratorStepNodeCardComponent,
  type WorkspaceAcceleratorCardStep,
} from "@/features/workspace-accelerator-card"

const baseStep: WorkspaceAcceleratorCardStep = {
  id: "naming:video", moduleId: "naming", moduleTitle: "Naming your NFP",
  moduleSlug: "naming-your-nfp", stepKind: "video", stepTitle: "Class video",
  stepDescription: null, href: "/visual-regression/project-feedback?scenario=accelerator",
  status: "not_started", stepSequenceIndex: 2, stepSequenceTotal: 2,
  moduleSequenceIndex: 1, moduleSequenceTotal: 2, groupTitle: "Formation",
  videoUrl: "/fixture-video.mp4", durationMinutes: null, resources: [{ id: "lesson-link", title: "Nonprofit formation reference", url: "https://example.org/formation", kind: "generic" }],
  hasAssignment: false, hasDeck: false,
}
const registration: WorkspaceAcceleratorCardStep = {
  ...baseStep, id: "registration:resources", moduleId: "registration",
  moduleTitle: "NFP Registration", moduleSlug: "nfp-registration",
  stepKind: "resources", stepTitle: "Resources", videoUrl: null,
  resources: [{ id: "registration-link", title: "Register your nonprofit", url: "https://example.org/register", kind: "generic" }],
  moduleContext: { classTitle: "Formation", lessonNotesContent: null, moduleResources: [], assignmentFields: [], assignmentSubmission: null, completeOnSubmit: false },
}

function createPreviewNotesActions() {
  const notes = new Map<string, ModuleNotesPayload>()
  const read = (moduleId: string) => {
    const entry = notes.get(moduleId) ?? null
    return { ok: true as const, notes: entry, revision: entry }
  }
  const write = (moduleId: string, content: string) => {
    if (content.trim()) notes.set(moduleId, { content: content.trim(), format: "markdown" })
    else notes.delete(moduleId)
  }
  return {
    load: async (moduleId: string) => read(moduleId),
    save: async (moduleId: string, content: string) => {
      write(moduleId, content)
      return read(moduleId)
    },
    flush: write,
  }
}

export function AcceleratorInteractionPreview() {
  const [notesActions] = useState(createPreviewNotesActions)
  const [drawerContainer, setDrawerContainer] = useState<HTMLDivElement | null>(null)
  const [completed, setCompleted] = useState(false)
  const [failSave, setFailSave] = useState(false)
  const [pending, setPending] = useState(false)
  const [open, setOpen] = useState(true)
  const [savedName, setSavedName] = useState("Saved organization")
  const [revision, setRevision] = useState(0)
  const input = useMemo(() => ({
    steps: [{ ...baseStep, id: "naming:intro-video", stepKind: "video" as const, stepTitle: "Introduction video", stepSequenceIndex: 1 }, { ...baseStep, status: completed ? "completed" as const : "not_started" as const }, registration],
    size: "lg" as const,
    initialCurrentStepId: baseStep.id,
    onStepComplete: async () => ({ ok: true as const }),
    onModuleComplete: async () => {
      setPending(true)
      await new Promise((resolve) => setTimeout(resolve, 200))
      setPending(false)
      if (failSave) return { error: "Simulated save failure" }
      setCompleted(true)
      return { ok: true as const }
    },
  }), [completed, failSave])

  return <ModuleNotesActionsContext.Provider value={notesActions}><main className="space-y-8 p-4">
    <div className="flex flex-wrap items-center gap-3">
      <Button onClick={() => { setOpen(true); setRevision((value) => value + 1) }}>Reopen lesson</Button>
      <Button onClick={() => setFailSave((value) => !value)}>{failSave ? "Allow saves" : "Fail saves"}</Button>
      <p role="status">{pending ? "Saving" : completed ? "Persisted completed" : "Persisted not started"}</p>
    </div>
    <div data-testid="canvas-preview" data-workspace-canvas-flow-frame="true" className="relative overflow-hidden">
      <div ref={setDrawerContainer} data-testid="lesson-preview" className="flex h-[min(700px,calc(100dvh-10rem))] min-h-0 flex-col empty:hidden" />
    </div>
    {open ? <section data-testid="accelerator-runtime" className="hidden">
      <WorkspaceAcceleratorCardPanelComponent key={revision} input={input}
        presentationMode="workspace-drawer" drawerContainer={drawerContainer} initialModuleViewerOpen
        onModuleViewerClose={() => setOpen(false)} />
    </section> : <p>Overview: {completed ? "Completed" : "Not started"}</p>}
    <section data-testid="resource-preview">
      <WorkspaceAcceleratorStepNodeCardComponent step={registration} stepIndex={0} stepTotal={1}
        canGoNext={false} canGoPrevious={false} completed={false} moduleCompleted={false}
        onNext={() => {}} onPrevious={() => {}} onComplete={() => {}} onClose={() => {}} />
    </section>
    <section data-testid="setup-preview" className="h-[760px]">
      <WorkspaceAcceleratorStepNodeCardComponent
        step={{ ...baseStep, id: "setup:lesson", moduleId: "setup", moduleTitle: "Organization setup", stepKind: "lesson",
          moduleContext: { classTitle: "Formation", lessonNotesContent: null, moduleResources: [], assignmentFields: [], assignmentSubmission: null, completeOnSubmit: false,
            workspaceOnboarding: { view: "organization-setup", defaults: { defaultOrgName: savedName, defaultOrgSlug: "stable-url", defaultIntentFocus: "build", defaultFormationStatus: "in_progress", defaultFirstName: "Test", defaultLastName: "Owner", defaultPersonHandle: "test-owner" } } } }}
        stepIndex={0} stepTotal={1} canGoNext={false} canGoPrevious={false} completed={false} moduleCompleted={false}
        onNext={() => {}} onPrevious={() => {}} onComplete={() => {}} onClose={() => {}}
        onWorkspaceOnboardingSubmit={async (form) => { setSavedName(String(form.get("orgName"))); }} />
    </section>
  </main></ModuleNotesActionsContext.Provider>
}
