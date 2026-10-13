"use client"

import { useCallback, useRef, type Dispatch, type SetStateAction } from "react"
import { isRedirectError } from "next/dist/client/components/redirect-error"
import { getURLFromRedirectError } from "next/dist/client/components/redirect"
import { clearOnboardingDraft } from "../draft"

export function isCompletedOnboardingDestination(destination: string | null) {
  if (!destination?.startsWith("/") || destination.startsWith("//")) return false
  const url = new URL(destination, "https://workspace.local")
  if (url.searchParams.has("error")) return false
  const source = url.searchParams.get("source")
  return (url.pathname === "/workspace" && ["onboarding", "organization_setup", "onboarding_setup"].includes(source ?? "")) ||
    (url.searchParams.get("member_onboarding") === "0" && source === "member_onboarding")
}

export async function submitOnboardingWithRecovery({ onSubmit, form, draftScope, onError }: {
  onSubmit: (form: FormData) => Promise<void>
  form: FormData
  draftScope: string | null
  onError: (message: string) => void
}) {
  try {
    await onSubmit(form)
    if (draftScope) clearOnboardingDraft(draftScope)
    return true
  } catch (error) {
    if (isRedirectError(error)) {
      if (draftScope && isCompletedOnboardingDestination(getURLFromRedirectError(error))) {
        clearOnboardingDraft(draftScope)
      }
      throw error
    }
    onError("We couldn’t finish saving. Your entries are still here. Check your connection and try again.")
    return false
  }
}

export function useOnboardingSubmission({ onSubmit, draftScope, setSubmitting, setServerError }: {
  onSubmit: (form: FormData) => Promise<void>
  draftScope: string | null
  setSubmitting: Dispatch<SetStateAction<boolean>>
  setServerError: Dispatch<SetStateAction<string | null>>
}) {
  const pendingRef = useRef(false)
  return useCallback(async (form: FormData) => {
    if (pendingRef.current) return
    pendingRef.current = true
    setSubmitting(true)
    setServerError(null)
    const reset = () => {
      pendingRef.current = false
      setSubmitting(false)
    }
    try {
      const saved = await submitOnboardingWithRecovery({ onSubmit, form, draftScope, onError: setServerError })
      // Keep the handoff visible until the destination mounts. Failed saves
      // immediately restore the form so the user can retry without losing edits.
      if (!saved) reset()
    } catch (error) {
      if (!isRedirectError(error) || !isCompletedOnboardingDestination(getURLFromRedirectError(error))) reset()
      throw error
    }
  }, [draftScope, onSubmit, setServerError, setSubmitting])
}
