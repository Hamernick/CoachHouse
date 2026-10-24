import { Button } from "@/components/ui/button"

type ProgramWizardFooterProps = {
  currentStep: number
  totalSteps: number
  mode: "create" | "edit"
  isPending: boolean
  onCancel: () => void
  onBack: () => void
  onContinue: () => void
  onSubmit: () => void
}

export function ProgramWizardFooter({
  currentStep,
  totalSteps,
  mode,
  isPending,
  onCancel,
  onBack,
  onContinue,
  onSubmit,
}: ProgramWizardFooterProps) {
  return (
    <footer className="bg-background border-border/60 border-t px-3 py-3 sm:px-5 sm:py-4 md:px-6">
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
          <Button
            type="button"
            variant="ghost"
            className="h-11 rounded-xl px-4 sm:h-10"
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-xl px-4 sm:h-10"
            onClick={onBack}
            disabled={currentStep === 0}
          >
            Back
          </Button>
        </div>
        {currentStep < totalSteps - 1 ? (
          <Button
            type="button"
            className="h-11 rounded-xl px-4 sm:h-10"
            onClick={onContinue}
          >
            Continue
          </Button>
        ) : (
          <Button
            type="button"
            className="h-11 rounded-xl px-4 sm:h-10"
            onClick={onSubmit}
            disabled={isPending}
          >
            {isPending
              ? mode === "create"
                ? "Creating..."
                : "Saving..."
              : mode === "create"
                ? "Create resource"
                : "Save activity"}
          </Button>
        )}
      </div>
    </footer>
  )
}
