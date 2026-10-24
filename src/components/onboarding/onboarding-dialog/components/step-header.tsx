"use client"

import {
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"

import { cn } from "@/lib/utils"
import { Progress } from "@/components/ui/progress"
import type { Step } from "../types"

type StepHeaderProps = {
  compact?: boolean
  stepLabel: string
  currentStep: Step
  isInline: boolean
  progress: number
}

export function StepHeader({
  compact = false,
  stepLabel,
  currentStep,
  isInline,
  progress,
}: StepHeaderProps) {
  return (
    <div data-onboarding-motion className={cn("border-border/65 shrink-0 border-b px-4 py-4 md:px-6", compact && "md:px-4")}>
      <div className={cn("mx-auto w-full max-w-[640px]", compact && "max-w-none")}>
        <div className="min-w-0">
          {isInline ? (
            <h2 className="text-foreground text-xl leading-tight font-semibold tracking-tight">
              {currentStep.title}
            </h2>
          ) : (
            <DialogTitle asChild>
              <h2 className="text-foreground text-xl leading-tight font-semibold tracking-tight">
                {currentStep.title}
              </h2>
            </DialogTitle>
          )}
          {isInline ? (
            <p className="text-muted-foreground mt-0.5 max-w-2xl text-sm leading-5">
              {currentStep.description}
            </p>
          ) : (
            <DialogDescription asChild>
              <p className="text-muted-foreground mt-0.5 max-w-2xl text-sm leading-5">
                {currentStep.description}
              </p>
            </DialogDescription>
          )}
        </div>
        <Progress

          value={progress}
          aria-label="Setup progress"
          aria-valuenow={progress}
          aria-valuetext={stepLabel}
          className="mt-3 h-1 bg-muted [&_[data-slot=progress-indicator]]:transition-transform motion-reduce:[&_[data-slot=progress-indicator]]:transition-none"
        />
      </div>
    </div>
  )
}
