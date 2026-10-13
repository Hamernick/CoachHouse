"use client"

import * as React from "react"
import Loader2Icon from "lucide-react/dist/esm/icons/loader-2"

import { ScrollFadeEffect } from "@/components/scroll-fade-effect"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { toast } from "@/lib/toast"
import {
  buildFiscalSponsorshipApplicationDraft,
  buildFiscalSponsorshipApplicationInput,
  type FiscalSponsorshipApplicationDraft,
} from "../lib/application-draft"
import {
  loadFiscalSponsorshipApplicationDraft,
  saveFiscalSponsorshipApplicationDraft,
  submitFiscalSponsorshipApplication,
} from "../actions"
import type { FiscalSponsorshipProjectWorkbenchData } from "../types"
import { parseFundraisingAmount } from "../lib/fundraising-goal"
import { FiscalSponsorshipApplicationEditorActions } from "./fiscal-sponsorship-application-editor-actions"
import { FiscalSponsorshipApplicationEditorFields } from "./fiscal-sponsorship-application-editor-fields"

type FiscalSponsorshipApplicationDrawerProps = {
  data: FiscalSponsorshipProjectWorkbenchData
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: () => void
}

type FiscalSponsorshipApplicationEditorProps =
  FiscalSponsorshipApplicationDrawerProps & {
    surface: "drawer" | "inline"
    containedScroll?: boolean
  }

