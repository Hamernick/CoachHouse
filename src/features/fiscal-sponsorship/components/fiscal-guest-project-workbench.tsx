"use client"

import { FiscalGuestOrganizationLink } from "./fiscal-guest-organization-link"
import { FiscalGuestEmailStatus } from "./fiscal-guest-email-status"
import { buildFiscalSponsorshipProjectWorkbenchData } from "../lib/project-workbench-data"
import type { FiscalSponsorshipApplicationRecord, FiscalSponsorshipProjectAssetOption, FiscalSponsorshipProjectWorkflowSummary } from "../types"
import { connectFiscalSponsorshipDocumentAsset, reviewFiscalSponsorshipDocument, reviewFiscalSponsorshipApplication } from "../actions"
import { FiscalSponsorshipProjectWorkbench } from "./fiscal-sponsorship-project-workbench"
import { FiscalGuestApplicationDetails } from "./fiscal-guest-application-details"

export function FiscalGuestProjectWorkbench({
  projectId, projectName, application, workflow, emailDelivery, projectAssets = [],
}: {
  emailDelivery?: { recipient: string; status: string; queuedAt: string; occurredAt: string | null }[] | null
  projectAssets?: FiscalSponsorshipProjectAssetOption[]
  projectId: string
  projectName: string
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
    <>
      <FiscalGuestEmailStatus deliveries={emailDelivery} />
      <FiscalGuestOrganizationLink key={projectId} projectId={projectId} applicantEmail={application.primaryEmail ?? ""} />
      <FiscalSponsorshipProjectWorkbench
        className="max-w-none shadow-none"
        data={data}
        applicationActionLabel="View"
        renderApplicationEditor={({ open }) => open ? <FiscalGuestApplicationDetails application={application} /> : null}
        canConnectDocuments
        projectAssets={projectAssets}
        onOpenAssets={() => document.getElementById("fiscal-sponsorship-required-documents")?.scrollIntoView({ block: "start" })}
        connectFiscalSponsorshipDocumentAssetAction={connectFiscalSponsorshipDocumentAsset}
        reviewFiscalSponsorshipDocumentAction={reviewFiscalSponsorshipDocument}
        reviewFiscalSponsorshipApplicationAction={reviewFiscalSponsorshipApplication}
      />
    </>
  )
}
