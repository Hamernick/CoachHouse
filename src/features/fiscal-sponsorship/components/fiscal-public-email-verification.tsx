"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { guestFollowupHref } from "../lib/guest-followup"
import { guestProfileHref } from "../lib/guest-profile"
import { z } from "zod"

export function FiscalPublicEmailVerification({ profileImportEnabled = false }: { profileImportEnabled?: boolean }) {
  const token = useRef<string | null>(null)
  const busy = useRef(false)
  const [state, setState] = useState<"loading" | "ready" | "working" | "verified" | "missing">("loading")
  const [error, setError] = useState<string | null>(null)
  const [reference, setReference] = useState<string | null>(null)
  useEffect(() => {
    // Fragment stays out of HTTP request logs; strip it before any user navigation.
    const value = new URLSearchParams(window.location.hash.slice(1)).get("verify")
    if (value && value.length <= 256) token.current = value
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}`)
    setState(token.current ? "ready" : "missing")
  }, [])
  const verify = async () => {
    if (busy.current || !token.current) return
    busy.current = true; setState("working"); setError(null)
    try {
      const post = (path: string, body: object) => fetch(`/api/public/fiscal-sponsorship/${path}`, {
        method: "POST", credentials: "same-origin", cache: "no-store", signal: AbortSignal.timeout(10000),
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      })
      const session = await post("session", {})
      if (!session.ok) throw new Error("Verification is temporarily unavailable. Please retry.")
      const response = await post("verify", { token: token.current })
      const result: unknown = await response.json()
      if (!response.ok) throw new Error(response.status === 400 ? "This link has expired or was used in another browser. Request a new access link below." : "We couldn’t confirm verification. Please retry.")
      const receipt = z.object({ ok: z.literal(true), reference: z.string().uuid() }).strict().parse(result)
      setReference(receipt.reference)
      token.current = null; setState("verified")
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Please retry."); setState("ready") }
    finally { busy.current = false }
  }
  return (
    <section className="mx-auto w-full max-w-lg px-4 py-8" aria-labelledby="verification-title">
      <h1 id="verification-title" className="text-2xl font-normal tracking-tight">{state === "verified" ? "Email verified" : "Verify your email"}</h1>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">
        {state === "verified" ? "You can now view your application and respond to any updates. No account has been created."
          : state === "missing" ? "Open the private verification link in your application confirmation email."
            : "Confirm this email belongs to you. This won’t create an account or publish your information."}
      </p>
      <p role="status" aria-live="polite" className="mt-2 text-sm text-muted-foreground">{error}</p>
      {(state === "ready" || state === "working") && <Button type="button" onClick={() => { void verify() }} disabled={state === "working"} className="mt-3 h-11 rounded-full px-5 shadow-none">{state === "working" ? "Verifying…" : "Verify email"}</Button>}
      {(state === "missing" || error) && <Button asChild variant="link" className="mt-3 min-h-11 px-0"><Link href="/documentation/fiscal-sponsorship/recover">Request a new access link</Link></Button>}
      {state === "missing" && <Button asChild variant="link" className="mt-3 h-11 px-0"><Link href="/documentation/fiscal-sponsorship">Fiscal sponsorship</Link></Button>}
      {state === "verified" && reference && <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button asChild className="min-h-11 rounded-full shadow-none"><Link href={guestFollowupHref(reference)}>View application</Link></Button>
        {profileImportEnabled && <Button asChild variant="outline" className="min-h-11 rounded-full shadow-none"><Link href={guestProfileHref(reference)}>Create your organization profile</Link></Button>}
        <Button asChild variant="link" className="min-h-11"><Link href="/documentation">Not now</Link></Button>
      </div>}
    </section>
  )
}
