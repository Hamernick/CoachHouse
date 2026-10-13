"use client"

import * as React from "react"

import { OnboardingFlow } from "./onboarding-flow"
import { OnboardingDialogShell } from "./onboarding-dialog/components"
import type { OnboardingDialogProps } from "./onboarding-dialog/types"

export type { OnboardingDialogProps } from "./onboarding-dialog/types"

export function OnboardingDialog({
  open,
  onSubmit,
  presentation = "dialog",
  ...defaults
}: OnboardingDialogProps) {
  return (
    <OnboardingDialogShell open={open} presentation={presentation}>
      <OnboardingFlow
        key={defaults.draftScope ?? defaults.defaultEmail ?? "onboarding"}
        {...defaults}
        open={open}
        isInline={presentation === "inline"}
        onSubmit={onSubmit}
      />
    </OnboardingDialogShell>
  )
}
