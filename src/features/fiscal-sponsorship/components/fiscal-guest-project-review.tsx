"use client"

import Link from "next/link"
import { FiscalGuestEmailStatus } from "./fiscal-guest-email-status"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { buildFiscalSponsorshipProjectWorkbenchData } from "../lib/project-workbench-data"
import type { FiscalSponsorshipApplicationRecord, FiscalSponsorshipProjectWorkflowSummary } from "../types"
import { reviewFiscalSponsorshipApplication } from "../actions"
import { FiscalSponsorshipProjectWorkbench } from "./fiscal-sponsorship-project-workbench"
import { FiscalGuestApplicationDetails } from "./fiscal-guest-application-details"

export function FiscalGuestProjectReview({
  projectId, projectName, accountLinked, emailVerified, application, workflow, emailDelivery,
}: {
  emailDelivery?: { recipient: string; status: string; queuedAt: string; occurredAt: string | null }[] | null
  projectId: string
  projectName: string
  accountLinked: boolean
  emailVerified: boolean
  application: FiscalSponsorshipApplicationRecord
  workflow: FiscalSponsorshipProjectWorkflowSummary
}) {
  const data = buildFiscalSponsorshipProjectWorkbenchData({
    project: { id: projectId, name: projectName, description: application.projectDescription,
      locationLabel: application.projectLocation },
    organization: { name: application.applicantFullName || "Guest applicant", ownerName: application.applicantFullName },
    workflowSummary: { ...workflow, canCompleteW9: false },
  })
  data.metrics = data.metrics.filter((metric) => metric.id !== "team")
  return (
    <section aria-labelledby="guest-project-title" className="mx-auto w-full max-w-3xl space-y-5 px-4 py-6 sm:px-6">
      <header>
        <Button asChild variant="link" className="h-11 touch-manipulation px-0 text-muted-foreground sm:h-9"><Link href="/projects">Projects</Link></Button>
        <h1 id="guest-project-title" className="text-2xl font-medium tracking-tight text-balance">{projectName}</h1>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge variant="secondary">{accountLinked ? "Account linked" : "Guest application"}</Badge>
          <Badge variant="outline">{emailVerified ? "Email verified" : "Email not verified"}</Badge>
        </div>
      </header>
      <section aria-labelledby="guest-overview-title" className="rounded-2xl border p-4">
        <h2 id="guest-overview-title" className="text-base font-medium">Overview</h2>
        <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">{application.projectDescription}</p>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-xs text-muted-foreground">Applicant</dt><dd>{application.applicantFullName}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Location</dt><dd>{application.projectLocation}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Email</dt><dd className="break-words">{application.primaryEmail}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Phone</dt><dd>{application.phoneNumber || "Not provided"}</dd></div>
        </dl>
      </section>
      <FiscalGuestEmailStatus deliveries={emailDelivery} />
      <FiscalSponsorshipProjectWorkbench
        className="max-w-none shadow-none"
        data={data}
        applicationActionLabel="View"
        renderApplicationEditor={({ open }) => open ? <FiscalGuestApplicationDetails application={application} /> : null}
        reviewFiscalSponsorshipApplicationAction={reviewFiscalSponsorshipApplication}
      />
    </section>
  )
}
