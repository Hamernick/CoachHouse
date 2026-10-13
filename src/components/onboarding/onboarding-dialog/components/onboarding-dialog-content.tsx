"use client"

import * as React from "react"
import LoaderCircleIcon from "lucide-react/dist/esm/icons/loader-circle"
import { useOnboardingStepTransition } from "../hooks/use-onboarding-step-transition"
import { cn } from "@/lib/utils"
import { ONBOARDING_PRICING_RETURN } from "@/lib/onboarding/pricing-return"
import type { PublicHandleAvailabilityStatus } from "@/features/public-profiles/client"

import { ProfileBasicsStep } from "./profile-basics-step"
import { AccountStep } from "./account-step"
import { AvatarCropDialog } from "./avatar-crop-dialog"
import { CommunityStep } from "./community-step"
import { IntentStep } from "./intent-step"
import { PricingStep } from "./pricing-step"
import { OrganizationStep } from "./organization-step"
import { StepFooter } from "./step-footer"
import { StepHeader } from "./step-header"
import type {
  FormationStatus,
  OnboardingFlowMode,
  IntentFocus,
  OnboardingSlugStatus,
  RoleInterest,
  Step,
} from "../types"

type CropArea = {
  x: number
  y: number
  width: number
  height: number
}

type OnboardingDialogContentProps = {
  formRef: React.RefObject<HTMLFormElement | null>
  avatarInputRef: React.RefObject<HTMLInputElement | null>
  step: number
  totalSteps: number
  attemptedStep: number | null
  errors: Record<string, string>
  serverError: string | null
  stepLabel: string
  currentStep: Step
  isInline: boolean
  intentFocus: IntentFocus | ""
  roleInterest: RoleInterest | ""
  formationStatus: FormationStatus | ""
  builderPlanTier: "free" | "organization" | "operations_support"
  accountStepReady: boolean
  orgNameValue: string
  orgSlugInputValue: string
  slugValue: string
  initialOrgName: string
  initialOrgSlug: string
  slugStatus: OnboardingSlugStatus
  slugHint: string | null
  personHandleStatus: PublicHandleAvailabilityStatus
  personHandleHint: string | null
  initialFirstName: string
  initialLastName: string
  initialPersonHandle: string
  initialPhone: string
  initialPublicEmail: string
  initialTitle: string
  initialLinkedin: string
  initialOptInUpdates: boolean
  initialNewsletterOptIn: boolean
  accountValues: {
    firstName: string
    lastName: string
    personHandle: string
    phone: string
    publicEmail: string
    title: string
    linkedin: string
    optInUpdates: boolean
    newsletterOptIn: boolean
  }
  avatarPreview: string | null
  submitting: boolean
  progress: number
  cropOpen: boolean
  rawImageUrl: string | null
  crop: { x: number; y: number }
  zoom: number
  onFormChange: () => void
  onFormSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  onboardingMode: OnboardingFlowMode
  onPrev: () => void
  onNext: () => void
  onSelectIntent: (value: IntentFocus) => void
  onOrgNameChange: (value: string) => void
  onOrgSlugChange: (value: string) => string
  onFormationStatusSelect: (value: FormationStatus) => void
  onAvatarSelect: (file: File) => void
  onRemoveAvatar: () => void
  onCropOpenChange: (open: boolean) => void
  onCropChange: (crop: { x: number; y: number }) => void
  onZoomChange: (zoom: number) => void
  onCropComplete: (area: CropArea) => void
  onApplyCrop: () => Promise<void>
  onSubmitAction: (form: FormData) => Promise<void>
}

