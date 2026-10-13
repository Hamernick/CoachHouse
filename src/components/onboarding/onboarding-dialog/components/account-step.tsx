"use client"

import type { RefObject } from "react"
import Image from "next/image"
import CameraIcon from "lucide-react/dist/esm/icons/camera"
import Trash2Icon from "lucide-react/dist/esm/icons/trash-2"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  normalizePublicHandle,
  type PublicHandleAvailabilityStatus,
} from "@/features/public-profiles/client"

type AccountStepProps = {
  step: number
  attemptedStep: number | null
  errors: Record<string, string>
  avatarPreview: string | null
  avatarInputRef: RefObject<HTMLInputElement | null>
  submitting: boolean
  initialFirstName: string
  initialLastName: string
  initialPersonHandle: string
  personHandleStatus: PublicHandleAvailabilityStatus
  personHandleHint: string | null
  initialPhone: string
  initialPublicEmail: string
  initialTitle: string
  initialLinkedin: string
  initialOptInUpdates: boolean
  initialNewsletterOptIn: boolean
  onRemoveAvatar: () => void
}

export function AccountStep({
  step,
  attemptedStep,
  errors,
  avatarPreview,
  avatarInputRef,
  submitting,
  initialFirstName,
  initialLastName,
  initialPersonHandle,
  personHandleStatus,
  personHandleHint,
  initialPhone,
  initialPublicEmail,
  initialTitle,
  initialLinkedin,
  initialOptInUpdates,
  initialNewsletterOptIn,
  onRemoveAvatar,
}: AccountStepProps) {
  const avatarHintId = "onboarding-avatar-hint"
  const firstNameErrorId = "onboarding-first-name-error"
  const lastNameErrorId = "onboarding-last-name-error"
  const personHandleErrorId = "onboarding-person-handle-error"
  const personHandleHintId = "onboarding-person-handle-hint"
  const personHandleStatusId = "onboarding-person-handle-status"
  const phoneHintId = "onboarding-phone-hint"
  const publicEmailHintId = "onboarding-public-email-hint"
  const showFirstNameError = attemptedStep === step && Boolean(errors.firstName)
  const showLastNameError = attemptedStep === step && Boolean(errors.lastName)
  const showPersonHandleError =
    attemptedStep === step && Boolean(errors.personHandle)
  const personHandleDescription = [
    showPersonHandleError ? personHandleErrorId : personHandleHintId,
    personHandleStatus === "available" || personHandleStatus === "checking"
      ? personHandleStatusId
      : null,
  ]
    .filter(Boolean)
    .join(" ")

  return (
    <div className="space-y-5 py-5" data-onboarding-step-id="account">
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative size-16 shrink-0">
          <div className="border-border bg-card h-full w-full overflow-hidden rounded-full border">
            {avatarPreview ? (
              <Image
                src={avatarPreview}
                alt="Avatar preview"
                width={64}
                height={64}
                className="h-full w-full object-cover"
                unoptimized
              />
            ) : (
              <div className="text-muted-foreground flex h-full w-full items-center justify-center text-sm font-semibold">
                CH
              </div>
            )}
          </div>
          <Button
            type="button"
            size="icon"
            variant="secondary"
            aria-label={
              avatarPreview ? "Change profile photo" : "Upload profile photo"
            }
            aria-describedby={avatarHintId}
            onClick={() => avatarInputRef.current?.click()}
            className="absolute -right-1 -bottom-1 z-10 h-7 w-7 rounded-full after:absolute after:-inset-2 after:content-['']"
          >
            <CameraIcon className="h-3.5 w-3.5" aria-hidden />
          </Button>
        </div>
        <div id={avatarHintId} className="text-muted-foreground text-xs">
          <p className="text-foreground text-sm font-medium">Profile photo</p>
          <p className="mt-1">Optional. You can add one later.</p>
        </div>
        {avatarPreview ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={submitting}
            onClick={onRemoveAvatar}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2Icon className="h-4 w-4" aria-hidden />
            Remove photo
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="firstName">First name</Label>
          <Input
            id="firstName"
            name="firstName"
            autoComplete="given-name"
            className="h-11"
            data-onboarding-primary-focus="true"
            defaultValue={initialFirstName}
            aria-invalid={attemptedStep === step && Boolean(errors.firstName)}
            aria-describedby={showFirstNameError ? firstNameErrorId : undefined}
          />
          {attemptedStep === step && errors.firstName ? (
            <p
              id={firstNameErrorId}
              className="text-destructive text-xs"
              role="alert"
            >
              {errors.firstName}
            </p>
          ) : null}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="lastName">Last name</Label>
          <Input
            id="lastName"
            name="lastName"
            autoComplete="family-name"
            className="h-11"
            defaultValue={initialLastName}
            aria-invalid={attemptedStep === step && Boolean(errors.lastName)}
            aria-describedby={showLastNameError ? lastNameErrorId : undefined}
          />
          {attemptedStep === step && errors.lastName ? (
            <p
              id={lastNameErrorId}
              className="text-destructive text-xs"
              role="alert"
            >
              {errors.lastName}
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="personHandle">Username</Label>
        <div className="border-border/70 bg-background flex min-w-0 flex-wrap items-center gap-2 rounded-xl border px-3 py-1.5">
          <span className="text-muted-foreground shrink-0 text-sm">
            coachhouse.app/
          </span>
          <Input
            id="personHandle"
            name="personHandle"
            autoCapitalize="none"
            autoComplete="username"
            inputMode="text"
            spellCheck={false}
            placeholder="your-name…"
            defaultValue={initialPersonHandle}
            className="h-9 min-w-[8rem] flex-1 border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0 md:text-sm"
            aria-invalid={showPersonHandleError}
            aria-describedby={personHandleDescription}
            onChange={(event) => {
              event.currentTarget.value = normalizePublicHandle(
                event.currentTarget.value
              )
            }}
          />
          {personHandleStatus === "available" ? (
            <span
              id={personHandleStatusId}
              className="text-xs font-medium text-emerald-700 dark:text-emerald-300"
              role="status"
            >
              Available
            </span>
          ) : personHandleStatus === "checking" ? (
            <span
              id={personHandleStatusId}
              className="text-muted-foreground text-xs"
              role="status"
            >
              Checking…
            </span>
          ) : null}
        </div>
        {showPersonHandleError ? (
          <p
            id={personHandleErrorId}
            className="text-destructive text-xs"
            role="alert"
          >
            {errors.personHandle}
          </p>
        ) : (
          <p id={personHandleHintId} className="text-muted-foreground text-xs">
            {personHandleHint ??
              "Claims your profile URL. Your profile stays private until you publish it."}
          </p>
        )}
      </div>

      <div className="border-border/70 border-t pt-5">
        <h3 className="text-sm font-medium">More about you <span className="text-muted-foreground font-normal">(optional)</span></h3>
        <p className="text-muted-foreground mt-1 text-xs">You can add these details later in your account settings.</p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="phone">Phone (optional)</Label>
        <Input
          id="phone"
          name="phone"
          autoComplete="tel"
          className="h-11"
          type="tel"
          placeholder="(555) 555-5555"
          defaultValue={initialPhone}
          aria-describedby={phoneHintId}
        />
        <p
          id={phoneHintId}
          className="text-muted-foreground min-h-8 text-xs leading-4"
        >
          Optional.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="publicEmail">
            Public contact email{" "}
            <span className="text-muted-foreground">(public)</span>
          </Label>
          <Input
            id="publicEmail"
            name="publicEmail"
            autoComplete="email"
            className="h-11"
            type="email"
            placeholder="contact@yourorg.org"
            defaultValue={initialPublicEmail}
            aria-describedby={publicEmailHintId}
          />
          <p id={publicEmailHintId} className="text-muted-foreground text-xs">
            Shown on your workspace/profile for collaborators.
          </p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="title">Title (optional)</Label>
          <Input
            id="title"
            name="title"
            autoComplete="organization-title"
            className="h-11"
            placeholder="Founder, Executive Director, etc."
            defaultValue={initialTitle}
          />
          <p className="invisible text-xs">Optional.</p>
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="linkedin">LinkedIn (optional)</Label>
        <Input
          id="linkedin"
          name="linkedin"
          autoCapitalize="none"
          spellCheck={false}
          className="h-11"
          placeholder="https://linkedin.com/in/…"
          defaultValue={initialLinkedin}
        />
      </div>

      <div className="border-border/70 bg-background/60 space-y-3 rounded-2xl border p-4">
        <div className="flex items-start gap-3 text-sm">
          <Checkbox
            id="optInUpdates"
            name="optInUpdates"
            defaultChecked={initialOptInUpdates}
            className="mt-1"
          />
          <Label htmlFor="optInUpdates" className="space-y-0.5 text-sm">
            <span className="text-foreground block font-medium">
              Product updates
            </span>
            <span className="text-muted-foreground block text-xs">
              Tips, release notes, and announcements.
            </span>
          </Label>
        </div>
        <div className="flex items-start gap-3 text-sm">
          <Checkbox
            id="newsletterOptIn"
            name="newsletterOptIn"
            defaultChecked={initialNewsletterOptIn}
            className="mt-1"
          />
          <Label htmlFor="newsletterOptIn" className="space-y-0.5 text-sm">
            <span className="text-foreground block font-medium">
              Newsletter
            </span>
            <span className="text-muted-foreground block text-xs">
              Curated learning resources and community updates.
            </span>
          </Label>
        </div>
      </div>
    </div>
  )
}