function DiscardApplicationChangesDialog({
  onDiscard,
  onOpenChange,
  open,
}: {
  onDiscard: () => void
  onOpenChange: (open: boolean) => void
  open: boolean
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Discard application changes?</AlertDialogTitle>
          <AlertDialogDescription>
            You have unsaved fiscal sponsorship edits. Keep editing or discard
            them before closing this application.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => onOpenChange(false)}>
            Keep editing
          </AlertDialogCancel>
          <AlertDialogAction onClick={onDiscard}>
            Discard changes
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function FiscalSponsorshipApplicationEditor({
  data,
  open,
  onOpenChange,
  onSaved,
  surface,
  containedScroll = true,
}: FiscalSponsorshipApplicationEditorProps) {
  const formId = React.useId()
  const loadedApplicationKeyRef = React.useRef<string | null>(null)
  const [draft, setDraft] = React.useState<FiscalSponsorshipApplicationDraft>(
    () => buildFiscalSponsorshipApplicationDraft({ data })
  )
  const [baselineDraft, setBaselineDraft] =
    React.useState<FiscalSponsorshipApplicationDraft>(() =>
      buildFiscalSponsorshipApplicationDraft({ data })
    )
  const [discardDialogOpen, setDiscardDialogOpen] = React.useState(false)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [saveError, setSaveError] = React.useState<string | null>(null)
  const [revision, setRevision] = React.useState<string | null>(null)
  const [loadingDraft, setLoadingDraft] = React.useState(true)
  const [isSaving, startSaveTransition] = React.useTransition()
  const [isSubmitting, startSubmitTransition] = React.useTransition()
  const isBusy = isSaving || isSubmitting
  const saveBlocked = isBusy || loadingDraft || Boolean(loadError)
  const applicationReady = Boolean(data.workflowSummary?.applicationId)
  const sourceActivityTitle =
    data.applicationPrefill?.sourceActivityTitle ??
    data.applicationPrefill?.projectName ??
    null
  const sourceActivityKind =
    data.applicationPrefill?.sourceActivityKind ??
    data.applicationPrefill?.focusArea ??
    null
  const applicationKey = `${data.projectId}:${
    data.applicationPrefill?.sourceActivityId ?? ""
  }`
  const draftDirty = React.useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(baselineDraft),
    [baselineDraft, draft]
  )

  React.useEffect(() => {
    if (!open || loadedApplicationKeyRef.current === applicationKey) return

    let cancelled = false
    setLoadingDraft(true)
    setLoadError(null)
    setSaveError(null)
    setRevision(null)
    const nextDraft = buildFiscalSponsorshipApplicationDraft({ data })
    setDraft(nextDraft)
    setBaselineDraft(nextDraft)

    void loadFiscalSponsorshipApplicationDraft(data.projectId).then(
      (result) => {
        if (cancelled) return

        if ("error" in result) {
          setLoadError(result.error)
          setLoadingDraft(false)
          return
        }

        const loadedDraft = buildFiscalSponsorshipApplicationDraft({
          application: result.application,
          data,
        })
        loadedApplicationKeyRef.current = applicationKey
        setRevision(result.application?.updatedAt ?? null)
        setDraft(loadedDraft)
        setBaselineDraft(loadedDraft)
        setLoadingDraft(false)
      }
    ).catch(() => {
      if (cancelled) return
      setLoadError("Your saved draft could not load. Close and reopen the application to retry.")
      setLoadingDraft(false)
    })

    return () => {
      cancelled = true
    }
  }, [applicationKey, data, open])

  React.useEffect(() => {
    if (!draftDirty) return

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault()
      event.returnValue = ""
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [draftDirty])

  const requestClose = React.useCallback(() => {
    if (draftDirty && !isBusy) {
      setDiscardDialogOpen(true)
      return
    }

    onOpenChange(false)
  }, [draftDirty, isBusy, onOpenChange])

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen && draftDirty && !isBusy) {
        setDiscardDialogOpen(true)
        return
      }

      onOpenChange(nextOpen)
    },
    [draftDirty, isBusy, onOpenChange]
  )

  const handleFieldChange = React.useCallback(
    <Key extends keyof FiscalSponsorshipApplicationDraft>(
      field: Key,
      value: FiscalSponsorshipApplicationDraft[Key]
    ) => {
      setDraft((currentDraft) => ({
        ...currentDraft,
        [field]: value,
      }))
    },
    []
  )

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saveBlocked) return
    if (draft.fundraisingGoalDollars.trim() && parseFundraisingAmount(draft.fundraisingGoalDollars) === null) {
      setSaveError("Enter a fundraising amount greater than zero, with no more than two decimal places.")
      return
    }

    setSaveError(null)
    startSaveTransition(async () => {
      const toastId = toast.loading("Saving fiscal application…")
      try {
        const result = await saveFiscalSponsorshipApplicationDraft({
          ...buildFiscalSponsorshipApplicationInput({ data, draft }),
          expectedUpdatedAt: revision,
        })

        if ("error" in result) {
          setSaveError(result.error)
          toast.error(result.error, { id: toastId })
          return
        }

        toast.success("Fiscal application saved", { id: toastId })
        setRevision(result.updatedAt)
        setBaselineDraft(draft)
        onOpenChange(false)
        onSaved?.()
      } catch {
        const message = "We couldn’t confirm the save. Reopen your application before retrying; your changes are still shown here."
        setSaveError(message)
        toast.error(message, { id: toastId })
      }
    })
  }

  function handleSubmitForReview() {
    if (saveBlocked) return
    if (parseFundraisingAmount(draft.fundraisingGoalDollars) === null) {
      setSaveError("Enter a fundraising amount greater than zero, with no more than two decimal places.")
      return
    }

    setSaveError(null)
    startSubmitTransition(async () => {
      const toastId = toast.loading("Submitting fiscal application…")
      try {
        const input = buildFiscalSponsorshipApplicationInput({ data, draft })
        const saved = await saveFiscalSponsorshipApplicationDraft({
          ...input,
          expectedUpdatedAt: revision,
          status: "draft",
        })

        if ("error" in saved) {
          setSaveError(saved.error)
          toast.error(saved.error, { id: toastId })
          return
        }

        // Saving succeeded even if review validation fails. Keep the new revision
        // so fixing a missing field does not produce a false stale-draft conflict.
        setRevision(saved.updatedAt)
        setBaselineDraft(draft)
        const submitted = await submitFiscalSponsorshipApplication(data.projectId)
        if ("error" in submitted) {
          setSaveError(submitted.error)
          toast.error(submitted.error, { id: toastId })
          return
        }

        toast.success("Fiscal application submitted for Coach House review", {
          id: toastId,
        })
        setRevision(saved.updatedAt)
        setBaselineDraft(draft)
        onOpenChange(false)
        onSaved?.()
      } catch {
        const message = "We couldn’t confirm submission. Reopen your application to check its status before retrying."
        setSaveError(message)
        toast.error(message, { id: toastId })
      }
    })
  }

  const editorContent = (
    <div className="flex flex-col gap-4">
      {loadingDraft ? (
        <Alert>
          <Loader2Icon
            data-icon="inline-start"
            className="animate-spin"
            aria-hidden
          />
          <AlertTitle>Loading saved draft</AlertTitle>
          <AlertDescription>
            Existing fiscal sponsorship data will replace the prefill once it
            loads.
          </AlertDescription>
        </Alert>
      ) : null}

      {loadError ? (
        <Alert variant="destructive">
          <AlertTitle>Draft could not load</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : null}

      {saveError ? (
        <Alert variant="destructive">
          <AlertTitle>Draft could not save</AlertTitle>
          <AlertDescription>{saveError}</AlertDescription>
        </Alert>
      ) : null}

      {sourceActivityTitle ? (
        <div className="border-border/60 bg-muted/35 flex min-w-0 items-start justify-between gap-3 rounded-2xl border px-4 py-3">
          <div className="min-w-0">
            <p className="text-muted-foreground text-[11px] font-medium">
              Activity source
            </p>
            <p className="text-foreground mt-1 truncate text-sm font-semibold">
              {sourceActivityTitle}
            </p>
          </div>
          {sourceActivityKind ? (
            <Badge
              variant="secondary"
              className="h-6 shrink-0 rounded-full px-2 text-[10px]"
            >
              {sourceActivityKind}
            </Badge>
          ) : null}
        </div>
      ) : null}

      <fieldset disabled={saveBlocked}>
        <FiscalSponsorshipApplicationEditorFields
          applicationReady={applicationReady}
          draft={draft}
          formId={formId}
          projectId={data.projectId}
          sourceActivityTitle={sourceActivityTitle}
          onFieldChange={handleFieldChange}
        />
      </fieldset>
    </div>
  )
  const editorActions = <FiscalSponsorshipApplicationEditorActions
    isBusy={isBusy} isSaving={isSaving} isSubmitting={isSubmitting}
    canEdit saveBlocked={saveBlocked} onClose={requestClose} onSubmitForReview={handleSubmitForReview}
  />
  const discardDialog = (
    <DiscardApplicationChangesDialog
      open={discardDialogOpen}
      onOpenChange={setDiscardDialogOpen}
      onDiscard={() => {
        setDiscardDialogOpen(false)
        setDraft(baselineDraft)
        setSaveError(null)
        onOpenChange(false)
      }}
    />
  )

  if (surface === "inline") {
    return (
      <>
        <section
          data-fiscal-sponsorship-application-editor="inline"
          className="border-border/60 bg-muted/25 w-full overflow-hidden rounded-xl border"
          aria-labelledby={`${formId}-title`}
        >
          <header className="border-border/60 flex flex-col gap-1 border-b px-4 py-3">
            <h3 id={`${formId}-title`} className="text-sm font-semibold">
              Application details
            </h3>
            <p className="text-muted-foreground text-xs leading-snug">
              Complete the intake fields, then save or submit for review.
            </p>
          </header>
          <form id={formId} onSubmit={handleSubmit}>
            <div className={containedScroll ? "max-h-[48rem] overflow-y-auto overscroll-contain px-4 py-4" : "px-4 py-4"}>
              {editorContent}
            </div>
            <div className="border-border/60 bg-background/85 flex flex-col gap-2 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              {editorActions}
            </div>
          </form>
        </section>
        {discardDialog}
      </>
    )
  }

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          side="right"
          className="flex h-full w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
          onEscapeKeyDown={(event) => {
            if (!draftDirty) return
            event.preventDefault()
            setDiscardDialogOpen(true)
          }}
          onInteractOutside={(event) => {
            if (!draftDirty) return
            event.preventDefault()
            setDiscardDialogOpen(true)
          }}
        >
          <SheetHeader className="border-border/60 shrink-0 border-b px-6 pt-6 pb-4 text-left">
            <SheetTitle>Fiscal sponsorship application</SheetTitle>
            <SheetDescription>
              Save the missing intake details for review, prepared documents,
              and the future signature packet.
            </SheetDescription>
          </SheetHeader>

          <form
            id={formId}
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={handleSubmit}
          >
            <ScrollFadeEffect className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5 [--mask-height:2rem] [--scroll-buffer:1.5rem]">
              {editorContent}
            </ScrollFadeEffect>
            <SheetFooter className="border-border/60 bg-background/95 shrink-0 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              {editorActions}
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
      {discardDialog}
    </>
  )
}

export function FiscalSponsorshipApplicationDrawer(
  props: FiscalSponsorshipApplicationDrawerProps
) {
  return <FiscalSponsorshipApplicationEditor {...props} surface="drawer" />
}
