"use server"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase"
import type {
  FiscalSponsorshipApplicationStatus,
  FiscalSponsorshipDocumentKey,
  FiscalSponsorshipDocumentKind,
  FiscalSponsorshipDocumentReviewStatus,
  FiscalSponsorshipDocumentStatus,
  FiscalSponsorshipLegalEntityType,
  FiscalSponsorshipProjectWorkflowSummary,
  FiscalSponsorshipSignaturePacketStatus,
} from "../types"
import { resolveDocuSealSubmitterSigningHref } from "../lib/docuseal-submission"
import {
  loadFiscalWorkflowEvents,
  mapFiscalWorkflowEventSummary,
} from "./workflow-event-summary"
import {
  buildWorkflowTableError,
  canManageFiscalSponsorshipForOrganization,
  isMissingFiscalWorkflowTableError,
  resolveProjectAndContext,
} from "./workflow-support"

const APPLICATION_STATUSES = new Set<FiscalSponsorshipApplicationStatus>([
  "draft",
  "submitted",
  "in_review",
  "needs_info",
  "approved",
  "declined",
  "agreement_ready",
  "signed",
  "countersigned",
])

const DOCUMENT_STATUSES = new Set<FiscalSponsorshipDocumentStatus>([
  "draft",
  "generated",
  "sent_for_signature",
  "partially_signed",
  "executed",
  "voided",
  "error",
])

const DOCUMENT_KINDS = new Set<FiscalSponsorshipDocumentKind>([
  "application",
  "agreement",
  "executed_agreement",
  "audit_certificate",
  "tax_form",
  "regrant",
])

const DOCUMENT_KEYS = new Set<FiscalSponsorshipDocumentKey>([
  "tax_id_confirmation",
  "governing_documents",
  "formation_or_good_standing",
  "budget_support",
  "fundraising_materials",
  "insurance",
  "grant_request_support",
  "grantee_report",
  "closeout_report",
  "additional_info",
])

const DOCUMENT_REVIEW_STATUSES = new Set<FiscalSponsorshipDocumentReviewStatus>(
  ["pending", "accepted", "needs_info", "rejected", "not_required"]
)

const LEGAL_ENTITY_TYPES = new Set<FiscalSponsorshipLegalEntityType>([
  "corporation",
  "individual",
  "informal_group_with_ein",
  "llc",
  "partnership",
  "other",
])

const PACKET_STATUSES = new Set<FiscalSponsorshipSignaturePacketStatus>([
  "draft",
  "sent",
  "coach_signed",
  "applicant_signed",
  "completed",
  "declined",
  "voided",
  "error",
])

type ApplicationSummaryRow = {
  id: string
  legal_entity_type: string | null
  primary_email: string | null
  status: string
  reviewed_at: string | null
  review_notes: string | null
  submitted_at: string | null
}

type FiscalDocumentSummaryRow = {
  id: string
  asset_id: string | null
  document_key: string | null
  generated_at: string | null
  kind: string
  project_id: string
  review_notes: string | null
  review_status: string
  reviewed_at: string | null
  status: string
  storage_path: string | null
  storage_bucket: string
  title: string
  uploaded_at: string | null
  version: number
}

type SignaturePacketSummaryRow = {
  id: string
  applicant_signer_email: string | null
  applicant_signer_id: string | null
  coach_signer_email: string | null
  completed_at: string | null
  provider: string
  provider_payload: unknown
  provider_submission_id: string | null
  sent_at: string | null
  status: string
}

type FiscalWorkflowSummaryClient = SupabaseClient<Database, "public">

function normalizeApplicationStatus(
  status: string
): FiscalSponsorshipApplicationStatus {
  return APPLICATION_STATUSES.has(status as FiscalSponsorshipApplicationStatus)
    ? (status as FiscalSponsorshipApplicationStatus)
    : "draft"
}

