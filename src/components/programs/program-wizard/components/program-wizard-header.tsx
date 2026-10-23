import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"

import { STEPS } from "../constants"

type ProgramWizardHeaderProps = {
  mode: "create" | "edit"
  currentStep: number
  completion: number
  isAutoSaving: boolean
}

export function ProgramWizardHeader({
  mode,
  currentStep,
  completion,
  isAutoSaving,
}: ProgramWizardHeaderProps) {
  return (
    <header className="border-border/60 bg-background border-b px-3 py-3 sm:px-5 sm:py-4 md:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="text-muted-foreground text-xs tracking-wide uppercase">
            Resource setup
          </p>
          <h2 className="text-lg font-semibold text-pretty sm:text-xl">
            {STEPS[currentStep].title}
          </h2>
          <p className="text-muted-foreground text-sm text-pretty">
            {STEPS[currentStep].helper}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {mode === "edit" ? (
            <Badge variant="secondary" className="rounded-full text-[11px]">
              {isAutoSaving ? "Saving..." : "Autosave on"}
            </Badge>
          ) : null}
          <span className="text-muted-foreground text-[11px] font-medium tabular-nums">
            Step {currentStep + 1} of {STEPS.length}
          </span>
        </div>
      </div>
      <div className="mt-3">
        <Progress value={completion} aria-label="Resource builder progress" />
      </div>
    </header>
  )
}
