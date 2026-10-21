"use client"

import { useWorkspaceEditorStatus } from "@/components/workspace/workspace-editor-status"

import * as React from "react"
import { useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useOnboardingSubmission } from "./onboarding-dialog/hooks/use-onboarding-submission"

import type { PricingPlanTier } from "@/lib/billing/plan-tier"
import { OnboardingDialogContent } from "./onboarding-dialog/components"
import { writeOnboardingDraftSnapshot } from "./onboarding-dialog/draft-writer"
import type { SaveOnboardingDraftExtra } from "./onboarding-dialog/draft-writer"
import { resolveOnboardingPricingPlanOverride } from "./onboarding-dialog/helpers"
import { useOnboardingAvatar } from "./onboarding-dialog/hooks/use-onboarding-avatar"
import { useAutoSubmitPaidPricingReturn } from "./onboarding-dialog/hooks/use-auto-submit-paid-pricing-return"
import { useOnboardingDefaults } from "./onboarding-dialog/hooks/use-onboarding-defaults"
import { useOnboardingCarryForwardRefs } from "./onboarding-dialog/hooks/use-onboarding-carry-forward-refs"
import { useOnboardingDraftState } from "./onboarding-dialog/hooks/use-onboarding-draft-state"
import { useOnboardingFieldHandlers } from "./onboarding-dialog/hooks/use-onboarding-field-handlers"
import {
  useOnboardingAccountStateSync,
  useOnboardingStateSnapshot,
  useOnboardingStepFocus,
} from "./onboarding-dialog/hooks/use-onboarding-flow-state-sync"
import { useOnboardingProgress } from "./onboarding-dialog/hooks/use-onboarding-progress"
import { useSlugAvailability } from "./onboarding-dialog/hooks/use-slug-availability"
import {
  buildAccountValuesFromDefaults,
  useEffectiveOnboardingStepIds,
  useOnboardingAccountSetupState,
  useResolvedOnboardingSteps,
} from "./onboarding-dialog/hooks/use-onboarding-flow-derived-state"
import type {
  FormationStatus,
  IntentFocus,
  OnboardingFlowMode,
  OnboardingFlowDefaults,
  OnboardingFlowVisibleStepId,
  RoleInterest,
} from "./onboarding-dialog/types"
import {
  buildOnboardingFormHandlers,
  buildOnboardingStepControls,
  useApplyPricingEntryPoint,
  useSyncOnboardingServerError,
} from "./onboarding-flow-support"

type OnboardingFlowProps = OnboardingFlowDefaults & {
  open?: boolean
  isInline: boolean
  onSubmit: (form: FormData) => Promise<void>
  mode?: OnboardingFlowMode
  visibleStepIds?: OnboardingFlowVisibleStepId[]
}

