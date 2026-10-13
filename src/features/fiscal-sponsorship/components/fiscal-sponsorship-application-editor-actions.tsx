import Loader2Icon from "lucide-react/dist/esm/icons/loader-2"

import { Button } from "@/components/ui/button"

export function FiscalSponsorshipApplicationEditorActions({
  canEdit,
  isBusy,
  isSaving,
  isSubmitting,
  onClose,
  saveBlocked = false,
  onSubmitForReview,
}: {
  saveBlocked?: boolean
  canEdit: boolean
  isBusy: boolean
  isSaving: boolean
  isSubmitting: boolean
  onClose: () => void
  onSubmitForReview: () => void
}) {
  return (
    <>
      <Button
        className="shadow-none"
        type="button"
        variant="outline"
        onClick={onClose}
        disabled={isBusy}
      >
        {canEdit ? "Cancel" : "Close"}
      </Button>
      {canEdit ? (
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
          <Button
            className="shadow-none"
            type="submit"
            variant="outline"
            disabled={isBusy || saveBlocked}
            aria-busy={isSaving}
          >
            {isSaving ? (
              <Loader2Icon
                data-icon="inline-start"
                className="animate-spin"
                aria-hidden
              />
            ) : null}
            {isSaving ? "Saving…" : "Save draft"}
          </Button>
          <Button
            className="shadow-none"
            type="button"
            disabled={isBusy || saveBlocked}
            aria-busy={isSubmitting}
            onClick={onSubmitForReview}
          >
            {isSubmitting ? (
              <Loader2Icon
                data-icon="inline-start"
                className="animate-spin"
                aria-hidden
              />
            ) : null}
            {isSubmitting ? "Submitting…" : "Submit for review"}
          </Button>
        </div>
      ) : null}
    </>
  )
}
