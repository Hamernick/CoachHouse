import { readFileSync } from "node:fs"
import { join } from "node:path"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

import { WorkspaceBoardAcceleratorCard } from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-accelerator-card"
import { WorkspaceBoardCardFrame } from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-card-frame"
import { WorkspaceBoardNodeCardShell } from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-node-card-shell"
import { WorkspaceBoardOrganizationCardShell } from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-organization-card-shell"
import {
  FRAME_ROOT_CLASS_NAME,
  Frame,
  FrameBody,
  FrameFooter,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/ui/frame"
import type {
  WorkspaceAcceleratorCardRuntimeActions,
  WorkspaceAcceleratorCardRuntimeSnapshot,
  WorkspaceAcceleratorCardStep,
} from "@/features/workspace-accelerator-card"

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}))

const ROOT = process.cwd()

function readSource(relativePath: string) {
  return readFileSync(join(ROOT, relativePath), "utf8")
}

const ACCELERATOR_STEP = {
  id: "workspace-onboarding-welcome:lesson",
  moduleId: "workspace-onboarding-welcome",
  moduleTitle: "Welcome",
  stepKind: "lesson",
  stepTitle: "Welcome to Workspace",
  stepDescription: null,
  href: "/accelerator/class/formation/module/welcome",
  status: "in_progress",
  stepSequenceIndex: 1,
  stepSequenceTotal: 1,
  moduleSequenceIndex: 1,
  moduleSequenceTotal: 1,
  groupTitle: "Formation",
  videoUrl: null,
  durationMinutes: null,
  resources: [],
  hasAssignment: false,
  hasDeck: false,
} satisfies WorkspaceAcceleratorCardStep

