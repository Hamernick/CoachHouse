"use client"

import ArrowRightIcon from "lucide-react/dist/esm/icons/arrow-right"
import LoaderCircleIcon from "lucide-react/dist/esm/icons/loader-circle"

import { getReactGrabOwnerProps } from "@/components/dev/react-grab-surface"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import type { PricingPlanTier } from "@/lib/billing/plan-tier"
import type {
  FormationStatus,
  IntentFocus,
  OnboardingFlowMode,
  OnboardingStepId,
} from "../types"

type StepFooterProps = {
  compact?: boolean
  step: number
  totalSteps: number
  submitting: boolean
  currentStepId: OnboardingStepId
  onboardingMode: OnboardingFlowMode
  intentFocus: IntentFocus | ""
  slugStatus: "idle" | "checking" | "available" | "unavailable"
  formationStatus: FormationStatus | ""
  accountStepReady: boolean
  builderPlanTier: PricingPlanTier
  onPrev: () => void
  onNext: () => void
}

export function StepFooter({
  compact = false,
  step,
  totalSteps,
  submitting,
  currentStepId,
  onboardingMode,
  intentFocus,
  slugStatus,
  formationStatus,
  accountStepReady,
  builderPlanTier,
  onPrev,
  onNext,
}: StepFooterProps) {
  const isProfileStep = currentStepId === "account" && onboardingMode === "post_signup_access"
  const isLastStep = step === totalSteps - 1
  const isPostSignupPricingStep =
    isLastStep &&
    currentStepId === "pricing" &&
    onboardingMode === "post_signup_access"

  return (
    <div className={cn("border-border/70 bg-background/70 supports-[backdrop-filter]:bg-background/60 relative z-20 mt-auto shrink-0 border-t px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur md:px-6 md:py-3", compact && "pt-4 md:px-4 md:py-4")}>
      <div className={cn("mx-auto flex w-full max-w-[640px] items-center justify-between gap-3", compact && "max-w-none")}>
        <div className="flex min-w-0 items-center gap-2">
          {step > 0 ? (
            <Button
              type="button"
              variant="outline"
              onClick={onPrev}
              disabled={submitting}
              className="h-auto min-h-11 rounded-full px-4 shadow-none whitespace-normal sm:min-h-9"
            >
              Back
            </Button>
          ) : (
            <span className="text-muted-foreground text-xs">
              You’ll be able to change this later.
            </span>
          )}
        </div>

        <div className="flex min-w-0 items-center gap-2">
          <Button
            {...getReactGrabOwnerProps({
              ownerId: "onboarding:continue",
              component: "StepFooter",
              source: "src/components/onboarding/onboarding-dialog/components/step-footer.tsx",
              slot: "continue",
            })}
            type={isLastStep ? "submit" : "button"}
            onClick={
              isLastStep
                ? undefined
                : (event) => {
                    event.preventDefault()
                    onNext()
                  }
            }
            disabled={
              submitting ||
              (currentStepId === "intent" && !intentFocus) ||
              (currentStepId === "org" &&
                (slugStatus !== "available" || !formationStatus)) ||
              (currentStepId === "account" && !isProfileStep && !accountStepReady)
            }
            aria-busy={submitting}
            className="h-auto min-h-11 shrink-0 gap-1.5 rounded-full px-5 shadow-none whitespace-normal sm:min-h-9"
          >
            {submitting ? <LoaderCircleIcon className="size-4 motion-safe:animate-spin" aria-hidden /> : null}
            {isLastStep ? (
              <>
                {isProfileStep ? "Continue" : isPostSignupPricingStep
                  ? builderPlanTier === "free"
                    ? "Continue with Individual"
                    : "Enter workspace"
                  : intentFocus === "build" ? "Open workspace" : "Continue"}
                <ArrowRightIcon className="h-4 w-4" aria-hidden />
              </>
            ) : (
              <>
                Continue
                <ArrowRightIcon className="h-4 w-4" aria-hidden />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
