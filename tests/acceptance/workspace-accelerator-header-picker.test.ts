import { readFileSync } from "node:fs"

import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

import {
  WorkspaceAcceleratorCardFullscreenRailContent,
  resolveWorkspaceAcceleratorHeaderPickerScrollDistance,
  WorkspaceAcceleratorCardInlinePicker,
  WorkspaceAcceleratorCardSidebar,
  WorkspaceAcceleratorDrawerHeaderControls,
  WorkspaceAcceleratorHeaderPicker,
} from "@/features/workspace-accelerator-card/components/workspace-accelerator-card-panel-support"
import { resolveAcceleratorReadiness } from "@/lib/accelerator/readiness"
import type { AcceleratorReadinessSummary } from "@/lib/accelerator/readiness"
import { WorkspaceAcceleratorCardProgressSummary, WorkspaceAcceleratorCardProgressStrip } from "@/features/workspace-accelerator-card/components/workspace-accelerator-card-progress-strip"
import { WORKSPACE_ACCELERATOR_TUTORIAL_GUARD_CHROME_CLASSNAME } from "@/features/workspace-accelerator-card/components/workspace-accelerator-tutorial-guard-tooltip"

vi.mock("next/navigation", () => ({
  usePathname: () => "/workspace",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({
    push: () => {},
  }),
}))

function extractTriggerMarkup(markup: string) {
  const match = markup.match(
    /<button[^>]*aria-label="Choose a class track\.[^"]*"[^>]*>[\s\S]*?<\/button>/
  )
  return match?.[0] ?? ""
}

function extractTriggerBody(markup: string) {
  const match = markup.match(/<button[^>]*>([\s\S]*?)<\/button>/)
  return match?.[1] ?? ""
}

function extractProgressPercentMarkup(markup: string) {
  const match = markup.match(
    /<span[^>]*data-slot="workspace-accelerator-progress-percent"[^>]*>[\s\S]*?<\/span>/
  )
  return match?.[0] ?? ""
}