describe("workspace board card frame", () => {
  it("adds particle-style hover tools to Organization and Activity cards", () => {
    const cardSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-node-card.tsx"
    )
    const toolbarSource = readSource(
      "src/features/workspace-particles/components/existing-canvas-particle-toolbar.tsx"
    )

    expect(cardSource).toContain("<ExistingCanvasParticleToolbar")
    expect(cardSource).toContain('cardId === "organization-overview"')
    expect(cardSource).toContain('cardId === "programs"')
    expect(toolbarSource).toContain("<NodeToolbar")
    expect(toolbarSource).toContain("<ToggleGroup")
    expect(toolbarSource).toContain("Small")
    expect(toolbarSource).toContain("Medium")
    expect(toolbarSource).toContain("Large")
    expect(toolbarSource).toContain("onRemove")
  })
  it("keeps the Frame primitive slim and defines explicit header, body, and footer slots", () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        Frame,
        null,
        React.createElement(
          FramePanel,
          null,
          React.createElement(
            FrameHeader,
            null,
            React.createElement(FrameTitle, null, "Title")
          ),
          React.createElement(FrameBody, null, "Main content"),
          React.createElement(
            FrameFooter,
            null,
            React.createElement("button", null, "Run action")
          )
        )
      )
    )

    expect(markup).toContain('data-slot="frame"')
    expect(markup).toContain('data-slot="frame-panel-header"')
    expect(markup).toContain('data-slot="frame-panel-title"')
    expect(markup).toContain(
      "text-foreground truncate text-lg font-semibold tracking-tight"
    )
    expect(markup).toContain('data-slot="frame-panel-content"')
    expect(markup).toContain('data-slot="frame-panel-footer"')
    expect(markup.indexOf('data-slot="frame-panel-header"')).toBeLessThan(
      markup.indexOf('data-slot="frame-panel-content"')
    )
    expect(markup.indexOf('data-slot="frame-panel-content"')).toBeLessThan(
      markup.indexOf('data-slot="frame-panel-footer"')
    )
    expect(FRAME_ROOT_CLASS_NAME).toContain("bg-muted p-1 h-auto shadow-none")
    expect(FRAME_ROOT_CLASS_NAME).toContain(
      "border-border/70 border rounded-[24px]"
    )
    expect(FRAME_ROOT_CLASS_NAME).not.toContain("rounded-2xl bg-muted/72 p-1")
    expect(FRAME_ROOT_CLASS_NAME).not.toContain("rounded-[2rem] p-3 shadow-sm")
    expect(FRAME_ROOT_CLASS_NAME).not.toContain("max-w-[42rem]")
  })

  it("renders the shared workspace card shell with Frame primitives", () => {
    const props: React.ComponentProps<typeof WorkspaceBoardCardFrame> = {
      cardId: "brand-kit",
      title: "Brand kit",
      subtitle: "Voice and assets",
      size: "md",
      presentationMode: false,
      onSizeChange: vi.fn(),
      fullHref: "/workspace/brand-kit",
      canEdit: true,
      footer: React.createElement("button", null, "Run action"),
      children: React.createElement("div", null, "Brand kit body"),
    }
    const markup = renderToStaticMarkup(
      React.createElement(WorkspaceBoardCardFrame, props)
    )

    expect(markup).toContain('data-workspace-card="brand-kit"')
    expect(markup).toContain('data-slot="frame"')
    expect(markup).toContain("bg-muted p-1")
    expect(markup).toContain("shadow-none")
    expect(markup).toContain('data-slot="frame-panel"')
    expect(markup).toContain('data-slot="frame-panel-header"')
    expect(markup).toContain('data-slot="frame-panel-title"')
    expect(markup).toContain('data-slot="frame-panel-content"')
    expect(markup).toContain('data-slot="frame-panel-footer"')
    expect(markup.indexOf('data-slot="frame-panel-header"')).toBeLessThan(
      markup.indexOf('data-slot="frame-panel-content"')
    )
    expect(markup.indexOf('data-slot="frame-panel-content"')).toBeLessThan(
      markup.indexOf('data-slot="frame-panel-footer"')
    )
    expect(markup).toContain("bg-card")
    expect(markup).not.toContain("bg-card/95")
    expect(markup).not.toContain('data-slot="card"')
    expect(markup).not.toContain('data-slot="card-content"')
  })

  it("renders the programs node through the card-style node anatomy", () => {
    const source = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-node-card-resolved-renderer.tsx"
    )
    const programsRendererSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-node-card-programs-renderer.tsx"
    )
    const shellSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-node-card-shell.tsx"
    )
    const props: React.ComponentProps<typeof WorkspaceBoardNodeCardShell> = {
      cardId: "programs",
      title: "Programs",
      subtitle: "Offers and services",
      hideSubtitle: true,
      size: "md",
      presentationMode: false,
      fullHref: "/workspace/programs",
      canEdit: true,
      headerAction: React.createElement("button", null, "Add"),
      contentSurface: "plain",
      children: React.createElement("div", null, "Programs body"),
    }
    const markup = renderToStaticMarkup(
      React.createElement(WorkspaceBoardNodeCardShell, props)
    )

    expect(markup).toContain('data-workspace-card="programs"')
    expect(markup).toContain('data-slot="card"')
    expect(markup).toContain('data-slot="card-header"')
    expect(markup).toContain('data-slot="card-title"')
    expect(markup).toContain('data-slot="card-content"')
    expect(markup).not.toContain('data-slot="card-footer"')
    expect(markup).toContain("px-3 pb-3")
    expect(markup).toContain(
      "relative -mt-1 flex flex-col gap-2 px-3 pt-0 pb-2"
    )
    expect(markup).toContain("flex w-full justify-between gap-2")
    expect(markup).toContain(
      "nodrag nopan ml-auto flex shrink-0 items-center gap-1"
    )
    expect(markup).toContain(
      "border-border/60 bg-muted relative w-full max-w-[42rem] rounded-[2rem] shadow-sm"
    )
    expect(markup).toContain("p-3")
    expect(markup).toContain("mx-0 p-0")
    expect(markup).not.toContain(
      "bg-background border-border/60 mx-3 rounded-[1.45rem] border p-3"
    )
    expect(markup.indexOf('data-slot="card-header"')).toBeLessThan(
      markup.indexOf('data-slot="card-content"')
    )
    expect(markup).toContain("Programs")
    expect(markup).toContain("Programs body")
    expect(markup).not.toContain('data-slot="frame"')
    expect(markup).not.toContain('data-slot="frame-panel"')
    expect(markup).not.toContain('data-slot="frame-panel-title"')
    expect(source).toContain('if (cardId === "programs")')
    expect(source).toContain("<WorkspaceBoardProgramsNodeCard")
    expect(programsRendererSource).toContain("<WorkspaceBoardNodeCardShell")
    expect(programsRendererSource).toContain('contentSurface="plain"')
    expect(shellSource).toContain('contentSurface = "default"')
    expect(shellSource).toContain('shellInsetClassName = "p-3"')
    expect(shellSource).toContain("shellInsetClassName?: string")
    expect(shellSource).toContain("shellClassName?: string")
    expect(shellSource).toContain("shellClassName")
    expect(shellSource).toContain(
      'contentSurface === "plain" ? "px-3" : "px-0"'
    )
    expect(shellSource).toContain(
      'contentSurface === "plain" || !footer ? "pb-3" : "pb-0"'
    )
    expect(shellSource).toContain('? "mx-0 p-0"')
    expect(shellSource).toContain("<CardContent")
    expect(shellSource).toContain("<CardFooter")
    expect(shellSource).toContain("gap-3 px-3 py-3")
    expect(shellSource).toContain("footerClassName?: string")
    expect(shellSource).toContain("footerClassName")
    expect(shellSource).not.toContain("gap-3 px-4 pt-4 pb-1")
  })

  it("renders the organization overview shell through the card-style node anatomy", () => {
    const props: React.ComponentProps<
      typeof WorkspaceBoardOrganizationCardShell
    > = {
      title: "Organization",
      subtitle: "Profile",
      size: "md",
      presentationMode: false,
      fullHref: "/workspace/profile",
      canEdit: true,
      children: React.createElement("div", null, "Organization body"),
    }
    const markup = renderToStaticMarkup(
      React.createElement(WorkspaceBoardOrganizationCardShell, props)
    )

    expect(markup).toContain('data-workspace-card="organization-overview"')
    expect(markup).toContain('data-slot="card"')
    expect(markup).toContain('data-slot="card-header"')
    expect(markup).toContain('data-slot="card-title"')
    expect(markup).toContain('data-slot="card-content"')
    expect(markup).toContain("px-0 pb-3")
    expect(markup).toContain(
      "relative -mt-1 flex flex-col gap-2 px-3 pt-0 pb-2"
    )
    expect(markup).toContain("flex w-full justify-between gap-2")
    expect(markup).toContain(
      "nodrag nopan ml-auto flex shrink-0 items-center gap-1"
    )
    expect(markup).not.toContain("px-0 pb-0")
    expect(markup).toContain(
      "border-border/60 bg-muted relative w-full max-w-[42rem] rounded-[2rem] shadow-sm"
    )
    expect(markup).toContain("p-3")
    expect(markup).toContain(
      "bg-background border-border/60 mx-3 rounded-[1.45rem] border p-3"
    )
    expect(markup.indexOf('data-slot="card-header"')).toBeLessThan(
      markup.indexOf('data-slot="card-content"')
    )
    expect(markup).toContain("Organization")
    expect(markup).toContain("Organization body")
    expect(markup).not.toContain('data-slot="frame"')
    expect(markup).not.toContain('data-slot="frame-panel"')
    expect(markup).not.toContain('data-slot="frame-panel-title"')
  })

  it("renders the accelerator node through the fiscal-style Card shell", () => {
    const source = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-accelerator-card.tsx"
    )
    const markup = renderToStaticMarkup(
      React.createElement(WorkspaceBoardAcceleratorCard, {
        input: {
          steps: [ACCELERATOR_STEP],
          size: "sm",
        },
        runtimeActions: null,
        runtimeSnapshot: {
          currentStep: ACCELERATOR_STEP,
          currentIndex: 0,
          totalSteps: 1,
          canGoPrevious: false,
          canGoNext: false,
          currentModuleStepIndex: 1,
          currentModuleStepTotal: 1,
          currentModuleCompletedCount: 0,
          isCurrentModuleCompleted: false,
          isCurrentStepCompleted: false,
          filteredStepCount: 1,
          filteredProgressPercent: 10,
        } as WorkspaceAcceleratorCardRuntimeSnapshot,
        canEdit: true,
        presentationMode: false,
        isCanvasFullscreen: false,
        tutorialCallout: null,
        tutorialInteractionPolicy: null,
        shouldTrackEmbeddedRuntime: false,
        onRequestOpenStep: () => true,
      })
    )

    expect(markup).toContain('data-workspace-card="accelerator"')
    expect(markup).toContain('data-slot="card"')
    expect(markup).toContain('data-slot="card-header"')
    expect(markup).toContain(
      "border-border/60 bg-muted relative w-full max-w-[42rem] rounded-[2rem] p-3 shadow-sm"
    )
    expect(markup).toContain('data-slot="card-content"')
    expect(markup).toContain('data-slot="card-footer"')
    expect(markup.indexOf('data-slot="card-header"')).toBeLessThan(
      markup.indexOf('data-slot="card-content"')
    )
    expect(markup.indexOf('data-slot="card-content"')).toBeLessThan(
      markup.indexOf('data-slot="card-footer"')
    )
    expect(source).toContain("CardHeader")
    expect(source).toContain("CardTitle")
    expect(source).toContain('"relative flex flex-col gap-2 px-3 pt-1.5 pb-2"')
    expect(source).toContain(
      '<div className="flex min-w-0 items-center justify-between gap-2">'
    )
    expect(source).toContain(
      'className="bg-primary/10 text-primary h-6 rounded-full border-transparent px-2.5 py-0.5 text-[11px] leading-none"'
    )
    expect(source).not.toContain(
      '"relative flex flex-col gap-3 px-4 pt-2 pb-4"'
    )
    expect(source).not.toContain(
      '<div className="flex min-w-0 items-start justify-between gap-3">'
    )
    expect(source).not.toContain(
      '<Badge variant="secondary" className="rounded-full px-3 py-1">'
    )
    expect(source).toContain(
      '<CardFooter className="items-end justify-between gap-3 px-4 py-4">'
    )
    expect(source).not.toContain("px-4 pt-4 pb-1")
    expect(markup).toContain("Accelerator")
    expect(markup).toContain("1 step")
    expect(markup).toContain("10% complete")
    expect(markup).toContain("Fundable segment, 70-90%")
    expect(markup).toContain("Verified segment, 90-100%")
    expect(markup).toContain(
      'data-react-grab-anchor="WorkspaceAcceleratorCardProgressSummary"'
    )
    expect(markup).toContain('data-react-grab-surface-slot="progress-rail"')
    expect(markup).toContain(
      "Owns the accelerator percent, progress rail, and milestone checkpoint triggers as one progress cluster."
    )
    expect(markup).toContain("nodrag nopan")
    expect(source).not.toContain('from "lucide-react/dist/esm/icons/play"')
    expect(source).not.toContain("disabled={!currentStep}")
    expect(source).not.toContain('className="nodrag nopan rounded-full"')
    expect(source).not.toContain("<PlayIcon")
    expect(markup).not.toContain("Progress rail")
    expect(markup).not.toContain('data-slot="frame"')
    expect(markup).not.toContain('data-slot="frame-panel-title"')
    expect(markup).toContain("workspace-card-drag-handle")
    expect(markup).toContain("cursor-grab")
  })

  it("keeps the accelerator card shell non-draggable in presentation mode", () => {
    const markup = renderToStaticMarkup(
      React.createElement(WorkspaceBoardAcceleratorCard, {
        input: {
          steps: [ACCELERATOR_STEP],
          size: "sm",
        },
        runtimeActions: null,
        runtimeSnapshot: null,
        canEdit: true,
        presentationMode: true,
        isCanvasFullscreen: false,
        tutorialCallout: null,
        tutorialInteractionPolicy: null,
        shouldTrackEmbeddedRuntime: false,
        onRequestOpenStep: () => true,
      })
    )

    expect(markup).not.toContain("workspace-card-drag-handle")
  })
})
