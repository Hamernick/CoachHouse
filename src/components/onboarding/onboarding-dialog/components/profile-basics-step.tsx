"use client"

import { useEffect, useState, type RefObject } from "react"
import LoaderCircleIcon from "lucide-react/dist/esm/icons/loader-circle"
import { normalizePublicHandle, type PublicHandleAvailabilityStatus } from "@/features/public-profiles/client"
import Trash2Icon from "lucide-react/dist/esm/icons/trash-2"
import { getReactGrabOwnerProps } from "@/components/dev/react-grab-surface"
import PlusIcon from "lucide-react/dist/esm/icons/plus"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { OnboardingAccountValues } from "../state-helpers"

type ProfileBasicsStepProps = {
  values: OnboardingAccountValues
  avatarPreview: string | null
  avatarInputRef: RefObject<HTMLInputElement | null>
  submitting: boolean
  personHandleStatus: PublicHandleAvailabilityStatus
  personHandleHint: string | null
  personHandleError?: string
  onRemoveAvatar: () => void
}

export function ProfileBasicsStep({ values, avatarPreview, avatarInputRef, submitting, personHandleStatus, personHandleHint, personHandleError, onRemoveAvatar }: ProfileBasicsStepProps) {
  const fullName = [values.firstName, values.lastName].filter(Boolean).join(" ")
  const [name, setName] = useState(fullName)
  useEffect(() => {
    setName((previous) => previous.trim() === fullName.trim() ? previous : fullName)
  }, [fullName])
  return (
    <FieldGroup className="gap-4 py-4" data-onboarding-step-id="account">
      <input type="hidden" name="firstName" value={values.firstName} />
      <input type="hidden" name="lastName" value={values.lastName} />
      <input type="hidden" name="phone" value={values.phone} />
      <input type="hidden" name="publicEmail" value={values.publicEmail} />
      <input type="hidden" name="linkedin" value={values.linkedin} />
      <Field className="gap-2">
        <FieldLabel htmlFor="profileName">Name &amp; picture</FieldLabel>
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative size-11 shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button type="button" variant="outline" size="icon" disabled={submitting}
                aria-label={avatarPreview ? "Change profile photo" : "Upload profile photo"}
                onClick={() => avatarInputRef.current?.click()}
                className="size-11 shrink-0 overflow-hidden rounded-full p-0 shadow-none">
                {avatarPreview ? <Avatar className="size-full"><AvatarImage src={avatarPreview} alt="Profile photo" /><AvatarFallback>{fullName.charAt(0) || "+"}</AvatarFallback></Avatar> : <PlusIcon aria-hidden />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{avatarPreview ? "Change photo" : "Upload a photo"}</TooltipContent>
          </Tooltip>
          {avatarPreview ? (
            <Button
              {...getReactGrabOwnerProps({ ownerId: "onboarding:remove-photo", component: "ProfileBasicsStep", source: "src/components/onboarding/onboarding-dialog/components/profile-basics-step.tsx", slot: "remove-photo" })}
              type="button" variant="outline" size="icon"
              onClick={onRemoveAvatar} disabled={submitting}
              aria-label="Remove profile photo" title="Remove photo"
              className="absolute -right-1 -bottom-1 z-10 size-6 rounded-full bg-background p-0 shadow-none dark:bg-background dark:hover:bg-accent">
              <Trash2Icon className="size-3" aria-hidden />
            </Button>
          ) : null}
          </div>
          <Input id="profileName" name="profileName" autoComplete="name" placeholder="Enter your name…"
            className="h-11 min-w-0 rounded-lg" data-onboarding-primary-focus="true" disabled={submitting}
            value={name}
            onChange={(event) => {
              setName(event.currentTarget.value)
              // Keep the existing separate name fields and draft persistence contract.
              const [firstName = "", ...lastName] = event.currentTarget.value.split(" ")
              const form = event.currentTarget.form
              const first = form?.querySelector<HTMLInputElement>('input[name="firstName"]')
              const last = form?.querySelector<HTMLInputElement>('input[name="lastName"]')
              if (first) first.value = firstName
              if (last) last.value = lastName.join(" ")
            }}
          />
        </div>
      </Field>
      <Field className="gap-2">
        <FieldLabel htmlFor="personHandle">Username</FieldLabel>
        <div className="border-input flex min-w-0 items-center gap-1 rounded-lg border p-1 focus-within:ring-2 focus-within:ring-ring/50">
          <span className="text-muted-foreground pl-2 text-sm" aria-hidden>@</span>
          <Input id="personHandle" name="personHandle" required autoComplete="username" autoCapitalize="none" spellCheck={false}
            placeholder="your-name" defaultValue={values.personHandle} disabled={submitting}
            className="h-9 min-w-0 flex-1 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
            aria-invalid={Boolean(personHandleError) || personHandleStatus === "unavailable"}
            aria-describedby="profile-username-status"
            onChange={(event) => { event.currentTarget.value = normalizePublicHandle(event.currentTarget.value) }} />
          {personHandleStatus === "checking" ? <LoaderCircleIcon className="text-muted-foreground mr-2 size-4 shrink-0 motion-safe:animate-spin" aria-hidden /> : null}
        </div>
        <p id="profile-username-status" role="status" aria-live="polite"
          className={personHandleError || personHandleStatus === "unavailable" ? "text-destructive text-xs" : personHandleStatus === "available" ? "text-emerald-700 dark:text-emerald-300 text-xs" : "text-muted-foreground text-xs"}>
          {personHandleError || (personHandleStatus === "checking" ? "Checking availability…" : personHandleStatus === "available" ? "Username available" : personHandleHint ?? "Your profile address: coachhouse.app/username")}
        </p>
      </Field>
      <Field className="gap-2">
        <FieldLabel htmlFor="title">Title <span className="text-muted-foreground font-normal">(optional)</span></FieldLabel>
        <Input id="title" name="title" autoComplete="organization-title" placeholder="Founder, board member, team member…"
          className="h-11 rounded-lg" defaultValue={values.title} disabled={submitting} />
      </Field>
    </FieldGroup>
  )
}
