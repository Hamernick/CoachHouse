"use client"

import { useMemo, useState } from "react"
import { useFormStatus } from "react-dom"

import BellIcon from "lucide-react/dist/esm/icons/bell"
import Building2Icon from "lucide-react/dist/esm/icons/building-2"
import CheckIcon from "lucide-react/dist/esm/icons/check"
import ChevronRightIcon from "lucide-react/dist/esm/icons/chevron-right"
import HeartIcon from "lucide-react/dist/esm/icons/heart"
import MapPinnedIcon from "lucide-react/dist/esm/icons/map-pinned"
import PanelRightOpenIcon from "lucide-react/dist/esm/icons/panel-right-open"
import SearchIcon from "lucide-react/dist/esm/icons/search"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"

type MemberMapOnboardingIntent = "find" | "fund" | "support"

type MemberMapOnboardingStep = {
  id: "map" | "search" | "save" | "notifications" | "organizations"
  title: string
  body: string
}

export function buildPublicMapMemberOnboardingSteps({
  hasOrganizationSwitcher,
}: {
  hasOrganizationSwitcher: boolean
}): MemberMapOnboardingStep[] {
  return [
    {
      id: "map",
      title: "Welcome to Find",
      body: "Browse public organizations, programs, local services, and web resources from the latest directory updates.",
    },
    {
      id: "search",
      title: "Search the directory",
      body: "Search by organization, location, program, service, or focus area without leaving the map.",
    },
    {
      id: "save",
      title: "Save locations",
      body: "Create an account to save organizations and useful locations, keep a short list, and return later.",
    },
    {
      id: "notifications",
      title: "Notifications",
      body: "Notifications stay in the top bar for access requests, invites, and account updates.",
    },
    ...(hasOrganizationSwitcher
      ? [
          {
            id: "organizations" as const,
            title: "Switch organizations",
            body: "If you are invited to an organization, use the switcher in the sidebar header to move into that workspace.",
          },
        ]
      : []),
  ]
}

