import type { OnboardingDraft, Step } from "./types"

export function resolveOnboardingDraftStep(
  draft: Pick<OnboardingDraft, "step" | "stepId">,
  visibleSteps: Pick<Step, "id">[],
  legacySteps: Pick<Step, "id">[],
) {
  if (draft.stepId) {
    const index = visibleSteps.findIndex((step) => step.id === draft.stepId)
    // A different flow must start at its first relevant step.
    return Math.max(0, index)
  }
  const savedIndex = typeof draft.step === "number" && Number.isInteger(draft.step)
    ? Math.max(0, draft.step)
    : 0
  const legacyId = legacySteps[savedIndex]?.id
  const index = visibleSteps.findIndex((step) => step.id === legacyId)
  return index >= 0 ? index : Math.min(savedIndex, Math.max(0, visibleSteps.length - 1))
}

export function resolveOnboardingStepProgress(step: number, totalSteps: number) {
  if (totalSteps < 1 || !Number.isFinite(step)) return 0
  // Reaching the last form is not a successful save.
  const completedSteps = Math.max(0, Math.min(Math.floor(step), totalSteps - 1))
  return Math.round((completedSteps / totalSteps) * 100)
}
