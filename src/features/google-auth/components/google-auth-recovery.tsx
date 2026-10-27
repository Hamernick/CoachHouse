"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Textarea } from "@/components/ui/textarea"

import {
  formatGoogleAuthDiagnostics,
  getCanonicalGoogleLoginHref,
  type GoogleAuthDiagnostics,
} from "../lib/recovery"

export function GoogleAuthRecovery({
  diagnostics,
  isPending,
  onRestart,
  redirectTo,
  standaloneLogin,
}: {
  diagnostics: GoogleAuthDiagnostics | null
  isPending: boolean
  onRestart: () => void
  redirectTo: string
  standaloneLogin: boolean
}) {
  const [copyStatus, setCopyStatus] = useState("")
  const [fallbackDetails, setFallbackDetails] = useState<string | null>(null)

  async function copyDetails() {
    if (!diagnostics) return
    const text = formatGoogleAuthDiagnostics(diagnostics)
    try {
      await navigator.clipboard.writeText(text)
      setFallbackDetails(null)
      setCopyStatus("Sign-in details copied. Send them to Coach House support.")
    } catch {
      setFallbackDetails(text)
      setCopyStatus(
        "Copy the sign-in details below and send them to Coach House support."
      )
    }
  }

  return (
    <Collapsible>
      <CollapsibleTrigger asChild>
        <Button type="button" variant="link" className="min-h-11 px-0">
          Trouble signing in?
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-2">
        <p className="text-muted-foreground text-sm">
          Close the Google window, then restart sign-in. You can also use your
          email and password.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={isPending}
            onClick={onRestart}
          >
            Restart sign-in
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="min-h-11"
            disabled={!diagnostics}
            onClick={() => void copyDetails()}
          >
            Copy sign-in details
          </Button>
        </div>
        {standaloneLogin &&
        diagnostics &&
        diagnostics.origin !== "https://coachhouse.app" ? (
          <Button asChild variant="link" className="min-h-11 self-start px-0">
            <a href={getCanonicalGoogleLoginHref(redirectTo)}>
              Open Coach House sign-in
            </a>
          </Button>
        ) : null}
        <p
          role="status"
          aria-live="polite"
          className="text-muted-foreground text-sm"
        >
          {copyStatus}
        </p>
        {fallbackDetails ? (
          <Textarea
            aria-label="Sign-in details"
            readOnly
            value={fallbackDetails}
            onFocus={(event) => event.currentTarget.select()}
          />
        ) : null}
      </CollapsibleContent>
    </Collapsible>
  )
}
