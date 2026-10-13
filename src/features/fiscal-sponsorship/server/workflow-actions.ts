"use server"

import type {
  ConnectFiscalSponsorshipDocumentAssetInput,
  ConnectFiscalSponsorshipDocumentAssetResult,
  FiscalSponsorshipReviewInput,
  FiscalSponsorshipWorkflowActionResult,
  ReviewFiscalSponsorshipDocumentInput,
  ReviewFiscalSponsorshipDocumentResult,
} from "../types"
import {
  formatDocumentKeyLabel,
  loadProjectAssetForFiscalDocument,
  normalizeFiscalDocumentKey,
} from "./workflow-document-actions-support"
import {
  notifyFiscalApplicationReviewed,
  notifyFiscalApplicationSubmitted,
  notifyFiscalDocumentConnected,
  notifyFiscalDocumentReviewed,
} from "./workflow-notifications"
import {
  buildWorkflowTableError,
  canManageFiscalSponsorshipForOrganization,
  canEditFiscalProject,
  isMissingFiscalWorkflowTableError,
  loadFiscalApplicationForProject,
  revalidateFiscalApplicationRoutes,
  resolveProjectAndContext,
} from "./workflow-support"
import {
  transitionFiscalApplicationReview,
  transitionFiscalApplicationSubmission,
  transitionFiscalDocumentConnection,
  transitionFiscalDocumentReview,
} from "./workflow-transition-support"
import { validateApplicationForSubmission } from "./workflow-validation"

const APPLICATION_REVIEW_DECISIONS = new Set([
  "approved",
  "declined",
  "needs_info",
])
const DOCUMENT_REVIEW_DECISIONS = new Set([
  "accepted",
  "needs_info",
  "not_required",
  "rejected",
])

function formatReviewDecisionLabel(decision: string) {
  return decision.replaceAll("_", " ")
}

function getRequiredReviewNoteError({
  decision,
  notes,
  subject,
}: {
  decision: string
  notes?: string | null
  subject: "application" | "document"
}) {
  if (
    decision !== "needs_info" &&
    decision !== "declined" &&
    decision !== "rejected"
  ) {
    return null
  }

  return notes?.trim()
    ? null
    : `Add a review note before marking this ${subject} ${formatReviewDecisionLabel(decision)}.`
}

export async function submitFiscalSponsorshipApplication(
  projectId: string
): Promise<FiscalSponsorshipWorkflowActionResult> {
  const context = await resolveProjectAndContext(projectId)
  if ("error" in context) return context

  if (
    !canEditFiscalProject({
      activeOrgId: context.activeOrg.orgId,
      activeOrgRole: context.activeOrg.role,
      isAdmin:
        context.profileAudience.isPlatformStaff ||
        context.profileAudience.isAdmin,
      project: context.project,
    })
  ) {
    return { error: "Only organization editors can submit this application." }
  }

  const loaded = await loadFiscalApplicationForProject(context)
  if ("error" in loaded) return loaded

  const validationError = validateApplicationForSubmission(loaded.application)
  if (validationError) {
    return { error: validationError }
  }

  const transition = await transitionFiscalApplicationSubmission({
    actorId: context.user.id,
    applicationId: loaded.application.id,
    expectedUpdatedAt: loaded.application.updated_at,
  })
  if ("error" in transition) return transition

  if (transition.transitioned) {
    await notifyFiscalApplicationSubmitted({
      actorId: context.user.id,
      application: loaded.application,
    })
  }

  revalidateFiscalApplicationRoutes(loaded.application.project_id)
  return { ok: true, applicationId: loaded.application.id }
}

export async function reviewFiscalSponsorshipApplication(
  input: FiscalSponsorshipReviewInput
): Promise<FiscalSponsorshipWorkflowActionResult> {
  if (!APPLICATION_REVIEW_DECISIONS.has(input.decision)) {
    return { error: "Choose a valid application review decision." }
  }

  const context = await resolveProjectAndContext(input.projectId)
  if ("error" in context) return context

  if (
    !(await canManageFiscalSponsorshipForOrganization({
      accessLevel: context.profileAudience.platformAccessLevel,
      organizationId: context.project.org_id,
      projectId: context.project.id,
      supabase: context.supabase,
      userId: context.user.id,
    }))
  ) {
    return {
      error:
        "Only the assigned Coach House reviewer can review this application.",
    }
  }

  const loaded = await loadFiscalApplicationForProject(context)
  if ("error" in loaded) return loaded
  if (!["submitted", "in_review"].includes(loaded.application.status)) {
    return {
      error: "Only a submitted application can be reviewed.",
    }
  }

  const reviewNotes = input.notes?.trim() || null
  const reviewNoteError = getRequiredReviewNoteError({
    decision: input.decision,
    notes: reviewNotes,
    subject: "application",
  })
  if (reviewNoteError) return { error: reviewNoteError }

  const transition = await transitionFiscalApplicationReview({
    actorId: context.user.id,
    applicationId: loaded.application.id,
    decision: input.decision,
    expectedUpdatedAt: loaded.application.updated_at,
    notes: reviewNotes,
  })
  if ("error" in transition) return transition

  if (transition.transitioned) {
    await notifyFiscalApplicationReviewed({
      actorId: context.user.id,
      application: loaded.application,
      decision: input.decision,
    })
  }

  revalidateFiscalApplicationRoutes(loaded.application.project_id)
  return { ok: true, applicationId: loaded.application.id }
}

