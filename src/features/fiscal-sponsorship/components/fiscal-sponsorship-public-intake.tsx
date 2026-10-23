"use client"

import { useEffect, useRef } from "react"
import Link from "next/link"
import { guestProfileHref } from "../lib/guest-profile"
import { Button } from "@/components/ui/button"
import type { DraftFieldChange } from "./fiscal-sponsorship-application-editor-controls"
import { FiscalSponsorshipApplicationEditorFields } from "./fiscal-sponsorship-application-editor-fields"
import { FiscalPublicDraftStatus, FiscalPublicLeaveDialog } from "./fiscal-public-draft-status"
import { usePublicFiscalDraft } from "./use-public-fiscal-draft"
import { usePublicFiscalNavigation } from "./use-public-fiscal-navigation"
import { usePublicFiscalSubmission } from "./use-public-fiscal-submission"
import { FiscalFieldErrors } from "./fiscal-public-field-errors"
import { guestFieldLabel } from "../lib/guest-submission-input"

export function FiscalSponsorshipPublicIntake({ draftPersistenceEnabled = false, submissionEnabled = false, profileImportEnabled = false }: { draftPersistenceEnabled?: boolean; submissionEnabled?: boolean; profileImportEnabled?: boolean }) {
  const { state, controller } = usePublicFiscalDraft(draftPersistenceEnabled)
  const submission = usePublicFiscalSubmission(controller)
  const navigation = usePublicFiscalNavigation(state.dirty || submission.uncertain || submission.working)
  const formRef = useRef<HTMLFormElement>(null)
  const errorRef = useRef<HTMLDivElement>(null)
  const onFieldChange: DraftFieldChange = (field, value) => controller.edit(field, value)
  const hasErrors = Object.keys(submission.errors).length > 0
  useEffect(() => {
    if (!Object.keys(submission.errors).length) return
    const frame = requestAnimationFrame(() => {
      const input = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')
      ;(input ?? errorRef.current)?.focus()
    })
    return () => cancelAnimationFrame(frame)
  }, [submission.errors])

  if (state.phase === "submitted") return (
    <section id="application" aria-labelledby="application-title" className="mx-auto w-full max-w-2xl scroll-mt-6 rounded-3xl border border-border/60 bg-muted/20 p-5">
      <h2 id="application-title" className="text-xl font-normal tracking-tight">Application received</h2>
      <p className="mt-1 text-sm text-muted-foreground">Your application is submitted for review. No account is required.</p>
      <p className="mt-2 text-sm text-muted-foreground">We’ll email a copy of your answers. You’re done—no account or email confirmation is needed to submit. The email also includes optional access to application updates. Submission doesn’t mean the project is approved.</p>
      <p className="mt-3 break-all text-xs text-muted-foreground">Reference: {state.reference}</p>
      {state.reference && profileImportEnabled && <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" className="min-h-11 rounded-full shadow-none"><Link href={guestProfileHref(state.reference)}>Start free and save your info</Link></Button>
      </div>}
    </section>
  )

  return (
    <section id="application" aria-labelledby="application-title" className="mx-auto w-full max-w-2xl scroll-mt-6">
      <FiscalPublicLeaveDialog open={navigation.destination !== null} onCancel={navigation.cancel} onLeave={navigation.leave} />
      <form ref={formRef} noValidate onSubmit={(event) => { event.preventDefault(); if (submissionEnabled) void submission.submit() }} className="rounded-3xl border border-border/60 bg-muted/20 p-3 sm:p-5">
        <header className="px-1 pt-1 pb-5 sm:px-2">
          <h2 id="application-title" className="text-xl font-normal tracking-tight">Apply</h2>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">Tell us about you and your project. No account required.</p>
          <p id="application-preview-note" className="mt-2 text-xs leading-5 text-muted-foreground">
            {submissionEnabled ? "Apply without signing up. We’ll email your receipt and application updates." : draftPersistenceEnabled ? "Preview: submissions aren’t open yet. Your draft can be saved privately and resumed in this browser."
              : "Preview: submissions aren’t open yet. Answers stay on this page until you leave or refresh."}
          </p>
          <FiscalPublicDraftStatus state={state} onRetry={() => { void controller.retry() }} onReload={() => { void controller.reloadSaved() }} />
        </header>
        {hasErrors && <div ref={errorRef} tabIndex={-1} role="alert" className="mb-4 rounded-xl border border-destructive/30 p-3 text-sm outline-none focus-ring">
          <p>Check these answers:</p>
          <ul className="mt-1 list-inside list-disc text-xs leading-5">{Object.entries(submission.errors).map(([field, message]) => <li key={field}>{guestFieldLabel(field)}: {message}</li>)}</ul>
        </div>}
        <FiscalFieldErrors.Provider value={submission.errors}>
        <fieldset disabled={state.phase === "loading" || submission.working || submission.uncertain} aria-busy={state.phase === "loading" || submission.working} aria-label="Application details" className="m-0 min-w-0 border-0 p-0">
        <FiscalSponsorshipApplicationEditorFields
          showAllSections={hasErrors}
          guest
          applicationReady={false}
          draft={state.draft}
          formId="public-fiscal-application"
          onFieldChange={onFieldChange}
          projectId=""
        />
        </fieldset>
        </FiscalFieldErrors.Provider>
        <div className="mt-5 flex flex-col items-start gap-2 px-1 sm:px-2">
          <p role="status" aria-live="polite" className="text-sm text-muted-foreground">{submission.message}</p>
          <Button type="submit" disabled={!submissionEnabled || submission.working || state.phase === "loading"} aria-describedby="application-preview-note" className="h-11 rounded-full px-5 shadow-none">
            {submission.working ? "Submitting…" : submission.uncertain ? "Retry confirmation" : "Submit application"}
          </Button>
        </div>
      </form>
    </section>
  )
}
