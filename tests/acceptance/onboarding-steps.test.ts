import { afterEach, describe, expect, it, vi } from "vitest"

import { resolveOnboardingModeVisibleStepIds, filterOnboardingSteps } from "@/components/onboarding/onboarding-flow-support"
import { STEPS, MEMBER_STEPS } from "@/components/onboarding/onboarding-dialog/constants"
import { resolveOnboardingDraftStep, resolveOnboardingStepProgress } from "@/components/onboarding/onboarding-dialog/step-position"
import { writeOnboardingDraftSnapshot } from "@/components/onboarding/onboarding-dialog/draft-writer"
import { RESERVED_PUBLIC_ORGANIZATION_SLUGS } from "@/lib/organization/reserved-public-slugs"

describe("onboarding steps", () => {
  afterEach(() => vi.unstubAllGlobals())
  const workspaceSteps = STEPS.filter((step) => ["org", "account", "community"].includes(step.id))

  it("saves the destination identity when continuing a filtered setup flow", () => {
    const setItem = vi.fn()
    vi.stubGlobal("window", { localStorage: { getItem: () => null, setItem } })
    const NativeFormData = FormData
    vi.stubGlobal("FormData", class extends NativeFormData { constructor() { super() } })
    writeOnboardingDraftSnapshot({
      formRef: { current: { querySelector: () => null } as unknown as HTMLFormElement },
      step: 1,
      steps: workspaceSteps,
      formationStatus: "pre_501c3",
      intentFocus: "build",
      roleInterest: "",
      slugEdited: false,
      avatar: null,
      extra: { step: 2 },
    })
    const draft = JSON.parse(setItem.mock.calls[0][1])
    expect(draft.stepId).toBe("community")
    expect(resolveOnboardingDraftStep(draft, workspaceSteps, STEPS)).toBe(2)
  })

  it("resumes by identity when workspace setup has a shorter step list", () => {
    expect(resolveOnboardingDraftStep({ step: 2, stepId: "community" }, workspaceSteps, STEPS)).toBe(2)
    expect(resolveOnboardingDraftStep({ step: 1, stepId: "account" }, workspaceSteps, STEPS)).toBe(1)
    expect(resolveOnboardingDraftStep({ step: 3, stepId: "account" }, MEMBER_STEPS, STEPS)).toBe(1)
  })

  it("starts a different flow at its first relevant screen", () => {
    expect(resolveOnboardingDraftStep({ step: 1, stepId: "pricing" }, workspaceSteps, STEPS)).toBe(0)
    expect(resolveOnboardingDraftStep({ stepId: "org" }, MEMBER_STEPS, STEPS)).toBe(0)
  })

  it("keeps legacy draft compatibility and clamps invalid positions", () => {
    expect(resolveOnboardingDraftStep({ step: 3 }, workspaceSteps, STEPS)).toBe(1)
    expect(resolveOnboardingDraftStep({ step: 100 }, workspaceSteps, STEPS)).toBe(2)
    expect(resolveOnboardingDraftStep({ step: Number.NaN }, workspaceSteps, STEPS)).toBe(0)
    expect(resolveOnboardingDraftStep({}, [], STEPS)).toBe(0)
  })

  it("does not show completion before the final form is saved", () => {
    expect(resolveOnboardingStepProgress(0, 1)).toBe(0)
    expect(resolveOnboardingStepProgress(0, 3)).toBe(0)
    expect(resolveOnboardingStepProgress(1, 3)).toBe(33)
    expect(resolveOnboardingStepProgress(2, 3)).toBe(67)
    expect(resolveOnboardingStepProgress(5, 3)).toBe(67)
    expect(resolveOnboardingStepProgress(-1, 3)).toBe(0)
  })

  it("starts new builders with workspace basics then profile, without pricing", () => {
    const visibleStepIds = resolveOnboardingModeVisibleStepIds("post_signup_access")
    expect(filterOnboardingSteps({ intentFocus: "build", visibleStepIds }).map((step) => step.id)).toEqual(["intent", "account"])
    expect(resolveOnboardingDraftStep({ stepId: "pricing", step: 1 }, filterOnboardingSteps({ intentFocus: "build", visibleStepIds }), STEPS)).toBe(0)
  })

  it("keeps pricing and community as distinct onboarding steps", () => {
    expect(STEPS.map((step) => step.id)).toEqual([
      "intent",
      "pricing",
      "org",
      "account",
      "community",
    ])
  })

  it("reserves current app routes from public organization URLs", () => {
    for (const route of [
      "workspace",
      "find",
      "accelerator",
      "people",
      "documents",
      "marketplace",
    ]) {
      expect(RESERVED_PUBLIC_ORGANIZATION_SLUGS.has(route)).toBe(true)
    }
  })
})