function normalizeDocumentStatus(
  status: string
): FiscalSponsorshipDocumentStatus {
  return DOCUMENT_STATUSES.has(status as FiscalSponsorshipDocumentStatus)
    ? (status as FiscalSponsorshipDocumentStatus)
    : "draft"
}

function normalizeDocumentKind(kind: string): FiscalSponsorshipDocumentKind {
  return DOCUMENT_KINDS.has(kind as FiscalSponsorshipDocumentKind)
    ? (kind as FiscalSponsorshipDocumentKind)
    : "agreement"
}

function normalizeDocumentKey(
  key: string | null | undefined
): FiscalSponsorshipDocumentKey | null {
  return key && DOCUMENT_KEYS.has(key as FiscalSponsorshipDocumentKey)
    ? (key as FiscalSponsorshipDocumentKey)
    : null
}

function normalizeDocumentReviewStatus(
  status: string | null | undefined
): FiscalSponsorshipDocumentReviewStatus {
  return status &&
    DOCUMENT_REVIEW_STATUSES.has(
      status as FiscalSponsorshipDocumentReviewStatus
    )
    ? (status as FiscalSponsorshipDocumentReviewStatus)
    : "pending"
}

function normalizeLegalEntityType(
  value: string | null | undefined
): FiscalSponsorshipLegalEntityType | null {
  return value &&
    LEGAL_ENTITY_TYPES.has(value as FiscalSponsorshipLegalEntityType)
    ? (value as FiscalSponsorshipLegalEntityType)
    : null
}

function normalizePacketStatus(
  status: string
): FiscalSponsorshipSignaturePacketStatus {
  return PACKET_STATUSES.has(status as FiscalSponsorshipSignaturePacketStatus)
    ? (status as FiscalSponsorshipSignaturePacketStatus)
    : "draft"
}

function buildProjectAssetHref({
  assetId,
  download = false,
  projectId,
}: {
  assetId: string | null
  download?: boolean
  projectId: string
}) {
  if (!assetId) return null

  const search = new URLSearchParams({
    assetId,
    projectId,
  })
  if (download) search.set("download", "1")

  return `/api/account/project-assets?${search.toString()}`
}

function buildFiscalDocumentHref({
  documentId,
  download = false,
  storageBucket,
}: {
  documentId: string
  download?: boolean
  storageBucket: string
}) {
  if (storageBucket === "project-assets") return null
  return `/api/fiscal-sponsorship/documents/${documentId}${download ? "?download=1" : ""}`
}

function mapFiscalDocumentSummary(
  document: FiscalDocumentSummaryRow | null | undefined
) {
  if (!document) return null

  return {
    assetId: document.asset_id,
    downloadHref:
      buildProjectAssetHref({
        assetId: document.asset_id,
        download: true,
        projectId: document.project_id,
      }) ??
      buildFiscalDocumentHref({
        documentId: document.id,
        download: true,
        storageBucket: document.storage_bucket,
      }),
    generatedAt: document.generated_at,
    id: document.id,
    kind: normalizeDocumentKind(document.kind),
    documentKey: normalizeDocumentKey(document.document_key),
    reviewStatus: normalizeDocumentReviewStatus(document.review_status),
    reviewNotes: document.review_notes,
    reviewedAt: document.reviewed_at,
    status: normalizeDocumentStatus(document.status),
    storagePath: document.storage_path,
    title: document.title,
    uploadedAt: document.uploaded_at,
    version: document.version,
    viewHref:
      buildProjectAssetHref({
        assetId: document.asset_id,
        projectId: document.project_id,
      }) ??
      buildFiscalDocumentHref({
        documentId: document.id,
        storageBucket: document.storage_bucket,
      }),
  }
}

async function loadLatestFiscalDocument({
  applicationId,
  kind,
  supabase,
}: {
  applicationId: string
  kind: FiscalSponsorshipDocumentKind
  supabase: FiscalWorkflowSummaryClient
}) {
  return supabase
    .from("fiscal_sponsorship_documents")
    .select(
      "id, asset_id, document_key, generated_at, kind, project_id, review_notes, review_status, reviewed_at, status, storage_bucket, storage_path, title, uploaded_at, version"
    )
    .eq("application_id", applicationId)
    .eq("kind", kind)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle<FiscalDocumentSummaryRow>()
}