describe("workspace accelerator header picker", () => {
  it("shows a blue Verified badge independently of the green Fundable badge", () => {
    const readinessSummary = resolveAcceleratorReadiness({
      profile: { ein: "01-2345678", formationStatus: "approved" },
      modules: [], roadmapSections: [], programs: [], peopleCount: 0,
    })
    const markup = renderToStaticMarkup(React.createElement(WorkspaceAcceleratorCardProgressSummary, {
      progressPercent: 0, readinessSummary,
    }))
    expect(markup).toContain("text-blue-600")
    expect(markup).not.toContain("text-emerald-600")
    expect(markup).toContain("2/2 ready")
    expect(markup).toContain("0% lessons complete")
    const both = renderToStaticMarkup(React.createElement(WorkspaceAcceleratorCardProgressSummary, {
      progressPercent: 0, readinessSummary: { ...readinessSummary, fundable: true },
    }))
    expect(both).toContain("text-blue-600")
    expect(both).toContain("text-emerald-600")
    expect(both.match(/lucide-badge-check/g)).toHaveLength(2)
  })

  it("keeps complete lessons independent from incomplete readiness", () => {
    const summary: AcceleratorReadinessSummary = {
      score: 80, progressPercent: 80, fundableCheckpoint: 70, verifiedCheckpoint: 90,
      fundable: false, verified: false, fundableMissing: ["Document"], verifiedMissing: ["Document", "Approval"],
      fundableChecklist: Array.from({ length: 3 }, (_, index) => ({ id: `f-${index}`, label: `Requirement ${index}`, complete: index < 2 })),
      verifiedChecklist: Array.from({ length: 5 }, (_, index) => ({ id: `v-${index}`, label: `Requirement ${index}`, complete: index < 3 })),
    }
    const markup = renderToStaticMarkup(React.createElement(WorkspaceAcceleratorCardProgressSummary, {
      progressPercent: 100, readinessSummary: summary,
    }))
    expect(markup).toContain("100% lessons complete")
    expect(markup).toContain('aria-valuenow="100"')
    expect(markup).toContain('style="width:100%"')
    expect(markup).toContain("2/3 ready")
    expect(markup).toContain("3/5 ready")
    expect(markup.match(/aria-haspopup="dialog"/g)).toHaveLength(2)
    expect(markup).not.toContain("Fundable segment")
    expect(markup).not.toContain("Verified segment")
  })

  it.each([0, 42, 100])("keeps the lesson label and fill aligned at %s percent", (progressPercent) => {
    const markup = renderToStaticMarkup(React.createElement(WorkspaceAcceleratorCardProgressSummary, {
      progressPercent, showMilestones: false,
    }))
    expect(markup).toContain(`${progressPercent}% lessons complete`)
    expect(markup).toContain(`aria-valuenow="${progressPercent}"`)
    expect(markup).toContain(`style="width:${progressPercent}%"`)
    expect(markup).not.toContain("Fundable")
    expect(markup).not.toContain("Verified")
  })

  it("does not invent readiness when its summary is unavailable", () => {
    const markup = renderToStaticMarkup(React.createElement(WorkspaceAcceleratorCardProgressSummary, {
      progressPercent: 100, readinessSummary: null,
    }))
    expect(markup).toContain("Unavailable")
    expect(markup).not.toContain("0/0 ready")
    expect(markup.match(/disabled=""/g)).toHaveLength(2)
  })

  it("constrains the embedded drawer checklist to the established reading width", () => {
    const source = readFileSync(
      "src/features/workspace-accelerator-card/components/workspace-accelerator-card-panel.tsx",
      "utf8"
    )

    expect(source).toContain(
      'workspaceDrawerEmbedded ? "mx-auto w-full max-w-3xl" : undefined'
    )
  })

  it("places drawer progress on the left and the class picker on the right", () => {
    const markup = renderToStaticMarkup(
      React.createElement(WorkspaceAcceleratorDrawerHeaderControls, {
        filteredProgressPercent: 14,
        lessonGroupOptions: [{ key: "formation", label: "Formation" }],
        onLessonGroupChange: () => {},
        readinessSummary: null,
        selectedLessonGroupKey: "formation",
        tutorialCallout: null,
        viewerOpen: false,
      })
    )

    expect(markup).toContain(
      'data-workspace-accelerator-drawer-header-controls="true"'
    )
    expect(markup).not.toContain("ml-auto")
    expect(markup).toContain("py-3")
    expect(markup).toContain("sm:justify-between")
    expect(markup).toContain("sm:max-w-lg")
    expect(markup).toContain("14% lessons complete")

    expect(markup.indexOf("14% lessons complete")).toBeLessThan(
      markup.indexOf(
        'aria-label="Choose a class track. Current selection: Formation"'
      )
    )
  })

  it("only returns a hover pan distance when the label actually overflows", () => {
    expect(
      resolveWorkspaceAcceleratorHeaderPickerScrollDistance({
        contentWidth: 88,
        viewportWidth: 88,
      })
    ).toBe(0)

    expect(
      resolveWorkspaceAcceleratorHeaderPickerScrollDistance({
        contentWidth: 60,
        viewportWidth: 88,
      })
    ).toBe(0)

    expect(
      resolveWorkspaceAcceleratorHeaderPickerScrollDistance({
        contentWidth: 140,
        viewportWidth: 88,
      })
    ).toBe(60)
  })

  it("renders a single visible class-track label path inside the trigger", () => {
    const markup = renderToStaticMarkup(
      React.createElement(WorkspaceAcceleratorHeaderPicker, {
        lessonGroupOptions: [
          { key: "formation", label: "Formation" },
          {
            key: "strategic-foundations",
            label: "Strategic Foundations",
          },
        ],
        selectedLessonGroupKey: "formation",
        tutorialCallout: null,
        onLessonGroupChange: () => {},
      })
    )

    const triggerMarkup = extractTriggerMarkup(markup)
    const triggerBody = extractTriggerBody(triggerMarkup)

    expect(triggerBody).toContain("Formation")
    expect(triggerBody.match(/Formation/g)).toHaveLength(1)
    expect(triggerBody).not.toContain('data-slot="select-value"')
    expect(triggerMarkup).toContain(
      'aria-label="Choose a class track. Current selection: Formation"'
    )

    expect(triggerMarkup).toContain("text-sm")
    expect(triggerMarkup).not.toContain("text-xs")
    expect(triggerMarkup).toContain("w-[196px]")
    expect(markup).toContain('class="inline-flex items-start pb-1"')
  })

  it("can render the class picker as a badge-style card header control", () => {
    const markup = renderToStaticMarkup(
      React.createElement(WorkspaceAcceleratorHeaderPicker, {
        lessonGroupOptions: [
          { key: "formation", label: "Formation" },
          {
            key: "strategic-foundations",
            label: "Strategic Foundations",
          },
        ],
        selectedLessonGroupKey: "formation",
        tutorialCallout: null,
        layout: "badge",
        onLessonGroupChange: () => {},
      })
    )

    const triggerMarkup = extractTriggerMarkup(markup)

    expect(triggerMarkup).toContain('data-slot="badge"')
    expect(triggerMarkup).toContain("h-8")
    expect(triggerMarkup).toContain("rounded-full")
    expect(triggerMarkup).toContain("bg-muted/55")
    expect(triggerMarkup).toContain("text-foreground")
    expect(triggerMarkup).toContain("hover:bg-muted/65")
    expect(markup).not.toContain("flex w-full items-start")
  })

  it("colors class icons by their progress-rail segment", () => {
    const source = readFileSync(
      "src/features/workspace-accelerator-card/components/workspace-accelerator-header-picker.tsx",
      "utf8"
    )
    const lessonGroupOptions = Array.from({ length: 10 }, (_, index) => ({
      key: `class-${index + 1}`,
      label: `Class ${index + 1}`,
    }))
    const buildMarkup = renderToStaticMarkup(
      React.createElement(WorkspaceAcceleratorHeaderPicker, {
        lessonGroupOptions,
        selectedLessonGroupKey: "class-1",
        tutorialCallout: null,
        onLessonGroupChange: () => {},
      })
    )
    const fundableMarkup = renderToStaticMarkup(
      React.createElement(WorkspaceAcceleratorHeaderPicker, {
        lessonGroupOptions,
        selectedLessonGroupKey: "class-8",
        tutorialCallout: null,
        onLessonGroupChange: () => {},
      })
    )
    const verifiedMarkup = renderToStaticMarkup(
      React.createElement(WorkspaceAcceleratorHeaderPicker, {
        lessonGroupOptions,
        selectedLessonGroupKey: "class-10",
        tutorialCallout: null,
        onLessonGroupChange: () => {},
      })
    )

    expect(buildMarkup).toContain('data-progress-segment="build"')
    expect(buildMarkup).toContain("text-amber-600")
    expect(fundableMarkup).toContain('data-progress-segment="fundable"')
    expect(fundableMarkup).toContain("text-emerald-600")
    expect(fundableMarkup).not.toContain("ring-emerald-700/20")
    expect(verifiedMarkup).toContain('data-progress-segment="verified"')
    expect(verifiedMarkup).toContain("text-sky-600")
    expect(verifiedMarkup).not.toContain("ring-sky-700/20")
    expect(source).toContain(
      "lessonGroupOptions.map((option, optionIndex) => {"
    )
    expect(source).toContain("data-progress-segment={optionProgressSegment}")
    expect(source).toContain("optionProgressSegmentVisual.iconClassName")
    expect(source).toContain(
      'className="border-border/70 bg-muted/95 text-foreground"'
    )
  })

  it("anchors the picker tutorial indicator on the right edge of the trigger", () => {
    const markup = renderToStaticMarkup(
      React.createElement(WorkspaceAcceleratorHeaderPicker, {
        lessonGroupOptions: [
          { key: "communications", label: "Communications" },
          { key: "formation", label: "Formation" },
        ],
        selectedLessonGroupKey: "communications",
        tutorialCallout: {
          focus: "picker",
          title: "Classes",
          instruction:
            "Choose a class track here to update the module list and focus on a different part of the Accelerator.",
        },
        tutorialInteractionPolicy: {
          stepId: "accelerator-picker",
          allowedClassGroupKey: "communications",
          allowClassDropdownOpen: true,
          allowClassSelection: false,
          allowAccordionToggle: true,
          allowedModuleId: null,
          allowedStepId: null,
          allowPreviewPlayback: false,
          allowPreviewNavigation: false,
          allowPreviewClose: false,
          allowPreviewLinks: false,
          allowPreviewSubmit: false,
          blockedMessage: "We'll go over this soon, I promise! :)",
          blockedMessageDurationMs: 3000,
        },
        onLessonGroupChange: () => {},
      })
    )

    const triggerMarkup = extractTriggerMarkup(markup)

    expect(triggerMarkup).toContain(
      'style="right:0;top:50%;transform:translate(0px, calc(-50% + 0px))"'
    )
    expect(triggerMarkup).toContain("bg-muted/70")
    expect(triggerMarkup).toContain("text-foreground")
    expect(triggerMarkup).toContain("supports-[backdrop-filter]:bg-muted/55")
    expect(triggerMarkup).toContain("dark:bg-input/30")
    expect(triggerMarkup).toContain("dark:text-foreground")
    expect(triggerMarkup).toContain("rounded-xl")
    expect(triggerMarkup).toContain("h-9")
    expect(triggerMarkup).toContain("border-border/60")
  })

  it("keeps the guarded picker on the same tutorial surface even when the picker callout is not the active one", () => {
    const markup = renderToStaticMarkup(
      React.createElement(WorkspaceAcceleratorHeaderPicker, {
        lessonGroupOptions: [
          { key: "formation", label: "Formation" },
          {
            key: "strategic-foundations",
            label: "Strategic Foundations",
          },
        ],
        selectedLessonGroupKey: "formation",
        tutorialCallout: null,
        tutorialInteractionPolicy: {
          stepId: "accelerator-first-module",
          allowedClassGroupKey: "formation",
          allowClassDropdownOpen: true,
          allowClassSelection: false,
          allowAccordionToggle: true,
          allowedModuleId: "workspace-onboarding-welcome",
          allowedStepId: "workspace-onboarding-welcome:lesson",
          allowPreviewPlayback: false,
          allowPreviewNavigation: false,
          allowPreviewClose: false,
          allowPreviewLinks: false,
          allowPreviewSubmit: false,
          blockedMessage: "We'll go over this soon, I promise! :)",
          blockedMessageDurationMs: 3000,
        },
        onLessonGroupChange: () => {},
      })
    )

    const triggerMarkup = extractTriggerMarkup(markup)

    expect(triggerMarkup).toContain("bg-muted/70")
    expect(triggerMarkup).toContain("text-foreground")
    expect(triggerMarkup).toContain("supports-[backdrop-filter]:bg-muted/55")
    expect(triggerMarkup).toContain("dark:bg-input/30")
    expect(triggerMarkup).toContain("dark:text-foreground")
    expect(triggerMarkup).toContain("border-border/60")
  })

  it("marks the picker trigger as locked when the onboarding policy blocks opening the class dropdown", () => {
    const markup = renderToStaticMarkup(
      React.createElement(WorkspaceAcceleratorHeaderPicker, {
        lessonGroupOptions: [
          { key: "formation", label: "Formation" },
          {
            key: "strategic-foundations",
            label: "Strategic Foundations",
          },
        ],
        selectedLessonGroupKey: "formation",
        tutorialCallout: null,
        tutorialInteractionPolicy: {
          stepId: "accelerator-close-module",
          allowedClassGroupKey: "formation",
          allowClassDropdownOpen: false,
          allowClassSelection: false,
          allowAccordionToggle: true,
          allowedModuleId: "workspace-onboarding-welcome",
          allowedStepId: "workspace-onboarding-welcome:lesson",
          allowPreviewPlayback: true,
          allowPreviewNavigation: false,
          allowPreviewClose: false,
          allowPreviewLinks: false,
          allowPreviewSubmit: false,
          blockedMessage: "We'll go over this soon, I promise! :)",
          blockedMessageDurationMs: 3000,
        },
        viewerOpen: true,
        onLessonGroupChange: () => {},
      })
    )

    const triggerMarkup = extractTriggerMarkup(markup)

    expect(triggerMarkup).toContain('aria-disabled="true"')
    expect(triggerMarkup).toContain('data-tutorial-interaction-locked="true"')
    expect(triggerMarkup).toContain("w-[248px]")
    expect(triggerMarkup).toContain("bg-muted/70")
  })

  it("uses the same inverse tooltip chrome as the workspace shortcut rail", () => {
    expect(WORKSPACE_ACCELERATOR_TUTORIAL_GUARD_CHROME_CLASSNAME).toContain(
      "bg-foreground"
    )
    expect(WORKSPACE_ACCELERATOR_TUTORIAL_GUARD_CHROME_CLASSNAME).toContain(
      "text-background"
    )
    expect(WORKSPACE_ACCELERATOR_TUTORIAL_GUARD_CHROME_CLASSNAME).toContain(
      "shadow-md"
    )
    expect(WORKSPACE_ACCELERATOR_TUTORIAL_GUARD_CHROME_CLASSNAME).toContain(
      "[&_[data-slot=tooltip-arrow]]:bg-foreground"
    )
    expect(WORKSPACE_ACCELERATOR_TUTORIAL_GUARD_CHROME_CLASSNAME).toContain(
      "[&_[data-slot=tooltip-arrow]]:fill-foreground"
    )
    expect(WORKSPACE_ACCELERATOR_TUTORIAL_GUARD_CHROME_CLASSNAME).toContain(
      "dark:bg-white"
    )
    expect(WORKSPACE_ACCELERATOR_TUTORIAL_GUARD_CHROME_CLASSNAME).toContain(
      "dark:text-slate-950"
    )
    expect(WORKSPACE_ACCELERATOR_TUTORIAL_GUARD_CHROME_CLASSNAME).toContain(
      "dark:[&_[data-slot=tooltip-arrow]]:bg-white"
    )
    expect(WORKSPACE_ACCELERATOR_TUTORIAL_GUARD_CHROME_CLASSNAME).toContain(
      "dark:[&_[data-slot=tooltip-arrow]]:fill-white"
    )
    expect(WORKSPACE_ACCELERATOR_TUTORIAL_GUARD_CHROME_CLASSNAME).not.toContain(
      "border-foreground/10"
    )
    expect(WORKSPACE_ACCELERATOR_TUTORIAL_GUARD_CHROME_CLASSNAME).not.toContain(
      "dark:border-black/10"
    )
  })

  it("uses the wider picker trigger only when the accelerator viewer is open", () => {
    const compactMarkup = renderToStaticMarkup(
      React.createElement(WorkspaceAcceleratorHeaderPicker, {
        lessonGroupOptions: [{ key: "formation", label: "Formation" }],
        selectedLessonGroupKey: "formation",
        tutorialCallout: null,
        viewerOpen: false,
        onLessonGroupChange: () => {},
      })
    )
    const expandedMarkup = renderToStaticMarkup(
      React.createElement(WorkspaceAcceleratorHeaderPicker, {
        lessonGroupOptions: [{ key: "formation", label: "Formation" }],
        selectedLessonGroupKey: "formation",
        tutorialCallout: null,
        viewerOpen: true,
        onLessonGroupChange: () => {},
      })
    )

    expect(extractTriggerMarkup(compactMarkup)).toContain("w-[196px]")
    expect(extractTriggerMarkup(compactMarkup)).not.toContain("w-[248px]")
    expect(extractTriggerMarkup(expandedMarkup)).toContain("w-[248px]")
  })

  it("uses a full-width trigger inside the accelerator right rail layout", () => {
    const railMarkup = renderToStaticMarkup(
      React.createElement(WorkspaceAcceleratorHeaderPicker, {
        lessonGroupOptions: [{ key: "formation", label: "Formation" }],
        selectedLessonGroupKey: "formation",
        tutorialCallout: null,
        viewerOpen: true,
        layout: "rail",
        onLessonGroupChange: () => {},
      })
    )

    expect(extractTriggerMarkup(railMarkup)).toContain("w-full")
    expect(extractTriggerMarkup(railMarkup)).toContain("max-w-none")
    expect(extractTriggerMarkup(railMarkup)).not.toContain("w-[248px]")
    expect(railMarkup).toContain('class="flex w-full items-start"')
  })

  it("renders header controls above the progress strip in the accelerator rail sidebar", () => {
    const markup = renderToStaticMarkup(
      React.createElement(WorkspaceAcceleratorCardSidebar, {
        selectedLessonGroup: {
          key: "formation",
          label: "Formation",
          moduleIds: ["workspace-onboarding-welcome"],
        },
        tutorialCallout: null,
        filteredProgressPercent: 14,
        readinessSummary: null,
        checklistModules: [
          {
            id: "workspace-onboarding-welcome",
            title: "Welcome",
            groupTitle: "Formation",
            totalSteps: 1,
            completedStepCount: 0,
            isCurrent: true,
            steps: [
              {
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
              },
            ],
          },
        ],
        currentStepId: "workspace-onboarding-welcome:lesson",
        completedStepIds: [],
        openModuleId: "workspace-onboarding-welcome",
        onOpenModuleIdChange: () => {},
        onStepSelect: () => {},
        tutorialTargetStepId: null,
        headerControls: React.createElement("div", null, "Header picker"),
      })
    )

    expect(markup).toContain("Header picker")
    expect(markup).not.toContain("Progress")
    expect(markup).not.toContain(
      "flex items-center justify-between gap-2 px-0 pb-1"
    )
    expect(markup.indexOf("Header picker")).toBeLessThan(markup.indexOf("14%"))
  })

  it("can replace the checklist title copy with the badge picker after the progress strip", () => {
    const markup = renderToStaticMarkup(
      React.createElement(WorkspaceAcceleratorCardSidebar, {
        selectedLessonGroup: {
          key: "formation",
          label: "Formation",
          moduleIds: ["workspace-onboarding-welcome"],
        },
        tutorialCallout: null,
        filteredProgressPercent: 14,
        readinessSummary: null,
        checklistModules: [
          {
            id: "workspace-onboarding-welcome",
            title: "Welcome",
            groupTitle: "Formation",
            totalSteps: 1,
            completedStepCount: 0,
            isCurrent: true,
            steps: [
              {
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
              },
            ],
          },
        ],
        currentStepId: "workspace-onboarding-welcome:lesson",
        completedStepIds: [],
        openModuleId: "workspace-onboarding-welcome",
        onOpenModuleIdChange: () => {},
        onStepSelect: () => {},
        tutorialTargetStepId: null,
        checklistHeaderControls: React.createElement(
          WorkspaceAcceleratorCardInlinePicker,
          {
            lessonGroupOptions: [{ key: "formation", label: "Formation" }],
            selectedLessonGroupKey: "formation",
            tutorialCallout: null,
            viewerOpen: false,
            layout: "badge",
            onLessonGroupChange: () => {},
          }
        ),
      })
    )

    expect(markup).toContain(
      'aria-label="Choose a class track. Current selection: Formation"'
    )
    expect(extractTriggerMarkup(markup)).toContain('data-slot="badge"')
    expect(extractTriggerMarkup(markup)).toContain("h-8")
    expect(extractTriggerMarkup(markup)).toContain("max-w-72")
    expect(extractTriggerMarkup(markup)).toContain("px-3")
    expect(extractTriggerMarkup(markup)).toContain("rounded-full")
    expect(extractTriggerMarkup(markup)).toContain("bg-muted/55")
    expect(extractTriggerMarkup(markup)).toContain("text-foreground")
    expect(extractTriggerMarkup(markup)).not.toContain("w-full max-w-none")
    expect(extractTriggerMarkup(markup)).not.toContain("max-w-none")
    expect(extractTriggerMarkup(markup)).not.toContain("w-[196px]")
    expect(markup).not.toContain("Progress")
    expect(markup.indexOf("14%")).toBeLessThan(
      markup.indexOf(
        'aria-label="Choose a class track. Current selection: Formation"'
      )
    )
    expect(markup).not.toContain("Review each lesson")
    expect(markup).not.toContain("text-muted-foreground text-[11px]")
    expect(markup).not.toContain("1 step • continue")
    expect(markup).not.toContain("0 of 1 complete")
    expect(markup).toContain("In progress")
    expect(markup).toContain("bg-primary/10 text-primary")
    expect(markup).toContain(">Continue</a>")
    expect(markup).not.toContain(">continue</span>")
  })

  it("renders the progress percentage as plain text instead of a pill", () => {
    const markup = renderToStaticMarkup(
      React.createElement(WorkspaceAcceleratorCardProgressStrip, {
        progressPercent: 42,
      })
    )

    const percentMarkup = extractProgressPercentMarkup(markup)

    expect(percentMarkup).toContain("42%")
    expect(percentMarkup).toContain("tabular-nums")
    expect(percentMarkup).not.toContain("rounded-full")
    expect(percentMarkup).not.toContain("border")
    expect(percentMarkup).not.toContain("bg-background")
    expect(percentMarkup).not.toContain("px-")
    expect(percentMarkup).not.toContain("py-")
  })

  it("renders roadmap-only right rail content without the accelerator tab or controls", () => {
    const markup = renderToStaticMarkup(
      React.createElement(WorkspaceAcceleratorCardFullscreenRailContent, {
        selectedLessonGroup: {
          key: "formation",
          label: "Formation",
          moduleIds: ["workspace-onboarding-welcome"],
        },
        lessonGroupOptions: [
          { key: "formation", label: "Formation" },
          { key: "fundraising", label: "Fundraising" },
        ],
        selectedLessonGroupKey: "formation",
        onLessonGroupChange: () => {},
        tutorialCallout: null,
        filteredProgressPercent: 14,
        readinessSummary: null,
        checklistModules: [
          {
            id: "workspace-onboarding-welcome",
            title: "Welcome",
            groupTitle: "Formation",
            totalSteps: 1,
            completedStepCount: 0,
            isCurrent: true,
            steps: [
              {
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
              },
            ],
          },
        ],
        currentStepId: "workspace-onboarding-welcome:lesson",
        completedStepIds: [],
        openModuleId: "workspace-onboarding-welcome",
        onOpenModuleIdChange: () => {},
        onStepSelect: () => {},
        tutorialTargetStepId: null,
        roadmapSections: [
          {
            id: "mission-vision-values",
            title: "Mission, Vision, Values",
            subtitle: "Clarify your north star",
            slug: "mission-vision-values",
            content: "Define the principles that guide the organization.",
            lastUpdated: null,
            isPublic: false,
            layout: "vertical",
            status: "in_progress",
            templateTitle: "Mission, Vision, Values",
            templateSubtitle: "Clarify your north star",
            titleIsTemplate: false,
            subtitleIsTemplate: false,
          },
        ],
      })
    )

    expect(markup).toContain('aria-label="Strategic roadmap"')
    expect(markup).toContain("Strategic roadmap")
    expect(markup).toContain("Mission, Vision, Values")
    expect(markup).toContain(
      "hover:bg-muted/30 h-8 w-full justify-between rounded-lg px-2.5 py-0 text-left"
    )
    expect(markup).not.toContain("Accelerator</span>")
    expect(markup).not.toContain('data-slot="tabs-list"')
    expect(markup).not.toContain('data-slot="tabs-trigger"')
    expect(markup).not.toContain(
      'aria-label="Choose a class track. Current selection: Formation"'
    )
    expect(markup).not.toContain(
      'data-slot="workspace-accelerator-progress-percent"'
    )

  })
})
