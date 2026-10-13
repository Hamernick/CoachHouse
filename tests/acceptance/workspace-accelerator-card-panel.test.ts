import React from "react"
import type { WorkspaceAcceleratorCardStep } from "@/features/workspace-accelerator-card"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

import {
  resolveWorkspaceAcceleratorModuleStepNavigation,
  resolveWorkspaceAcceleratorPlaceholderVideoUrl,
} from "@/features/workspace-accelerator-card/components/workspace-accelerator-module-navigation"
import { buildWorkspaceAcceleratorFullscreenHref } from "@/features/workspace-accelerator-card"
import { WorkspaceAcceleratorCardPanel } from "@/features/workspace-accelerator-card/components/workspace-accelerator-card-panel"
import { isWorkspaceAcceleratorOpenStepRequestFulfilled } from "@/features/workspace-accelerator-card/components/workspace-accelerator-card-panel-runtime"
import { RightRailProvider } from "@/components/app-shell/right-rail"
import {
  resolveWorkspaceAcceleratorCollapsedCardSize,
  shouldWorkspaceAcceleratorSyncModuleViewerSize,
  shouldWorkspaceAcceleratorTutorialAdvanceAfterStepOpen,
  shouldWorkspaceAcceleratorTutorialAdvanceFromFooterContinue,
  shouldWorkspaceAcceleratorTutorialKeepModuleViewerOpen,
} from "@/features/workspace-accelerator-card/components/workspace-accelerator-card-panel-support"

vi.mock("next/navigation", () => ({
  usePathname: () => "/workspace",
  useRouter: () => ({
    push: () => undefined,
  }),
  useSearchParams: () => new URLSearchParams(),
}))