export function OnboardingFlow({
  open = true,
  isInline,
  mode = "full",
  draftScope: accountDraftScope,
  defaultBuilderPlanTier = "free",
  onSubmit,
  visibleStepIds,
  ...defaults
}: OnboardingFlowProps) {
  const draftScope = accountDraftScope ? `${accountDraftScope}:${mode}` : null
  const effectiveVisibleStepIds = useEffectiveOnboardingStepIds(
    mode,
    visibleStepIds
  )
  const intentFocusOverride: IntentFocus | null =
    mode === "workspace_setup" || mode === "post_signup_access" ? "build" : null
  const onboardingDefaults = useOnboardingDefaults(defaults)
  const {
    initialOrgName,
    initialOrgSlug,
    initialFormationStatus,
    initialIntentFocus,
    initialRoleInterest,
    initialFirstName,
    initialLastName,
    initialPersonHandle,
    initialPhone,
    initialPublicEmail,
    initialTitle,
    initialLinkedin,
    initialAvatarUrl,
    initialOptInUpdates,
    initialNewsletterOptIn,
    resolveDraftFieldValue,
  } = onboardingDefaults
  const searchParams = useSearchParams()
  const checkoutPlanOverride =
    resolveOnboardingPricingPlanOverride(searchParams)
  const [step, setStep] = useState(0)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [slugEdited, setSlugEdited] = useState(Boolean(initialOrgSlug))
  const [orgNameValue, setOrgNameValue] = useState(initialOrgName)
  const [orgSlugInputValue, setOrgSlugInputValue] = useState(initialOrgSlug)
  const [slugValue, setSlugValue] = useState(initialOrgSlug)
  const [formationStatus, setFormationStatus] = useState<FormationStatus | "">(
    initialFormationStatus
  )
  const [intentFocus, setIntentFocus] = useState<IntentFocus | "">(
    intentFocusOverride ?? initialIntentFocus
  )
  const [roleInterest, setRoleInterest] = useState<RoleInterest | "">(
    initialRoleInterest
  )
  const builderPlanTier: PricingPlanTier =
    checkoutPlanOverride ?? defaultBuilderPlanTier ?? "free"
  const [submitting, setSubmitting] = useState(false)
  const [attemptedStep, setAttemptedStep] = useState<number | null>(null)
  const {
    accountValues,
    setAccountValues,
    setAccountStepReady,
    accountStepReady,
    personHandleStatus,
    personHandleHint,
  } = useOnboardingAccountSetupState({
    open,
    initialPersonHandle,
    initialValues: buildAccountValuesFromDefaults(onboardingDefaults),
  })
  useWorkspaceEditorStatus({
    label: "Organization setup",
    dirty:
      open &&
      (orgNameValue !== initialOrgName ||
        slugValue !== initialOrgSlug ||
        formationStatus !== initialFormationStatus ||
        intentFocus !== (intentFocusOverride ?? initialIntentFocus) ||
        roleInterest !== initialRoleInterest ||
        JSON.stringify(accountValues) !==
          JSON.stringify(buildAccountValuesFromDefaults(onboardingDefaults))),
    pending: open && submitting,
    error: open && Boolean(serverError),
  })
  const latestOrganizationValuesRef = useRef({
    orgName: initialOrgName,
    orgSlug: initialOrgSlug,
  })
  const latestAccountValuesRef = useRef(accountValues)
  const formRef = useRef<HTMLFormElement | null>(null)
  const avatarInputRef = useRef<HTMLInputElement | null>(null)
  const { steps, currentStep, stepProgress } = useResolvedOnboardingSteps({
    intentFocus,
    visibleStepIds: effectiveVisibleStepIds,
    step,
  })
  const { slugStatus, slugHint } = useSlugAvailability({ open, slugValue })
  const { syncProgress } = useOnboardingProgress({
    open,
    formRef,
    intentFocus,
    formationStatus,
    slugStatus,
  })
  const saveDraft = (extra?: SaveOnboardingDraftExtra) => {
    if (!draftScope) return
    writeOnboardingDraftSnapshot({
      draftScope,
      formRef,
      step,
      steps,
      formationStatus,
      intentFocus,
      roleInterest,
      slugEdited,
      avatar: avatarPreview,
      extra,
    })
  }
  const { syncAccountStateFromForm, syncOrganizationStateFromForm } =
    useOnboardingStateSnapshot({
      formRef,
      setAccountStepReady,
      setAccountValues,
      setOrgNameValue,
      setOrgSlugInputValue,
      setSlugValue,
      accountValuesRef: latestAccountValuesRef,
      organizationValuesRef: latestOrganizationValuesRef,
    })
  useOnboardingCarryForwardRefs({
    accountValues,
    accountValuesRef: latestAccountValuesRef,
    orgNameValue,
    orgSlugInputValue,
    slugValue,
    organizationValuesRef: latestOrganizationValuesRef,
  })
  const {
    avatarPreview,
    crop,
    cropOpen,
    handleApplyCrop,
    handleAvatarSelect,
    rawImageUrl,
    removeAvatar,
    setAvatarPreview,
    setCrop,
    setCropOpen,
    setCroppedArea,
    setZoom,
    zoom,
  } = useOnboardingAvatar({
    initialAvatarUrl,
    formRef,
    saveDraft,
  })
  useOnboardingDraftState({
    draftScope,
    // Saved organization details take precedence when revisiting setup.
    open: open && Boolean(draftScope),
    step,
    formRef,
    resolveDraftFieldValue,
    visibleStepIds: effectiveVisibleStepIds,
    intentFocusOverride,
    setStep,
    setFormationStatus,
    setIntentFocus,
    setRoleInterest,
    setSlugEdited,
    setAvatarPreview,
    setAccountStepReady,
    setAccountValues,
    setOrgNameValue,
    setOrgSlugInputValue,
    setSlugValue,
    syncProgress,
  })
  useSyncOnboardingServerError({ open, searchParams, setServerError })
  useApplyPricingEntryPoint({
    open,
    searchParams,
    mode,
    setIntentFocus,
    setStep,
    visibleStepIds: effectiveVisibleStepIds,
  })
  useAutoSubmitPaidPricingReturn({
    open,
    submitting,
    currentStepId: currentStep.id,
    searchParams,
    mode,
    builderPlanTier,
    formRef,
  })
  useEffect(() => {
    setAttemptedStep(null)
    setErrors({})
  }, [step])
  useEffect(() => {
    if (step <= steps.length - 1) return
    setStep(steps.length - 1)
  }, [step, steps.length])
  useOnboardingStepFocus({
    open,
    currentStepId: currentStep.id,
    formRef,
  })
  useOnboardingAccountStateSync({
    open,
    step,
    formRef,
    syncAccountStateFromForm,
  })
  const { validateStep, next, prev } = buildOnboardingStepControls({
    formRef,
    step,
    steps,
    currentStepId: currentStep.id,
    formationStatus,
    intentFocus,
    slugStatus,
    slugHint,
    personHandleStatus,
    personHandleHint,
    builderPlanTier,
    syncOrganizationStateFromForm,
    syncAccountStateFromForm,
    saveDraft,
    setServerError,
    setErrors,
    setAttemptedStep,
    setStep,
  })
  const { handleFormChange, handleFormSubmit } = buildOnboardingFormHandlers({
    step,
    steps,
    attemptedStep,
    formRef,
    syncOrganizationStateFromForm,
    syncAccountStateFromForm,
    saveDraft,
    syncProgress,
    setErrors,
    setAttemptedStep,
    validateStep,
    next,
    setSubmitting,
    intentFocus,
    roleInterest,
    formationStatus,
    organizationValuesRef: latestOrganizationValuesRef,
    accountValuesRef: latestAccountValuesRef,
  })
  const {
    handleFormationStatusSelect,
    handleIntentSelect,
    handleOrgNameChange,
    handleOrgSlugChange,
  } = useOnboardingFieldHandlers({
    formRef,
    slugEdited,
    saveDraft,
    syncProgress,
    setErrors,
    setFormationStatus,
    setIntentFocus,
    setOrgNameValue,
    setOrgSlugInputValue,
    setSlugEdited,
    setSlugValue,
  })
  const submitAction = useOnboardingSubmission({
    onSubmit,
    draftScope,
    setSubmitting,
    setServerError,
  })

  return (
    <OnboardingDialogContent
      formRef={formRef}
      avatarInputRef={avatarInputRef}
      step={step}
      totalSteps={steps.length}
      attemptedStep={attemptedStep}
      errors={errors}
      serverError={serverError}
      stepLabel={`Step ${step + 1} of ${steps.length}`}
      currentStep={currentStep}
      isInline={isInline}
      intentFocus={intentFocus}
      roleInterest={roleInterest}
      formationStatus={formationStatus}
      builderPlanTier={builderPlanTier}
      accountStepReady={accountStepReady}
      orgNameValue={orgNameValue}
      orgSlugInputValue={orgSlugInputValue}
      slugValue={slugValue}
      initialOrgName={orgNameValue}
      initialOrgSlug={orgSlugInputValue}
      slugStatus={slugStatus}
      slugHint={slugHint}
      personHandleStatus={personHandleStatus}
      personHandleHint={personHandleHint}
      initialFirstName={initialFirstName}
      initialLastName={initialLastName}
      initialPersonHandle={initialPersonHandle}
      initialPhone={initialPhone}
      initialPublicEmail={initialPublicEmail}
      initialTitle={initialTitle}
      initialLinkedin={initialLinkedin}
      initialOptInUpdates={initialOptInUpdates}
      initialNewsletterOptIn={initialNewsletterOptIn}
      accountValues={accountValues}
      avatarPreview={avatarPreview}
      submitting={submitting}
      progress={stepProgress}
      cropOpen={cropOpen}
      rawImageUrl={rawImageUrl}
      crop={crop}
      zoom={zoom}
      onFormChange={handleFormChange}
      onFormSubmit={handleFormSubmit}
      onboardingMode={mode}
      onPrev={prev}
      onNext={next}
      onSelectIntent={handleIntentSelect}
      onOrgNameChange={handleOrgNameChange}
      onOrgSlugChange={handleOrgSlugChange}
      onFormationStatusSelect={handleFormationStatusSelect}
      onAvatarSelect={handleAvatarSelect}
      onRemoveAvatar={removeAvatar}
      onCropOpenChange={setCropOpen}
      onCropChange={setCrop}
      onZoomChange={setZoom}
      onCropComplete={setCroppedArea}
      onApplyCrop={handleApplyCrop}
      onSubmitAction={submitAction}
    />
  )
}
