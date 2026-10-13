"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { guestFollowupSchema, type GuestFollowup } from "../lib/guest-followup"
import { guestProfileHref } from "../lib/guest-profile"
import { FISCAL_SPONSORSHIP_APPLICATION_STATUS_OPTIONS } from "../lib/application-draft"
import { FiscalGuestCorrections } from "./fiscal-guest-corrections"

export function FiscalGuestApplication({ reference, profileImportEnabled = false }: { reference: string; profileImportEnabled?: boolean }) {
  const [application, setApplication] = useState<GuestFollowup | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const load = useCallback(async () => {
    setLoading(true); setError(""); setApplication(null)
    try {
      const response = await fetch("/api/public/fiscal-sponsorship/application", { method: "POST", credentials: "same-origin", cache: "no-store",
        signal: AbortSignal.timeout(10000), headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operation: "read", reference }) })
      const result = await response.json()
      if (!response.ok) { setError(typeof result.error === "string" ? result.error : "Couldn’t load your application. Please retry."); return }
      setApplication(guestFollowupSchema.parse(result))
    } catch { setError("Couldn’t load your application. Please retry.") }
    finally { setLoading(false) }
  }, [reference])
  useEffect(() => { void load() }, [load])
  const status = application?.status === "needs_info" ? "Updates requested" : FISCAL_SPONSORSHIP_APPLICATION_STATUS_OPTIONS.find((item) => item.value === application?.status)?.label
  return <section className="mx-auto w-full max-w-2xl px-4 py-8" aria-labelledby="guest-application-title">
    <h1 id="guest-application-title" className="text-2xl font-normal tracking-tight">Your application</h1>
    <p className="mt-1 text-sm text-muted-foreground">Private application status. No account required.</p>
    {loading && <div role="status" className="mt-4 space-y-2"><span className="sr-only">Loading application…</span><Skeleton className="h-6 w-48" /><Skeleton className="h-16 w-full rounded-xl" /></div>}
    {error && <div role="alert" className="mt-4 rounded-xl border p-4 text-sm"><p>{error}</p><Button type="button" variant="outline" onClick={() => { void load() }} className="mt-3 min-h-11 rounded-full shadow-none">Retry</Button><p className="mt-2 text-muted-foreground"><Link className="underline focus-ring" href={`/documentation/fiscal-sponsorship/recover?application=${reference}`}>Request a new access link</Link>.</p></div>}
    {application && <>
      <div className="mt-5 rounded-2xl border p-4">
        <div className="flex flex-wrap items-start justify-between gap-2"><h2 className="min-w-0 break-words text-lg font-medium">{application.projectName}</h2><Badge variant="secondary">{status}</Badge></div>
        <p className="mt-2 text-sm text-muted-foreground">{application.status === "needs_info" ? "Review the request below and submit your corrections."
          : ["submitted", "in_review"].includes(application.status) ? "Coach House is reviewing your application. We’ll email you when there’s an update."
            : application.status === "declined" ? "Coach House has completed its review. Contact us if you have questions."
              : "Coach House will contact you about the next steps."}</p>
        {application.reviewNote && <div className="mt-3 border-t pt-3"><h3 className="text-sm font-medium">From your reviewer</h3><p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">{application.reviewNote}</p></div>}
      </div>
      {application.status === "needs_info" && application.application ? <FiscalGuestCorrections key={application.version} application={application} onReload={() => { void load() }} />
        : <Button type="button" variant="outline" onClick={() => { void load() }} className="mt-3 min-h-11 rounded-full shadow-none">Refresh status</Button>}
      <p className="mt-4 break-all text-xs text-muted-foreground">Reference: {reference}</p>
      {profileImportEnabled && <Button asChild variant="link" className="mt-2 min-h-11 px-0"><Link href={guestProfileHref(reference)}>Optionally create your organization profile</Link></Button>}
    </>}
  </section>
}
