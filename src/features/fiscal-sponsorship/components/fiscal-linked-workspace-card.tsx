"use client"

import { useEffect, useState, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { loadFiscalOrganizationApplications } from "../actions"
import { FISCAL_SPONSORSHIP_APPLICATION_STATUS_OPTIONS } from "../lib/application-draft"
import { guestFollowupHref } from "../lib/guest-followup"
import { FiscalSponsorshipWorkspaceCardSurface } from "./fiscal-sponsorship-workspace-card-surface"

type Result = Awaited<ReturnType<typeof loadFiscalOrganizationApplications>>

export function FiscalLinkedWorkspaceCard({ organizationId, children }: { organizationId: string; children: ReactNode }) {
  const [loaded, setLoaded] = useState<{ organizationId: string; result: Result } | null>(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let current = true
    void loadFiscalOrganizationApplications(organizationId).then((result) => {
      if (current) setLoaded({ organizationId, result })
    }).catch(() => { if (current) setLoaded({ organizationId, result: { applications: [], error: "Unable to load the application." } }) })
    return () => { current = false }
  }, [organizationId, attempt])
  const result = loaded?.organizationId === organizationId ? loaded.result : null
  if (!result) return <FiscalSponsorshipWorkspaceCardSurface draggable applicationSummary={{ name: "Fiscal sponsorship", status: "Loading application…" }} primaryActionLabel="Loading…" />
  if (result.error) return <FiscalSponsorshipWorkspaceCardSurface draggable applicationSummary={{ name: "Fiscal sponsorship", status: result.error }}
    applicationLinks={<Button variant="outline" className="mx-4 mt-3" onClick={() => { setLoaded(null); setAttempt((value) => value + 1) }}>Retry</Button>} primaryActionLabel="Application unavailable" />
  const application = result.applications[0]
  if (!application) return children
  const status = FISCAL_SPONSORSHIP_APPLICATION_STATUS_OPTIONS.find((option) => option.value === application.status)?.label ?? application.status
  return <FiscalSponsorshipWorkspaceCardSurface draggable
    applicationSummary={{ name: application.projectName, status }}
    primaryActionLabel={application.status === "needs_info" ? "Update application" : "View application"}
    openFlowHref={guestFollowupHref(application.reference)} />
}
