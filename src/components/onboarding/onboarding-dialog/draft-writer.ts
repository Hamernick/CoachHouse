import { type MutableRefObject } from "react"

import {
  collectDraftFlags,
  collectDraftValues,
  readDraftSnapshot,
  writeOnboardingDraft,
} from "@/components/onboarding/onboarding-dialog/draft"
import type {
  FormationStatus,
  IntentFocus,
  OnboardingDraft,
  Step,
  RoleInterest,
} from "@/components/onboarding/onboarding-dialog/types"

export type SaveOnboardingDraftExtra = Partial<{
  step: number
  formationStatus: FormationStatus | ""
  intentFocus: IntentFocus | ""
  roleInterest: RoleInterest | ""
  slugEdited: boolean
  avatar: string | null
}>

type WriteOnboardingDraftSnapshotArgs = {
  draftScope?: string | null
  formRef: MutableRefObject<HTMLFormElement | null>
  step: number
  steps: Pick<Step, "id">[]
  formationStatus: FormationStatus | ""
  intentFocus: IntentFocus | ""
  roleInterest: RoleInterest | ""
  slugEdited: boolean
  avatar: string | null
  extra?: SaveOnboardingDraftExtra
}

export function writeOnboardingDraftSnapshot({
  draftScope,
  formRef,
  step,
  steps,
  formationStatus,
  intentFocus,
  roleInterest,
  slugEdited,
  avatar,
  extra,
}: WriteOnboardingDraftSnapshotArgs) {
  if (typeof window === "undefined" || !formRef.current) return

  const form = formRef.current
  const data = new FormData(form)
  const { values: previousValues, flags: previousFlags } = readDraftSnapshot(draftScope)
  const nextValues = collectDraftValues(form, data, previousValues)
  const nextFlags = collectDraftFlags(form, previousFlags)
  if (extra?.intentFocus !== undefined) {
    nextValues.intentFocus = extra.intentFocus
  }
  if (extra?.roleInterest !== undefined) {
    nextValues.roleInterest = extra.roleInterest
  }

  const payload: OnboardingDraft = {
    step,
    formationStatus,
    intentFocus,
    roleInterest,
    slugEdited,
    avatar,
    values: nextValues,
    flags: nextFlags,
    ...(extra ?? {}),
    stepId: steps[extra?.step ?? step]?.id,
  }

  writeOnboardingDraft(payload, draftScope)
}
