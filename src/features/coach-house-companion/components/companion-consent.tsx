"use client"

import Link from "next/link"
import { useRef, useState } from "react"
import { LoaderCircleIcon } from "lucide-react"
import { AuthScreenShell } from "@/components/auth/auth-screen-shell"
import { Button } from "@/components/ui/button"
import type { CompanionConsentState } from "../types"

export function CompanionConsent({ state }: { state: CompanionConsentState }) {
  const [pending, setPending] = useState<"approve" | "deny" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const errorRef = useRef<HTMLParagraphElement>(null)

  async function decide(decision: "approve" | "deny") {
    if (state.status !== "ready" || pending) return
    setPending(decision)
    setError(null)
    try {
      const response = await fetch("/api/companion/authorization", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin",
        body: JSON.stringify({ authorizationId: state.authorizationId, csrfToken: state.csrfToken, decision }),
      })
      const result = await response.json() as { redirectTo?: string; error?: string }
      if (!response.ok || !result.redirectTo) throw new Error(result.error ?? "Your decision could not be completed. Reload this page and try again.")
      window.location.assign(result.redirectTo)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Your decision could not be completed. Reload this page and try again.")
      setPending(null)
      requestAnimationFrame(() => errorRef.current?.focus())
    }
  }

  return (
    <AuthScreenShell showBrand>
      <main className="space-y-6" aria-labelledby="companion-consent-title">
        {state.status !== "ready" ? <>
          <h1 id="companion-consent-title" className="text-2xl font-semibold tracking-tight">Connection unavailable</h1>
          <p className="text-sm text-muted-foreground">{state.status === "unavailable" ? state.message : "Sign in to review this connection."}</p>
          <Button asChild variant="outline" className="min-h-11"><Link href={state.status === "login" ? state.href : "/workspace"}>{state.status === "login" ? "Sign In" : "Open Coach House"}</Link></Button>
        </> : <>
          <header className="space-y-2">
            <h1 id="companion-consent-title" className="break-words text-2xl font-semibold tracking-tight">Connect {state.clientName}</h1>
            <p className="break-words text-sm text-muted-foreground">Signed in as {state.accountEmail}</p>
            {state.clientWebsite ? <a href={state.clientWebsite} rel="noreferrer noopener" target="_blank" className="inline-flex min-h-11 items-center break-all text-sm underline underline-offset-4">View the app’s website</a> : null}
          </header>
          <section className="space-y-3" aria-labelledby="companion-consent-access">
            <h2 id="companion-consent-access" className="text-sm font-semibold">This connection can</h2>
            <ul className="list-disc space-y-2 pl-5 text-sm">
              <li>Read your account details, accessible organizations, accelerator lessons, saved answers, and progress.</li>
              <li>Save personal answer drafts and submit assignments when you ask.</li>
              <li>Review and save organization planning document changes after your approval.</li>
              <li>Prepare calendar files for you to import.</li>
            </ul>
            <p className="text-sm text-muted-foreground">Your Coach House role and organization permissions continue to apply.</p>
          </section>
          <section className="space-y-2" aria-labelledby="companion-consent-scopes">
            <h2 id="companion-consent-scopes" className="text-sm font-semibold">Requested account scopes</h2>
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">{state.scopes.map((scope) => <li key={scope}><code>{scope}</code></li>)}</ul>
          </section>
          {error ? <p ref={errorRef} tabIndex={-1} role="alert" aria-live="polite" className="rounded-md text-sm text-destructive focus-visible:outline-2 focus-visible:outline-ring">{error}</p> : null}
          <div className="flex flex-wrap gap-3">
            <Button type="button" className="min-h-11" disabled={pending !== null} onClick={() => void decide("approve")}>
              {pending === "approve" ? <LoaderCircleIcon aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" /> : null}Allow Connection
            </Button>
            <Button type="button" variant="outline" className="min-h-11" disabled={pending !== null} onClick={() => void decide("deny")}>
              {pending === "deny" ? <LoaderCircleIcon aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" /> : null}Deny Access
            </Button>
          </div>
        </>}
      </main>
    </AuthScreenShell>
  )
}
