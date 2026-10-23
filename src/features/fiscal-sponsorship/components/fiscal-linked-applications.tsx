"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { loadLinkedFiscalApplications } from "../actions"
import { guestFollowupHref } from "../lib/guest-followup"
import { FISCAL_SPONSORSHIP_APPLICATION_STATUS_OPTIONS } from "../lib/application-draft"

export function FiscalLinkedApplications() {
  const [result, setResult] = useState<Awaited<ReturnType<typeof loadLinkedFiscalApplications>> | null>(null)
  const [loading, setLoading] = useState(false)
  const load = useCallback(async () => {
    setLoading(true)
    try { setResult(await loadLinkedFiscalApplications()) }
    catch { setResult({ applications: [], error: "Your saved applications couldn’t load. Please retry." }) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])
  if (!result || (!result.error && !result.applications.length)) return null
  return <section aria-label="Your recent fiscal sponsorship applications" className="my-4 min-w-0 space-y-2">
    <h2 className="text-sm font-medium">Your recent applications</h2>
    {result.error && <div role="status" className="text-sm text-muted-foreground">
      <p>{result.error}</p>
      <Button variant="link" disabled={loading} onClick={() => { void load() }} className="min-h-11 px-0">{loading ? "Retrying…" : "Retry"}</Button>
    </div>}
    <ul className="space-y-1">{result.applications.map((application) => <li key={application.reference}>
      <Link href={guestFollowupHref(application.reference)} className="focus-ring flex min-h-11 min-w-0 items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-muted/50">
        <span className="min-w-0 break-words text-sm">{application.projectName}</span>
        <Badge variant="secondary" className="shrink-0">{FISCAL_SPONSORSHIP_APPLICATION_STATUS_OPTIONS.find((status) => status.value === application.status)?.label}</Badge>
      </Link>
    </li>)}</ul>
  </section>
}