async function loadRequiredFiscalDocuments({
  applicationId,
  supabase,
}: {
  applicationId: string
  supabase: FiscalWorkflowSummaryClient
}) {
  return supabase
    .from("fiscal_sponsorship_documents")
    .select(
      "id, asset_id, document_key, generated_at, kind, project_id, review_notes, review_status, reviewed_at, status, storage_bucket, storage_path, title, uploaded_at, version"
    )
    .eq("application_id", applicationId)
    .not("document_key", "is", null)
    .order("created_at", { ascending: false })
    .returns<FiscalDocumentSummaryRow[]>()
}

function getLatestRequiredDocumentRows(
  documents: FiscalDocumentSummaryRow[] | null | undefined
) {
  const latestByKey = new Map<
    FiscalSponsorshipDocumentKey,
    FiscalDocumentSummaryRow
  >()

  for (const document of documents ?? []) {
    const key = normalizeDocumentKey(document.document_key)
    if (!key || latestByKey.has(key)) continue
    latestByKey.set(key, document)
  }

  return Array.from(latestByKey.values())
}

export async function loadFiscalSponsorshipProjectWorkflowSummary(
  projectId: string
): Promise<FiscalSponsorshipProjectWorkflowSummary | { error: string }> {
  const context = await resolveProjectAndContext(projectId)
  if ("error" in context) return context

  const { data: application, error: applicationError } = await context.supabase
    .from("fiscal_sponsorship_applications")
    .select(
      "id, legal_entity_type, primary_email, status, reviewed_at, review_notes, submitted_at"
    )
    .eq("project_id", context.project.id)
    .eq("org_id", context.project.org_id)
    .maybeSingle<ApplicationSummaryRow>()

  if (applicationError) {
    return isMissingFiscalWorkflowTableError(applicationError)
      ? buildWorkflowTableError()
      : { error: "Unable to load fiscal sponsorship workflow status." }
  }

  if (!application) {
    return {
      applicationId: null,
      applicationStatus: null,
      canCompleteW9: false,
      events: [],
      legalEntityType: null,
      latestAuditCertificateDocument: null,
      latestAgreementDocument: null,
      latestExecutedAgreementDocument: null,
      latestSignaturePacket: null,
      requiredDocuments: [],
      reviewedAt: null,
      reviewNotes: null,
      submittedAt: null,
    }
  }

  const { data: agreementDocument, error: agreementDocumentError } =
    await loadLatestFiscalDocument({
      applicationId: application.id,
      kind: "agreement",
      supabase: context.supabase,
    })

  if (agreementDocumentError) {
    return isMissingFiscalWorkflowTableError(agreementDocumentError)
      ? buildWorkflowTableError()
      : { error: "Unable to load fiscal sponsorship agreement status." }
  }

  const { data: executedAgreementDocument, error: executedDocumentError } =
    await loadLatestFiscalDocument({
      applicationId: application.id,
      kind: "executed_agreement",
      supabase: context.supabase,
    })

  if (executedDocumentError) {
    return isMissingFiscalWorkflowTableError(executedDocumentError)
      ? buildWorkflowTableError()
      : { error: "Unable to load executed fiscal sponsorship agreement." }
  }

  const { data: auditCertificateDocument, error: auditDocumentError } =
    await loadLatestFiscalDocument({
      applicationId: application.id,
      kind: "audit_certificate",
      supabase: context.supabase,
    })

  if (auditDocumentError) {
    return isMissingFiscalWorkflowTableError(auditDocumentError)
      ? buildWorkflowTableError()
      : { error: "Unable to load fiscal sponsorship audit certificate." }
  }

  const { data: requiredDocuments, error: requiredDocumentsError } =
    await loadRequiredFiscalDocuments({
      applicationId: application.id,
      supabase: context.supabase,
    })

  if (requiredDocumentsError) {
    return isMissingFiscalWorkflowTableError(requiredDocumentsError)
      ? buildWorkflowTableError()
      : { error: "Unable to load required fiscal sponsorship documents." }
  }

  const { data: signaturePacket, error: signaturePacketError } =
    await context.supabase
      .from("fiscal_sponsorship_signature_packets")
      .select(
        [
          "id",
          "applicant_signer_email",
          "applicant_signer_id",
          "coach_signer_email",
          "completed_at",
          "provider",
          "provider_payload",
          "provider_submission_id",
          "sent_at",
          "status",
        ].join(", ")
      )
      .eq("application_id", application.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<SignaturePacketSummaryRow>()

  if (signaturePacketError) {
    return isMissingFiscalWorkflowTableError(signaturePacketError)
      ? buildWorkflowTableError()
      : { error: "Unable to load fiscal sponsorship signature status." }
  }

  const { data: events, error: eventsError } = await loadFiscalWorkflowEvents({
    orgId: context.project.org_id,
    projectId: context.project.id,
    supabase: context.supabase,
  })

  if (eventsError) {
    return isMissingFiscalWorkflowTableError(eventsError)
      ? buildWorkflowTableError()
      : { error: "Unable to load fiscal sponsorship activity." }
  }

  const canViewCoachSigningLink =
    await canManageFiscalSponsorshipForOrganization({
      accessLevel: context.profileAudience.platformAccessLevel,
      organizationId: context.project.org_id,
      projectId: context.project.id,
      supabase: context.supabase,
      userId: context.user.id,
    })

  return {
    applicationId: application.id,
    applicationStatus: normalizeApplicationStatus(application.status),
    canCompleteW9:
      Boolean(application.primary_email) &&
      application.primary_email?.trim().toLowerCase() ===
        context.user.email?.trim().toLowerCase(),
    events: (events ?? []).map(mapFiscalWorkflowEventSummary),
    legalEntityType: normalizeLegalEntityType(application.legal_entity_type),
    latestAgreementDocument: mapFiscalDocumentSummary(agreementDocument),
    latestAuditCertificateDocument: mapFiscalDocumentSummary(
      auditCertificateDocument
    ),
    latestExecutedAgreementDocument: mapFiscalDocumentSummary(
      executedAgreementDocument
    ),
    requiredDocuments: getLatestRequiredDocumentRows(requiredDocuments)
      .map(mapFiscalDocumentSummary)
      .filter((document) => document !== null),
    latestSignaturePacket: signaturePacket
      ? {
          applicantSigningHref:
            signaturePacket.provider === "native"
              ? signaturePacket.applicant_signer_id === context.user.id
                ? `/fiscal-sponsorship/sign/${signaturePacket.id}`
                : null
              : resolveDocuSealSubmitterSigningHref({
                  email: signaturePacket.applicant_signer_email,
                  payload: signaturePacket.provider_payload,
                  role: "Applicant",
                }),
          applicantSignerEmail: signaturePacket.applicant_signer_email,
          coachSigningHref: canViewCoachSigningLink
            ? signaturePacket.provider === "native"
              ? `/fiscal-sponsorship/sign/${signaturePacket.id}`
              : resolveDocuSealSubmitterSigningHref({
                  email: signaturePacket.coach_signer_email,
                  payload: signaturePacket.provider_payload,
                  role: "Coach House",
                })
            : null,
          coachSignerEmail: signaturePacket.coach_signer_email,
          completedAt: signaturePacket.completed_at,
          id: signaturePacket.id,
          provider: signaturePacket.provider,
          providerSubmissionId: signaturePacket.provider_submission_id,
          sentAt: signaturePacket.sent_at,
          status: normalizePacketStatus(signaturePacket.status),
        }
      : null,
    reviewedAt: application.reviewed_at,
    reviewNotes: application.review_notes,
    submittedAt: application.submitted_at,
  }
}