export function OnboardingDialogContent({
  formRef,
  avatarInputRef,
  step,
  totalSteps,
  attemptedStep,
  errors,
  serverError,
  stepLabel,
  currentStep,
  isInline,
  intentFocus,
  roleInterest,
  formationStatus,
  builderPlanTier,
  accountStepReady,
  orgNameValue,
  orgSlugInputValue,
  slugValue,
  initialOrgName,
  initialOrgSlug,
  slugStatus,
  slugHint,
  personHandleStatus,
  personHandleHint,
  initialFirstName,
  initialLastName,
  initialPersonHandle,
  initialPhone,
  initialPublicEmail,
  initialTitle,
  initialLinkedin,
  initialOptInUpdates,
  initialNewsletterOptIn,
  accountValues,
  avatarPreview,
  submitting,
  progress,
  cropOpen,
  rawImageUrl,
  crop,
  zoom,
  onFormChange,
  onFormSubmit,
  onboardingMode,
  onPrev,
  onNext,
  onSelectIntent,
  onOrgNameChange,
  onOrgSlugChange,
  onFormationStatusSelect,
  onAvatarSelect,
  onRemoveAvatar,
  onCropOpenChange,
  onCropChange,
  onZoomChange,
  onCropComplete,
  onApplyCrop,
  onSubmitAction,
}: OnboardingDialogContentProps) {
  useOnboardingStepTransition(formRef, step)
  const showOrganizationBasics = currentStep.id === "intent" && onboardingMode === "post_signup_access" && intentFocus === "build"
  const showOrganizationFields = currentStep.id === "org" || showOrganizationBasics
  const compactIntro = currentStep.id === "intent" && onboardingMode === "post_signup_access"
  const compactProfile = currentStep.id === "account" && onboardingMode === "post_signup_access"
  const compactSetup = compactIntro || compactProfile
  const displayedStep = showOrganizationBasics
    ? { ...currentStep, title: "Create your workspace", description: "Give your organization a name and a home." }
    : compactProfile
      ? { ...currentStep, title: "Set up your profile", description: "Choose how you’ll appear in Coach House." }
      : currentStep
  return (
    <>
      <form
        ref={formRef}
        aria-busy={submitting}
        data-onboarding-compact={compactSetup || undefined}
        action={onSubmitAction}
        className="nodrag nopan relative flex h-full min-h-0 flex-1 flex-col space-y-0"
        onChange={onFormChange}
        onSubmit={onFormSubmit}
      >
        <input
          id="avatar"
          name="avatar"
          ref={avatarInputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0]
            if (!file) return
            onAvatarSelect(file)
          }}
        />
        <StepHeader
          stepLabel={stepLabel}
          currentStep={displayedStep}
          compact={compactSetup}
          isInline={isInline}
          progress={progress}
        />

        <div
          data-onboarding-motion
          data-onboarding-scroll-region="true"
          className={cn(
            "nodrag nopan min-h-0 flex-1 [scroll-padding-bottom:8rem] overflow-y-auto px-4 py-0 md:px-6",
            isInline ? "overscroll-auto" : "overscroll-contain",
            compactSetup && "md:px-4",
          )}
        >
          <div className={cn("mx-auto w-full max-w-[640px] space-y-4 pb-4", compactSetup && "max-w-none")}>
            <input type="hidden" name="intentFocus" value={intentFocus} />
            <input type="hidden" name="onboardingMode" value={onboardingMode} />
            {onboardingMode === "post_signup_access" ? <input type="hidden" name="onboardingVersion" value="workspace_profile" /> : null}
            <input type="hidden" name="roleInterest" value={roleInterest} />
            <input
              type="hidden"
              name="formationStatus"
              value={formationStatus}
            />
            <input
              type="hidden"
              name="builderPlanTier"
              value={builderPlanTier}
            />
            {!showOrganizationFields ? (
              <>
                <input type="hidden" name="orgName" value={orgNameValue} />
                <input
                  type="hidden"
                  name="orgSlug"
                  value={orgSlugInputValue || slugValue}
                />
              </>
            ) : null}
            {currentStep.id !== "account" ? (
              <>
                <input
                  type="hidden"
                  name="firstName"
                  value={accountValues.firstName}
                />
                <input
                  type="hidden"
                  name="lastName"
                  value={accountValues.lastName}
                />
                <input
                  type="hidden"
                  name="personHandle"
                  value={accountValues.personHandle}
                />
                <input type="hidden" name="phone" value={accountValues.phone} />
                <input
                  type="hidden"
                  name="publicEmail"
                  value={accountValues.publicEmail}
                />
                <input type="hidden" name="title" value={accountValues.title} />
                <input
                  type="hidden"
                  name="linkedin"
                  value={accountValues.linkedin}
                />
                {accountValues.optInUpdates ? (
                  <input type="hidden" name="optInUpdates" value="on" />
                ) : null}
                {accountValues.newsletterOptIn ? (
                  <input type="hidden" name="newsletterOptIn" value="on" />
                ) : null}
              </>
            ) : null}

            {serverError ? (
              <div
                className="border-destructive/30 bg-destructive/10 text-destructive mt-5 rounded-xl border px-4 py-3 text-sm"
                role="alert"
              >
                {serverError}
              </div>
            ) : null}

            {currentStep.id === "intent" && !compactIntro ? (
              <IntentStep
                step={step}
                attemptedStep={attemptedStep}
                errors={errors}
                intentFocus={intentFocus}
                onSelectIntent={onSelectIntent}
              />
            ) : null}

            {showOrganizationFields ? (
              <div data-onboarding-step-id={compactIntro ? "intent" : undefined} className={compactIntro ? "pt-4" : undefined}>
              <OrganizationStep
                compact={showOrganizationBasics}
                hideFormationStatus={showOrganizationBasics}
                step={step}
                attemptedStep={attemptedStep}
                errors={errors}
                initialOrgName={initialOrgName}
                initialOrgSlug={initialOrgSlug}
                slugStatus={slugStatus}
                slugHint={slugHint}
                formationStatus={formationStatus}
                onOrgNameChange={onOrgNameChange}
                onOrgSlugChange={onOrgSlugChange}
                onFormationStatusSelect={onFormationStatusSelect}
              />
              </div>
            ) : null}

            {currentStep.id === "pricing" ? (
              <PricingStep
                step={step}
                attemptedStep={attemptedStep}
                errors={errors}
                currentPlanTier={builderPlanTier}
                checkoutReturnTo={ONBOARDING_PRICING_RETURN}
                onboardingMode={onboardingMode}
                submitting={submitting}
              />
            ) : null}

            {compactProfile ? (
              <ProfileBasicsStep personHandleStatus={personHandleStatus} personHandleHint={personHandleHint} personHandleError={attemptedStep === step ? errors.personHandle : undefined} values={accountValues} avatarPreview={avatarPreview} avatarInputRef={avatarInputRef} submitting={submitting} onRemoveAvatar={onRemoveAvatar} />
            ) : currentStep.id === "account" ? (
              <AccountStep
                step={step}
                attemptedStep={attemptedStep}
                errors={errors}
                avatarPreview={avatarPreview}
                avatarInputRef={avatarInputRef}
                submitting={submitting}
                initialFirstName={initialFirstName}
                initialLastName={initialLastName}
                initialPersonHandle={initialPersonHandle}
                personHandleStatus={personHandleStatus}
                personHandleHint={personHandleHint}
                initialPhone={initialPhone}
                initialPublicEmail={initialPublicEmail}
                initialTitle={initialTitle}
                initialLinkedin={initialLinkedin}
                initialOptInUpdates={initialOptInUpdates}
                initialNewsletterOptIn={initialNewsletterOptIn}
                onRemoveAvatar={onRemoveAvatar}
              />
            ) : null}

            {currentStep.id === "community" ? <CommunityStep /> : null}
          </div>
        </div>

        <StepFooter
          compact={compactSetup}
          step={step}
          totalSteps={totalSteps}
          submitting={submitting}
          currentStepId={currentStep.id}
          onboardingMode={onboardingMode}
          intentFocus={intentFocus}
          slugStatus={slugStatus}
          formationStatus={formationStatus}
          accountStepReady={accountStepReady}
          builderPlanTier={builderPlanTier}
          onPrev={onPrev}
          onNext={onNext}
        />
        {submitting && compactSetup ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-[inherit] bg-card p-6 text-center motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200" role="status" aria-live="polite">
            <LoaderCircleIcon className="size-5 text-muted-foreground motion-safe:animate-spin" aria-hidden />
            <div>
              <p className="text-sm font-medium">Saving your workspace…</p>
              <p className="mt-1 text-xs text-muted-foreground">We’ll take you there when it’s ready.</p>
            </div>
          </div>
        ) : null}
      </form>

      <AvatarCropDialog
        open={cropOpen}
        rawImageUrl={rawImageUrl}
        crop={crop}
        zoom={zoom}
        onOpenChange={onCropOpenChange}
        onCropChange={onCropChange}
        onZoomChange={onZoomChange}
        onCropComplete={onCropComplete}
        onApply={onApplyCrop}
      />
    </>
  )
}