export async function connectFiscalSponsorshipDocumentAsset(
  input: ConnectFiscalSponsorshipDocumentAssetInput
): Promise<ConnectFiscalSponsorshipDocumentAssetResult> {
  const context = await resolveProjectAndContext(input.projectId)
  if ("error" in context) return context

  if (
    !canEditFiscalProject({
      activeOrgId: context.activeOrg.orgId,
      activeOrgRole: context.activeOrg.role,
      isAdmin:
        context.profileAudience.isPlatformStaff ||
        context.profileAudience.isAdmin,
      project: context.project,
    })
  ) {
    return { error: "Only organization editors can connect fiscal documents." }
  }

  const documentKey = normalizeFiscalDocumentKey(input.documentKey)
  if (!documentKey) {
    return { error: "Choose a valid fiscal document requirement." }
  }

  const loaded = await loadFiscalApplicationForProject(context)
  if ("error" in loaded) return loaded

  const assetResult = await loadProjectAssetForFiscalDocument({
    assetId: input.assetId,
    orgId: loaded.application.org_id,
    projectId: loaded.application.project_id,
    supabase: context.supabase,
  })
  if ("error" in assetResult) return assetResult

  const title =
    input.title?.trim() ||
    assetResult.asset.name ||
    formatDocumentKeyLabel(documentKey)
  const transition = await transitionFiscalDocumentConnection({
    actorId: context.user.id,
    applicationId: loaded.application.id,
    assetId: assetResult.asset.id,
    documentKey,
    requirementLabel: formatDocumentKeyLabel(documentKey),
    title,
  })
  if ("error" in transition) return transition

  if (transition.transitioned) {
    await notifyFiscalDocumentConnected({
      actorId: context.user.id,
      application: loaded.application,
      documentId: transition.documentId,
      documentKey,
    })
  }

  revalidateFiscalApplicationRoutes(loaded.application.project_id)
  return { ok: true, documentId: transition.documentId }
}

export async function reviewFiscalSponsorshipDocument(
  input: ReviewFiscalSponsorshipDocumentInput
): Promise<ReviewFiscalSponsorshipDocumentResult> {
  if (!DOCUMENT_REVIEW_DECISIONS.has(input.decision)) {
    return { error: "Choose a valid document review decision." }
  }

  const context = await resolveProjectAndContext(input.projectId)
  if ("error" in context) return context

  if (
    !(await canManageFiscalSponsorshipForOrganization({
      accessLevel: context.profileAudience.platformAccessLevel,
      organizationId: context.project.org_id,
      projectId: context.project.id,
      supabase: context.supabase,
      userId: context.user.id,
    }))
  ) {
    return {
      error: "Only the assigned Coach House reviewer can review this document.",
    }
  }

  const loaded = await loadFiscalApplicationForProject(context)
  if ("error" in loaded) return loaded

  const reviewNotes = input.notes?.trim() || null
  const reviewNoteError = getRequiredReviewNoteError({
    decision: input.decision,
    notes: reviewNotes,
    subject: "document",
  })
  if (reviewNoteError) return { error: reviewNoteError }

  const { data: document, error: documentLoadError } = await context.supabase
    .from("fiscal_sponsorship_documents")
    .select(
      "asset_id, document_key, id, kind, mime, review_notes, review_status, status, title, updated_at"
    )
    .eq("id", input.documentId)
    .eq("application_id", loaded.application.id)
    .eq("project_id", loaded.application.project_id)
    .maybeSingle<{
      asset_id: string | null
      document_key: string | null
      id: string
      kind: string
      mime: string | null
      review_notes: string | null
      review_status: string
      status: string
      title: string
      updated_at: string
    }>()
  if (documentLoadError || !document) {
    return isMissingFiscalWorkflowTableError(documentLoadError)
      ? buildWorkflowTableError()
      : { error: "Unable to load that fiscal sponsorship document." }
  }

  const documentKey = normalizeFiscalDocumentKey(document.document_key ?? "")
  const acceptingW9 =
    input.decision === "accepted" && documentKey === "tax_id_confirmation"
  const completedNativeW9 =
    document.kind === "tax_form" && document.status === "executed"
  const uploadedW9Pdf =
    Boolean(document.asset_id) && document.mime === "application/pdf"

  if (acceptingW9 && !completedNativeW9 && !uploadedW9Pdf) {
    return {
      error:
        "Complete and sign the W-9 in Coach House, or connect an existing signed W-9 PDF.",
    }
  }

  const transition = await transitionFiscalDocumentReview({
    actorId: context.user.id,
    applicationId: loaded.application.id,
    decision: input.decision,
    documentId: document.id,
    expectedUpdatedAt: document.updated_at,
    notes: reviewNotes,
  })
  if ("error" in transition) return transition

  if (transition.transitioned) {
    await notifyFiscalDocumentReviewed({
      actorId: context.user.id,
      application: loaded.application,
      decision: input.decision,
      documentId: transition.documentId,
      documentKey,
    })
  }

  revalidateFiscalApplicationRoutes(loaded.application.project_id)
  return { ok: true, documentId: transition.documentId }
}