describe("workspace accelerator tutorial panel state", () => {
  it("acknowledges an exact canvas request only after its viewer is active", () => {
    const currentStep = {
      id: "budgeting:video",
      moduleId: "budgeting",
    }
    const request = {
      id: 1,
      stepId: "budgeting:video",
      moduleId: "budgeting",
      lessonGroupKey: null,
    }

    expect(
      isWorkspaceAcceleratorOpenStepRequestFulfilled({
        request,
        currentStep,
        isModuleViewerOpen: false,
      })
    ).toBe(false)
    expect(
      isWorkspaceAcceleratorOpenStepRequestFulfilled({
        request,
        currentStep,
        isModuleViewerOpen: true,
      })
    ).toBe(true)
    expect(
      isWorkspaceAcceleratorOpenStepRequestFulfilled({
        request,
        currentStep: { ...currentStep, id: "mission:video" },
        isModuleViewerOpen: true,
      })
    ).toBe(false)
  })

  it("keeps module viewer arrow navigation inside the current module", () => {
    const moduleSteps: WorkspaceAcceleratorCardStep[] = [
      {
        id: "need:video",
        moduleId: "need",
        moduleTitle: "Need?",
        stepKind: "video",
        stepTitle: "Video",
        stepDescription: null,
        href: "/accelerator/class/strategic-foundations/module/3",
        status: "in_progress",
        stepSequenceIndex: 1,
        stepSequenceTotal: 3,
        moduleSequenceIndex: 1,
        moduleSequenceTotal: 2,
        groupTitle: "Strategic Foundations",
        videoUrl: "https://cdn.example.com/need.mp4",
        durationMinutes: 8,
        resources: [],
        hasAssignment: true,
        hasDeck: false,
      },
      {
        id: "need:assignment",
        moduleId: "need",
        moduleTitle: "Need?",
        stepKind: "assignment",
        stepTitle: "Assignment",
        stepDescription: null,
        href: "/accelerator/class/strategic-foundations/module/3",
        status: "not_started",
        stepSequenceIndex: 2,
        stepSequenceTotal: 3,
        moduleSequenceIndex: 1,
        moduleSequenceTotal: 2,
        groupTitle: "Strategic Foundations",
        videoUrl: null,
        durationMinutes: null,
        resources: [],
        hasAssignment: true,
        hasDeck: false,
      },
    ]

    expect(
      resolveWorkspaceAcceleratorModuleStepNavigation({
        currentModuleSteps: [...moduleSteps],
        currentStepId: "need:video",
      })
    ).toMatchObject({
      canGoPrevious: false,
      canGoNext: true,
      previousStepId: null,
      nextStepId: "need:assignment",
    })

    expect(
      resolveWorkspaceAcceleratorModuleStepNavigation({
        currentModuleSteps: [...moduleSteps],
        currentStepId: "need:assignment",
      })
    ).toMatchObject({
      canGoPrevious: true,
      canGoNext: false,
      previousStepId: "need:video",
      nextStepId: null,
    })
  })

  it("keeps arrow navigation inside the current module before Need video shortcuts", () => {
    const needVideo: WorkspaceAcceleratorCardStep = {
      id: "what-is-the-need:video",
      moduleId: "module-need",
      moduleSlug: "what-is-the-need",
      moduleTitle: "Need?",
      stepKind: "video",
      stepTitle: "Video",
      stepDescription: null,
      href: "/accelerator/class/strategic-foundations/module/what-is-the-need",
      status: "in_progress",
      stepSequenceIndex: 1,
      stepSequenceTotal: 2,
      moduleSequenceIndex: 3,
      moduleSequenceTotal: 6,
      groupTitle: "Strategic Foundations",
      videoUrl: "https://cdn.example.com/need.mp4",
      durationMinutes: 8,
      resources: [],
      hasAssignment: true,
      hasDeck: false,
    }
    const needAssignment: WorkspaceAcceleratorCardStep = {
      ...needVideo,
      id: "what-is-the-need:assignment",
      stepKind: "assignment",
      stepTitle: "Assignment",
      videoUrl: null,
      durationMinutes: null,
      status: "not_started",
      stepSequenceIndex: 2,
    }
    const aiNeedVideo: WorkspaceAcceleratorCardStep = {
      id: "ai-the-need:video",
      moduleId: "module-ai-need",
      moduleSlug: "ai-the-need",
      moduleTitle: "Writing a Need Statement",
      stepKind: "video",
      stepTitle: "Video",
      stepDescription: null,
      href: "/accelerator/class/strategic-foundations/module/ai-the-need",
      status: "not_started",
      stepSequenceIndex: 1,
      stepSequenceTotal: 2,
      moduleSequenceIndex: 4,
      moduleSequenceTotal: 6,
      groupTitle: "Strategic Foundations",
      videoUrl: "https://cdn.example.com/ai-need.mp4",
      durationMinutes: 8,
      resources: [],
      hasAssignment: true,
      hasDeck: false,
    }
    const aiNeedAssignment: WorkspaceAcceleratorCardStep = {
      ...aiNeedVideo,
      id: "ai-the-need:assignment",
      stepKind: "assignment",
      stepTitle: "Assignment",
      videoUrl: null,
      durationMinutes: null,
      stepSequenceIndex: 2,
    }
    const steps = [needVideo, needAssignment, aiNeedVideo, aiNeedAssignment]

    expect(
      resolveWorkspaceAcceleratorModuleStepNavigation({
        steps,
        currentModuleSteps: [needVideo, needAssignment],
        currentStepId: "what-is-the-need:video",
      })
    ).toMatchObject({
      canGoPrevious: false,
      canGoNext: true,
      previousStepId: null,
      nextStepId: "what-is-the-need:assignment",
    })

    expect(
      resolveWorkspaceAcceleratorModuleStepNavigation({
        steps,
        currentModuleSteps: [aiNeedVideo, aiNeedAssignment],
        currentStepId: "ai-the-need:video",
      })
    ).toMatchObject({
      canGoPrevious: true,
      canGoNext: true,
      previousStepId: "what-is-the-need:video",
      nextStepId: "ai-the-need:assignment",
    })

    expect(
      resolveWorkspaceAcceleratorModuleStepNavigation({
        steps,
        currentModuleSteps: [needVideo],
        currentStepId: "what-is-the-need:video",
      })
    ).toMatchObject({
      canGoPrevious: false,
      canGoNext: true,
      previousStepId: null,
      nextStepId: "ai-the-need:video",
    })

    expect(
      resolveWorkspaceAcceleratorModuleStepNavigation({
        steps,
        currentModuleSteps: [aiNeedVideo],
        currentStepId: "ai-the-need:video",
      })
    ).toMatchObject({
      canGoPrevious: true,
      canGoNext: false,
      previousStepId: "what-is-the-need:video",
      nextStepId: null,
    })
  })

  it("builds workspace accelerator fullscreen hrefs with optional deep-link state", () => {
    expect(
      buildWorkspaceAcceleratorFullscreenHref({
        stepId: "workspace-onboarding-welcome:lesson",
        moduleId: "workspace-onboarding-welcome",
        lessonGroupKey: "formation",
      })
    ).toBe(
      "/workspace/accelerator?step=workspace-onboarding-welcome%3Alesson&module=workspace-onboarding-welcome&group=formation"
    )

    expect(
      buildWorkspaceAcceleratorFullscreenHref({
        stepId: null,
        moduleId: null,
        lessonGroupKey: null,
      })
    ).toBe("/workspace/accelerator")
  })

  it("keeps the embedded module viewer open for the tutorial callout and module-preview mode", () => {
    expect(
      shouldWorkspaceAcceleratorTutorialKeepModuleViewerOpen({
        tutorialCallout: null,
      })
    ).toBe(false)
    expect(
      shouldWorkspaceAcceleratorTutorialKeepModuleViewerOpen({
        tutorialCallout: {
          focus: "first-module",
          title: "First module",
          instruction: "Click the first module step here to continue.",
        },
      })
    ).toBe(false)
    expect(
      shouldWorkspaceAcceleratorTutorialKeepModuleViewerOpen({
        tutorialCallout: {
          focus: "picker",
          title: "Class picker",
          instruction: "Choose a class track here.",
        },
      })
    ).toBe(false)
    expect(
      shouldWorkspaceAcceleratorTutorialKeepModuleViewerOpen({
        tutorialCallout: {
          focus: "close-module",
          title: "Close module",
          instruction: "Click here to close this module and return.",
        },
      })
    ).toBe(true)
    expect(
      shouldWorkspaceAcceleratorTutorialKeepModuleViewerOpen({
        tutorialCallout: null,
        tutorialMode: "module-preview",
      })
    ).toBe(true)
  })

  it("uses the embedded footer continue button as a tutorial next action only in module-preview mode", () => {
    expect(
      shouldWorkspaceAcceleratorTutorialAdvanceFromFooterContinue(null)
    ).toBe(false)
    expect(
      shouldWorkspaceAcceleratorTutorialAdvanceFromFooterContinue(
        "module-preview"
      )
    ).toBe(true)
  })

  it("waits to advance the guided first module step until the module viewer is actually open on the target step", () => {
    const firstModuleCallout = {
      focus: "first-module" as const,
      title: "First module",
      instruction: "Click the Organization setup module here to continue.",
    }

    expect(
      shouldWorkspaceAcceleratorTutorialAdvanceAfterStepOpen({
        tutorialCallout: firstModuleCallout,
        pendingAdvance: true,
        isModuleViewerOpen: false,
        currentStepId: "organization-setup-step",
        tutorialTargetStepId: "organization-setup-step",
      })
    ).toBe(false)

    expect(
      shouldWorkspaceAcceleratorTutorialAdvanceAfterStepOpen({
        tutorialCallout: firstModuleCallout,
        pendingAdvance: true,
        isModuleViewerOpen: true,
        currentStepId: "other-step",
        tutorialTargetStepId: "organization-setup-step",
      })
    ).toBe(false)

    expect(
      shouldWorkspaceAcceleratorTutorialAdvanceAfterStepOpen({
        tutorialCallout: firstModuleCallout,
        pendingAdvance: true,
        isModuleViewerOpen: true,
        currentStepId: "organization-setup-step",
        tutorialTargetStepId: "organization-setup-step",
      })
    ).toBe(true)
  })

  it("keeps live canvas card width sync disabled while the tutorial owns module preview state", () => {
    expect(
      shouldWorkspaceAcceleratorSyncModuleViewerSize({
        tutorialCallout: null,
      })
    ).toBe(true)
    expect(
      shouldWorkspaceAcceleratorSyncModuleViewerSize({
        tutorialCallout: {
          focus: "close-module",
          title: "Module preview",
          instruction: "Preview this module before continuing.",
        },
      })
    ).toBe(false)
    expect(
      shouldWorkspaceAcceleratorSyncModuleViewerSize({
        tutorialCallout: null,
        tutorialMode: "module-preview",
      })
    ).toBe(false)
  })

  it("falls back to the compact accelerator size when a closed viewer remounts without a stored collapsed size", () => {
    expect(
      resolveWorkspaceAcceleratorCollapsedCardSize({
        currentSize: "lg",
        previousCollapsedSize: null,
      })
    ).toBe("sm")
    expect(
      resolveWorkspaceAcceleratorCollapsedCardSize({
        currentSize: "lg",
        previousCollapsedSize: "md",
      })
    ).toBe("md")
    expect(
      resolveWorkspaceAcceleratorCollapsedCardSize({
        currentSize: "sm",
        previousCollapsedSize: null,
      })
    ).toBe("sm")
  })

  it("prefers the Welcome onboarding video for tutorial preview placeholders", () => {
    expect(
      resolveWorkspaceAcceleratorPlaceholderVideoUrl({
        currentStepId: "workspace-onboarding-organization-setup:lesson",
        steps: [
          {
            id: "nfp-registration:video",
            moduleId: "nfp-registration",
            moduleTitle: "NFP Registration",
            stepKind: "video",
            stepTitle: "NFP Registration",
            stepDescription: null,
            href: "/accelerator/class/formation/module/nfp-registration",
            status: "not_started",
            stepSequenceIndex: 3,
            stepSequenceTotal: 3,
            moduleSequenceIndex: 3,
            moduleSequenceTotal: 3,
            groupTitle: "Formation",
            videoUrl: "https://cdn.example.com/nfp-registration.mp4",
            durationMinutes: 8,
            resources: [],
            hasAssignment: false,
            hasDeck: false,
          },
          {
            id: "workspace-onboarding-welcome:lesson",
            moduleId: "workspace-onboarding-welcome",
            moduleTitle: "Welcome",
            stepKind: "lesson",
            stepTitle: "Welcome",
            stepDescription: null,
            href: "/accelerator/class/formation/module/welcome",
            status: "in_progress",
            stepSequenceIndex: 1,
            stepSequenceTotal: 1,
            moduleSequenceIndex: 1,
            moduleSequenceTotal: 1,
            groupTitle: "Formation",
            videoUrl: "https://cdn.example.com/welcome.mp4",
            durationMinutes: 5,
            resources: [],
            hasAssignment: false,
            hasDeck: false,
            moduleContext: {
              classTitle: "Formation",
              lessonNotesContent: null,
              moduleResources: [],
              assignmentFields: [],
              assignmentSubmission: null,
              completeOnSubmit: false,
              workspaceOnboarding: {
                view: "welcome",
                defaults: null,
              },
            },
          },
        ],
      })
    ).toBe("https://cdn.example.com/welcome.mp4")
  })

  it("keeps embedded accelerator progress out of the body so the frame header owns it", () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        RightRailProvider,
        null,
        React.createElement(WorkspaceAcceleratorCardPanel, {
          input: {
            steps: [
              {
                id: "formation-intro:video",
                moduleId: "formation-intro",
                moduleTitle: "Formation intro",
                stepKind: "video",
                stepTitle: "Video",
                stepDescription: null,
                href: "/accelerator/class/formation/module/intro",
                status: "in_progress",
                stepSequenceIndex: 1,
                stepSequenceTotal: 2,
                moduleSequenceIndex: 1,
                moduleSequenceTotal: 2,
                groupTitle: "Formation",
                videoUrl: "https://cdn.example.com/formation.mp4",
                durationMinutes: 5,
                resources: [],
                hasAssignment: false,
                hasDeck: false,
              },
              {
                id: "budgeting:video",
                moduleId: "budgeting",
                moduleTitle: "Budgeting",
                stepKind: "video",
                stepTitle: "Video",
                stepDescription: null,
                href: "/accelerator/class/strategic-foundations/module/budgeting",
                status: "in_progress",
                stepSequenceIndex: 2,
                stepSequenceTotal: 2,
                moduleSequenceIndex: 2,
                moduleSequenceTotal: 2,
                groupTitle: "Strategic Foundations",
                videoUrl: "https://cdn.example.com/budgeting.mp4",
                durationMinutes: 7,
                resources: [],
                hasAssignment: false,
                hasDeck: false,
              },
            ],
            size: "sm",
            readinessSummary: null,
            allowAutoResize: false,
            initialCurrentStepId: "budgeting:video",
            initialCompletedStepIds: ["formation-intro:video"],
          },
        })
      )
    )

    expect(markup).toContain("Strategic Foundations")
    expect(markup).not.toContain(
      'data-slot="workspace-accelerator-progress-percent"'
    )
    expect(markup).not.toContain(">Accelerator</p>")
  })

  it("shows locked overview progress and lessons without mounting a requested lesson viewer", () => {
    const markup = renderToStaticMarkup(React.createElement(RightRailProvider, null,
      React.createElement(WorkspaceAcceleratorCardPanel, {
        overviewOnly: true,
        workspaceOverviewNotice: React.createElement("p", null, "Upgrade to access"),
        presentationMode: "workspace-drawer",
        initialModuleViewerOpen: true,
        initialOpenModuleId: "naming",
        openStepRequest: { id: 1, stepId: "naming:video", moduleId: "naming" },
        input: {
          size: "lg", allowAutoResize: false,
          steps: [{ id: "naming:video", moduleId: "naming", moduleTitle: "Naming your NFP",
            stepKind: "video", stepTitle: "Naming your NFP", stepDescription: null,
            href: "/accelerator/class/formation/module/1", status: "not_started",
            stepSequenceIndex: 1, stepSequenceTotal: 1, moduleSequenceIndex: 1, moduleSequenceTotal: 1,
            groupTitle: "Formation", videoUrl: "https://example.com/paid-video.mp4",
            durationMinutes: 5, resources: [], hasAssignment: false, hasDeck: false }],
        },
      })))
    expect(markup).toContain("Naming your NFP")
    expect(markup).toContain('data-workspace-accelerator-drawer-header-controls="true"')
    expect(markup).toContain('inert=""')
    expect(markup).toContain("Upgrade to access")
    expect(markup).not.toContain("paid-video.mp4")
  })

  it("keeps the fullscreen accelerator panel on a full-height flex column for immersive onboarding routes", () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        RightRailProvider,
        null,
        React.createElement(WorkspaceAcceleratorCardPanel, {
          input: {
            steps: [
              {
                id: "workspace-onboarding-organization-setup:lesson",
                moduleId: "workspace-onboarding-organization-setup",
                moduleTitle: "Organization setup",
                stepKind: "lesson",
                stepTitle: "Organization setup",
                stepDescription: null,
                href: "/onboarding?source=formation-setup",
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
                moduleContext: {
                  classTitle: "Formation",
                  lessonNotesContent: null,
                  moduleResources: [],
                  assignmentFields: [],
                  assignmentSubmission: null,
                  completeOnSubmit: false,
                  workspaceOnboarding: {
                    view: "organization-setup",
                    defaults: null,
                  },
                },
              },
            ],
            size: "lg",
            readinessSummary: null,
            allowAutoResize: false,
            storageKey: "org:viewer",
            initialCurrentStepId:
              "workspace-onboarding-organization-setup:lesson",
            initialCompletedStepIds: [],
            onWorkspaceOnboardingSubmit: async () => undefined,
          },
          presentationMode: "fullscreen-route",
          initialModuleViewerOpen: true,
        })
      )
    )

    expect(markup).toContain(
      'class="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden"'
    )
    expect(markup).toContain('class="grid min-h-0 flex-1 gap-0 grid-cols-1"')
  })
})
