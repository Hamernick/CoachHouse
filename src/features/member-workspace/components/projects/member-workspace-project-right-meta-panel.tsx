"use client"

import type { ReactNode } from "react"

import {
  BacklogCard,
  Separator,
  type ProjectDetails,
} from "@/features/platform-admin-dashboard"
import {
  FiscalSponsorshipWorkflowTimeline,
  type FiscalSponsorshipProjectWorkflowEvent,
  type FiscalSponsorshipProjectWorkflowSummary,
} from "@/features/fiscal-sponsorship"
import type { MemberWorkspaceAdminOrganizationSummary } from "../../types"
import { ProjectScheduleTimeline, type UpdateScheduleAction } from "./project-schedule-timeline"
import { MemberWorkspaceProjectOrganizationCard } from "./member-workspace-project-organization-card"
import { MemberWorkspaceProjectQuickLinksCard } from "./member-workspace-project-quick-links-card"

function getEventMetadataValue(metadata: unknown, key: string) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null
  }

  const value = (metadata as Record<string, unknown>)[key]
  return typeof value === "string" && value.trim() ? value : null
}

function resolveFiscalUpdateHref({
  event,
  summary,
}: {
  event: FiscalSponsorshipProjectWorkflowEvent
  summary: FiscalSponsorshipProjectWorkflowSummary
}) {
  const documentIds = [
    "documentId",
    "executedDocumentId",
    "auditDocumentId",
    "partialDocumentId",
  ]
    .map((key) => getEventMetadataValue(event.metadata, key))
    .filter((documentId) => documentId !== null)
  const documents = [
    summary.latestAgreementDocument,
    summary.latestExecutedAgreementDocument,
    summary.latestAuditCertificateDocument,
    ...summary.requiredDocuments,
  ].filter((document) => document !== null)
  const eventDocument = documents.find((document) =>
    documentIds.includes(document.id)
  )

  if (eventDocument?.viewHref) return eventDocument.viewHref

  if (event.eventType.startsWith("application_")) {
    return "#fiscal-sponsorship-application-intake"
  }

  if (
    event.eventType.startsWith("document_") ||
    event.eventType === "w9_completed"
  ) {
    return "#fiscal-sponsorship-required-documents"
  }

  if (event.eventType === "agreement_generated") {
    return (
      summary.latestAgreementDocument?.viewHref ??
      "#fiscal-sponsorship-documents"
    )
  }

  if (
    event.eventType.startsWith("agreement_") ||
    event.eventType.startsWith("docuseal_") ||
    event.eventType.includes("signature") ||
    event.eventType.endsWith("_signed")
  ) {
    return (
      summary.latestExecutedAgreementDocument?.viewHref ??
      summary.latestSignaturePacket?.applicantSigningHref ??
      summary.latestSignaturePacket?.coachSigningHref ??
      "#fiscal-sponsorship-documents"
    )
  }

  return "#fiscal-sponsorship-project-workbench"
}

export function MemberWorkspaceProjectRightMetaPanel({
  adminBilling,
  updateScheduleAction,
  project,
  organizationSummary,
  fiscalSponsorshipWorkflowSummary,
  onNavigateFiscalUpdate,
  createQuickLinkAction,
  updateQuickLinkAction,
  deleteQuickLinkAction,
}: {
  adminBilling?: ReactNode
  updateScheduleAction?: UpdateScheduleAction
  project: ProjectDetails
  organizationSummary: MemberWorkspaceAdminOrganizationSummary
  fiscalSponsorshipWorkflowSummary?: FiscalSponsorshipProjectWorkflowSummary | null
  onNavigateFiscalUpdate?: (href: string) => void
  createQuickLinkAction?: (input: {
    projectId: string
    name: string
    url: string
  }) => Promise<{ ok: true; linkId: string } | { error: string }>
  updateQuickLinkAction?: (input: {
    projectId: string
    linkId: string
    name: string
    url: string
  }) => Promise<{ ok: true; linkId: string } | { error: string }>
  deleteQuickLinkAction?: (input: {
    projectId: string
    linkId: string
  }) => Promise<{ ok: true } | { error: string }>
}) {
  return (
    <aside className="flex flex-col gap-10 p-4 pt-8 lg:sticky lg:self-start">
      {fiscalSponsorshipWorkflowSummary ? (
        <>
          <FiscalSponsorshipWorkflowTimeline
            events={fiscalSponsorshipWorkflowSummary.events ?? []}
            onNavigate={onNavigateFiscalUpdate}
            resolveEventHref={(event) =>
              resolveFiscalUpdateHref({
                event,
                summary: fiscalSponsorshipWorkflowSummary,
              })
            }
            variant="sidebar"
          />
          <Separator />
        </>
      ) : null}
      <ProjectScheduleTimeline projectId={project.id} time={project.time} onSave={updateScheduleAction} />
      <Separator />
      <BacklogCard backlog={project.backlog} />
      <Separator />
      <MemberWorkspaceProjectOrganizationCard
        organization={organizationSummary}
      />
      {adminBilling ? (
        <>
          <Separator />
          {adminBilling}
        </>
      ) : null}
      <Separator />
      <MemberWorkspaceProjectQuickLinksCard
        links={project.quickLinks}
        projectId={project.id}
        createQuickLinkAction={createQuickLinkAction}
        updateQuickLinkAction={updateQuickLinkAction}
        deleteQuickLinkAction={deleteQuickLinkAction}
      />
    </aside>
  )
}