function StepVisual({ stepId }: { stepId: MemberMapOnboardingStep["id"] }) {
  if (stepId === "search") {
    return (
      <div className="border-border/70 bg-background/82 w-full max-w-[18rem] rounded-[28px] border p-3 shadow-sm">
        <div className="border-border/70 bg-muted/45 flex h-10 items-center gap-2 rounded-full border px-3">
          <SearchIcon className="text-muted-foreground size-4" aria-hidden />
          <span className="text-muted-foreground text-sm">
            Search resources
          </span>
        </div>
        <div className="mt-3 flex flex-col gap-2">
          {["Community kitchen", "Youth studio", "Housing support"].map(
            (label) => (
              <div
                key={label}
                className="border-border/55 bg-card/80 flex items-center justify-between rounded-2xl border px-3 py-2"
              >
                <span className="text-foreground truncate text-sm font-medium">
                  {label}
                </span>
                <span className="bg-foreground/18 size-2 rounded-full" />
              </div>
            )
          )}
        </div>
      </div>
    )
  }

  if (stepId === "save") {
    return (
      <div className="grid w-full max-w-[18rem] gap-3">
        <div className="border-border/70 bg-card/88 rounded-[26px] border p-4 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-foreground truncate text-sm font-semibold">
                Atlas Collective
              </p>
              <p className="text-muted-foreground mt-1 line-clamp-2 text-xs leading-relaxed">
                Neighborhood programs and mutual-aid resources.
              </p>
            </div>
            <div className="bg-foreground text-background grid size-10 shrink-0 place-items-center rounded-full">
              <HeartIcon className="size-4 fill-current" aria-hidden />
            </div>
          </div>
        </div>
        <div className="border-border/60 bg-background/78 rounded-[24px] border px-4 py-3">
          <div className="text-foreground flex items-center gap-2 text-sm font-medium">
            <HeartIcon className="size-4 fill-current" aria-hidden />
            <span>Saved organizations</span>
            <span className="border-border/70 text-muted-foreground ml-auto rounded-full border px-2 py-0.5 text-xs">
              1
            </span>
          </div>
        </div>
      </div>
    )
  }

  if (stepId === "notifications") {
    return (
      <div className="border-border/70 bg-background/84 w-full max-w-[18rem] rounded-[28px] border p-3 shadow-sm">
        <div className="border-border/55 flex items-center justify-end gap-2 border-b pb-3">
          <div className="border-border/70 bg-card grid size-9 place-items-center rounded-full border">
            <BellIcon className="text-foreground size-4" aria-hidden />
          </div>
        </div>
        <div className="flex flex-col gap-2 pt-3">
          <div className="border-border/60 bg-card/82 rounded-2xl border p-3">
            <p className="text-foreground text-sm font-medium">
              Access request
            </p>
            <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
              Review invites and updates from one place.
            </p>
          </div>
          <div className="border-border/70 bg-muted/25 h-12 rounded-2xl border border-dashed" />
        </div>
      </div>
    )
  }

  if (stepId === "organizations") {
    return (
      <div className="border-border/70 bg-background/84 w-full max-w-[18rem] rounded-[28px] border p-3 shadow-sm">
        <div className="border-border/65 bg-card/85 flex items-center gap-3 rounded-2xl border p-3">
          <div className="bg-foreground text-background grid size-10 place-items-center rounded-xl">
            <Building2Icon className="size-4" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-foreground truncate text-sm font-semibold">
              Current organization
            </p>
            <p className="text-muted-foreground truncate text-xs">
              2 organizations
            </p>
          </div>
          <ChevronRightIcon
            className="text-muted-foreground size-4"
            aria-hidden
          />
        </div>
        <div className="border-border/60 bg-card/70 mt-3 rounded-2xl border p-2">
          {["Coach House", "Partner workspace"].map((label, index) => (
            <div
              key={label}
              className="flex items-center gap-2 rounded-xl px-2 py-2"
            >
              <span className="bg-muted size-7 rounded-lg" />
              <span className="text-foreground min-w-0 flex-1 truncate text-xs font-medium">
                {label}
              </span>
              {index === 0 ? (
                <CheckIcon className="text-foreground size-4" aria-hidden />
              ) : null}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="border-border/70 bg-background/82 relative grid size-44 place-items-center rounded-[36px] border shadow-sm">
      <div className="bg-foreground/15 absolute top-7 left-7 size-5 rounded-full" />
      <div className="bg-foreground/20 absolute right-8 bottom-8 size-7 rounded-full" />
      <div className="bg-foreground/12 absolute top-10 right-10 size-4 rounded-full" />
      <div className="bg-foreground text-background grid size-20 place-items-center rounded-[28px] shadow-sm">
        <MapPinnedIcon className="size-9" aria-hidden />
      </div>
      <div className="border-border/70 bg-card/90 text-foreground absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium">
        <PanelRightOpenIcon className="size-3.5" aria-hidden />
        <span>Find</span>
      </div>
    </div>
  )
}

function OnboardingSubmitButton({
  isLastStep,
  onContinue,
  onFinish,
}: {
  isLastStep: boolean
  onContinue: () => void
  onFinish?: () => void
}) {
  const { pending } = useFormStatus()

  if (!isLastStep) {
    return (
      <Button type="button" className="rounded-full px-4 max-md:min-h-11" onClick={onContinue}>
        Continue
        <ChevronRightIcon data-icon="inline-end" aria-hidden />
      </Button>
    )
  }

  return (
    <Button
      type={onFinish ? "button" : "submit"}
      className="rounded-full px-4 max-md:min-h-11"
      disabled={pending}
      onClick={onFinish}
    >
      {pending ? "Finishing…" : "Start exploring"}
      <CheckIcon data-icon="inline-end" aria-hidden />
    </Button>
  )
}

type PublicMapMemberOnboardingOverlayBaseProps = {
  intentFocus?: MemberMapOnboardingIntent | null
  hasOrganizationSwitcher: boolean
}

export type PublicMapMemberOnboardingOverlayProps =
  | (PublicMapMemberOnboardingOverlayBaseProps & {
      onSubmit: (form: FormData) => Promise<void>
      onDismiss?: never
    })
  | (PublicMapMemberOnboardingOverlayBaseProps & {
      onSubmit?: never
      onDismiss: () => void
    })

export function PublicMapMemberOnboardingOverlay({
  intentFocus = "find",
  hasOrganizationSwitcher,
  onSubmit,
  onDismiss,
}: PublicMapMemberOnboardingOverlayProps) {
  const isMobile = useIsMobile()
  const Title = isMobile ? DialogTitle : "p"
  const Description = isMobile ? DialogDescription : "p"
  const steps = useMemo(
    () => buildPublicMapMemberOnboardingSteps({ hasOrganizationSwitcher }),
    [hasOrganizationSwitcher]
  )
  const [stepIndex, setStepIndex] = useState(0)
  const boundedStepIndex = Math.max(0, Math.min(stepIndex, steps.length - 1))
  const currentStep = steps[boundedStepIndex] ?? steps[0]
  const isLastStep = boundedStepIndex === steps.length - 1
  const resolvedIntentFocus =
    intentFocus === "fund" || intentFocus === "support" ? intentFocus : "find"
  const actionControls = (
    <>
      {onSubmit ? (
        <input type="hidden" name="intentFocus" value={resolvedIntentFocus} />
      ) : null}
      <Button
        type={onSubmit ? "submit" : "button"}
        variant="ghost"
        className="text-muted-foreground rounded-full px-3 max-md:min-h-11"
        onClick={onDismiss}
      >
        Skip
      </Button>
      <OnboardingSubmitButton
        isLastStep={isLastStep}
        onContinue={() =>
          setStepIndex((value) => Math.min(value + 1, steps.length - 1))
        }
        onFinish={onDismiss}
      />
    </>
  )

  const content = (
    <>
      <CardContent className="flex min-h-0 flex-1 items-center justify-center px-6 pt-6 pb-4 sm:px-8 sm:pt-8">
        <div className="flex w-full items-center justify-center max-md:scale-75">
          <StepVisual stepId={currentStep.id} />
        </div>
      </CardContent>
      <CardFooter className="border-border/60 bg-background/92 min-h-[14rem] flex-col items-stretch gap-4 border-t px-5 pt-5 pb-5 max-md:min-h-0 max-md:shrink-0 max-md:gap-3 max-md:px-4 max-md:py-4 sm:px-6 sm:pb-6">
        <div className="flex items-center justify-center gap-1" aria-hidden>
          {steps.map((step, index) => (
            <span
              key={step.id}
              className={cn(
                "h-1.5 rounded-full transition-[width,background-color] duration-200 motion-reduce:transition-none",
                index === boundedStepIndex
                  ? "bg-foreground w-6"
                  : "bg-muted-foreground/28 w-1.5"
              )}
            />
          ))}
        </div>
        <div className="text-center" aria-live="polite">
          <Title
            {...(isMobile ? {} : { id: "member-map-onboarding-title" })}
            className="text-foreground text-xl font-semibold tracking-tight max-md:text-lg"
          >
            {currentStep.title}
          </Title>
          <Description
            {...(isMobile ? {} : { id: "member-map-onboarding-description" })}
            className="text-muted-foreground mx-auto mt-2 max-w-[26rem] text-sm leading-6 max-md:leading-5"
          >
            {currentStep.body}
          </Description>
        </div>
        {onSubmit ? (
          <form
            action={onSubmit}
            className="mt-auto flex items-center justify-between gap-3"
          >
            {actionControls}
          </form>
        ) : (
          <div className="mt-auto flex items-center justify-between gap-3">
            {actionControls}
          </div>
        )}
      </CardFooter>
    </>
  )

  if (isMobile) {
    return (
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open) onDismiss?.()
        }}
      >
        <DialogContent
          showCloseButton={false}
          overlayClassName="bg-background/30 backdrop-blur-sm"
          onCloseAutoFocus={(event) => {
            const trigger = document.querySelector<HTMLButtonElement>(
              "[data-public-map-welcome-control] > button"
            )
            if (trigger && document.activeElement === document.body) {
              event.preventDefault()
              trigger.focus({ preventScroll: true })
            }
          }}
          className="border-border/70 bg-background/88 flex h-[min(28rem,calc(100dvh-3rem))] max-w-[min(20rem,calc(100%-2rem))] flex-col gap-0 overflow-x-hidden rounded-[30px] p-0 shadow-[0_28px_80px_-42px_rgba(15,23,42,0.58)] backdrop-blur-xl sm:max-w-[20rem] sm:rounded-[30px] sm:p-0"
        >
          {content}
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-50 flex items-end justify-center px-4 py-5 sm:items-center sm:p-6">
      <Card
        role="dialog"
        aria-modal="false"
        aria-labelledby="member-map-onboarding-title"
        aria-describedby="member-map-onboarding-description"
        className="border-border/70 bg-background/88 pointer-events-auto h-[min(42rem,calc(100%-1rem))] w-full max-w-[34rem] overflow-hidden rounded-[30px] shadow-[0_28px_80px_-42px_rgba(15,23,42,0.58)] backdrop-blur-xl"
      >
        {content}
      </Card>
    </div>
  )
}
