"use client"

import { useRef, useState } from "react"
import type HCaptcha from "@hcaptcha/react-hcaptcha"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { HCaptchaWidget } from "@/components/auth/hcaptcha-widget"

export function FiscalGuestRecovery({ initialReference = "", enabled }: { initialReference?: string; enabled: boolean }) {
  const [reference, setReference] = useState(initialReference)
  const [email, setEmail] = useState("")
  const [captchaToken, setCaptchaToken] = useState("")
  const [working, setWorking] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState("")
  const captchaRef = useRef<HCaptcha | null>(null)
  const busy = useRef(false)
  const attempt = useRef<{ reference: string; email: string; requestId: string } | null>(null)

  const submit = async () => {
    if (busy.current || !enabled) return
    if (!captchaToken) { setError("Complete the security verification."); return }
    const normalized = { reference: reference.trim(), email: email.trim().toLowerCase() }
    if (attempt.current?.reference !== normalized.reference || attempt.current?.email !== normalized.email) {
      attempt.current = { ...normalized, requestId: crypto.randomUUID() }
    }
    busy.current = true; setWorking(true); setError("")
    try {
      const response = await fetch("/api/public/fiscal-sponsorship/recover", {
        method: "POST", credentials: "same-origin", cache: "no-store", signal: AbortSignal.timeout(10000),
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...attempt.current, captchaToken }),
      })
      const result = await response.json()
      if (!response.ok || result.ok !== true) { setError(result.error || "We couldn’t confirm your request. Please retry."); return }
      setDone(true)
    } catch { setError("We couldn’t confirm your request. Please retry.") }
    finally { busy.current = false; setWorking(false); setCaptchaToken(""); captchaRef.current?.resetCaptcha() }
  }

  return <section className="mx-auto w-full max-w-lg px-4 py-8" aria-labelledby="recovery-title">
    <h1 id="recovery-title" className="text-2xl font-normal tracking-tight">Access your application</h1>
    <p className="mt-1 text-sm leading-6 text-muted-foreground">Request a fresh private link. No account required.</p>
    {done ? <div role="status" className="mt-5 rounded-xl border p-4 text-sm leading-6">
      If the reference and email match an application, we’ll email an access link. Check your inbox and spam folder; another recent request may already be on its way.
    </div> : <form className="mt-5" onSubmit={(event) => { event.preventDefault(); void submit() }}>
      <fieldset disabled={working || !enabled} className="min-w-0">
        <legend className="sr-only">Application access details</legend>
        <FieldGroup className="gap-4">
          <Field className="gap-2"><FieldLabel htmlFor="recovery-reference">Application reference</FieldLabel>
            <Input id="recovery-reference" name="reference" value={reference} onChange={(event) => setReference(event.target.value)} required maxLength={36} spellCheck={false} autoCapitalize="none" autoComplete="off" className="bg-white shadow-none dark:bg-input/30" />
            <FieldDescription>Find this in your application receipt or confirmation email.</FieldDescription>
          </Field>
          <Field className="gap-2"><FieldLabel htmlFor="recovery-email">Application email</FieldLabel>
            <Input id="recovery-email" name="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={254} className="bg-white shadow-none dark:bg-input/30" />
          </Field>
          {enabled ? <HCaptchaWidget size="compact" captchaRef={captchaRef} onVerify={setCaptchaToken} onExpire={() => setCaptchaToken("")} onError={setError} /> : <p role="status" className="text-sm text-muted-foreground">Access links are temporarily unavailable. Please contact us below.</p>}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="min-h-11 w-fit rounded-full shadow-none">{working ? "Requesting…" : "Email access link"}</Button>
        </FieldGroup>
      </fieldset>
    </form>}
    <p className="mt-5 text-xs leading-5 text-muted-foreground">Can’t find your reference? Contact <a href="mailto:fs@coachhousesolutions.org" className="underline focus-ring">fs@coachhousesolutions.org</a>.</p>
  </section>
}
