"use server"

import { randomUUID } from "node:crypto"

import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import type { Json } from "@/lib/supabase"
import {
  FISCAL_SPONSORSHIP_FORM_B_TEMPLATE,
  formatFiscalSponsorshipLegalEntityType,
  normalizeFiscalSponsorshipFormBFields,
  validateFiscalSponsorshipFormBFields,
} from "../lib/form-b-field-manifest"
import { buildFiscalSponsorshipFormBPdf, sha256Hex } from "../lib/form-b-pdf"
import type {
  GenerateFiscalSponsorshipAgreementInput,
  GenerateFiscalSponsorshipAgreementResult,
  SendFiscalSponsorshipAgreementInput,
  SendFiscalSponsorshipAgreementResult,
} from "../types"
import {
  notifyFiscalAgreementGenerated,
  notifyFiscalAgreementSent,
} from "./workflow-notifications"
import { transitionFiscalFormBSend } from "./agreement-send-transition-support"
import { transitionFiscalFormBGeneration } from "./agreement-transition-support"
import {
  buildWorkflowTableError,
  canManageFiscalSponsorshipForOrganization,
  getApplicationOrganizationName,
  isMissingFiscalWorkflowTableError,
  loadFiscalApplicationForProject,
  loadLatestAgreementDocument,
  mapFiscalApplicationRow,
  revalidateFiscalApplicationRoutes,
  resolveFiscalApplicantSigner,
  resolveProjectAndContext,
  sanitizeAgreementFilename,
} from "./workflow-support"

export async function generateFiscalSponsorshipAgreement(
  input: GenerateFiscalSponsorshipAgreementInput
): Promise<GenerateFiscalSponsorshipAgreementResult> {
  const context = await resolveProjectAndContext(input.projectId)
  if ("error" in context) return context
  // Guest applicants are not members of the internal host organization.
  // Never use that organization's identity or members to prepare their agreement.
  const guestScope = await context.supabase.rpc("fiscal_guest_project_reviewer_access", {
    p_project_id: context.project.id,
    p_user_id: context.user.id,
  })
  if (guestScope.error || guestScope.data !== null) {
    return { error: "Guest agreement preparation and signing are not available yet." }
  }

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
        "Only the assigned Coach House reviewer can prepare this agreement.",
    }
  }

  const loaded = await loadFiscalApplicationForProject(context)
  if ("error" in loaded) return loaded

  if (!["approved", "agreement_ready"].includes(loaded.application.status)) {
    return { error: "Approve the application before preparing an agreement." }
  }
  const { data: acceptedW9Documents, error: acceptedW9Error } =
    await context.supabase
      .from("fiscal_sponsorship_documents")
      .select("id, kind, status")
      .eq("application_id", loaded.application.id)
      .eq("document_key", "tax_id_confirmation")
      .eq("review_status", "accepted")
      .order("version", { ascending: false })
      .limit(10)
      .returns<{ id: string; kind: string; status: string }[]>()
  if (acceptedW9Error) {
    return isMissingFiscalWorkflowTableError(acceptedW9Error)
      ? buildWorkflowTableError()
      : { error: "Unable to verify the signed W-9." }
  }
  const acceptedW9 = acceptedW9Documents?.find(
    (document) => document.kind === "tax_form" && document.status === "executed"
  )
  if (!acceptedW9) {
    return {
      error: acceptedW9Documents?.length
        ? "The accepted file is not a completed W-9. Have the applicant complete and sign the W-9 in Coach House, then accept that signed copy."
        : "Accept the applicant’s completed W-9 before preparing an agreement.",
    }
  }

  const generatedAt = new Date().toISOString()
  const fields = normalizeFiscalSponsorshipFormBFields({
    applicationDate:
      loaded.application.submitted_at?.slice(0, 10) ?? generatedAt.slice(0, 10),
    applicantFullName:
      loaded.application.applicant_full_name ??
      [
        loaded.application.applicant_first_name,
        loaded.application.applicant_last_name,
      ]
        .filter(Boolean)
        .join(" "),
    legalEntityName: getApplicationOrganizationName(loaded.application),
    legalEntityType: formatFiscalSponsorshipLegalEntityType(
      loaded.application.legal_entity_type
    ),
    mailingCity: loaded.application.mailing_city ?? "",
    mailingPostalCode: loaded.application.mailing_postal_code ?? "",
    mailingState: loaded.application.mailing_state ?? "",
    mailingStreetAddress: loaded.application.mailing_street_address ?? "",
    mailingStreetAddress2: loaded.application.mailing_street_address_2 ?? "",
    phoneNumber: loaded.application.phone_number ?? "",
    primaryEmail: loaded.application.primary_email ?? "",
    projectId: `CH-${loaded.application.project_id.replaceAll("-", "").slice(0, 8).toUpperCase()}`,
    projectName: loaded.application.project_name ?? "",
  })
  const fieldErrors = validateFiscalSponsorshipFormBFields(fields)
  const firstFieldError = Object.values(fieldErrors)[0]
  if (firstFieldError) return { error: firstFieldError }

  const agreement = await buildFiscalSponsorshipFormBPdf({ fields })
  const filename = "form-b-fiscal-sponsorship-agreement.pdf"
  const title = "Form B Fiscal Sponsorship Agreement"
  const mime = "application/pdf"
  const storagePath = `${loaded.application.org_id}/${loaded.application.project_id}/${loaded.application.id}/generated/${randomUUID()}-${sanitizeAgreementFilename(filename)}`
  const admin = createSupabaseAdminClient()
  const { error: uploadError } = await admin.storage
    .from("fiscal-signing")
    .upload(storagePath, agreement.bytes, { contentType: mime })
  if (uploadError) {
    return {
      error: "Unable to upload the prepared fiscal sponsorship agreement.",
    }
  }

  const transition = await transitionFiscalFormBGeneration({
    actorId: context.user.id,
    applicationId: loaded.application.id,
    document: {
      application_id: loaded.application.id,
      asset_id: null,
      field_values: fields,
      field_values_sha256: sha256Hex(JSON.stringify(fields)),
      file_sha256: agreement.sha256,
      generated_at: generatedAt,
      generated_by: context.user.id,
      kind: "agreement",
      metadata: { filename, storageBucket: "fiscal-signing" },
      mime,
      org_id: loaded.application.org_id,
      project_id: loaded.application.project_id,
      size_bytes: agreement.bytes.length,
      source_snapshot: {
        application: mapFiscalApplicationRow(loaded.application),
        generatedAt,
      },
      status: "generated",
      storage_bucket: "fiscal-signing",
      storage_path: storagePath,
      template_key: FISCAL_SPONSORSHIP_FORM_B_TEMPLATE.key,
      template_sha256: FISCAL_SPONSORSHIP_FORM_B_TEMPLATE.sha256,
      template_version: FISCAL_SPONSORSHIP_FORM_B_TEMPLATE.version,
      title,
    } as unknown as Json,
    expectedUpdatedAt: loaded.application.updated_at,
  })
  if ("error" in transition) {
    await admin.storage.from("fiscal-signing").remove([storagePath])
    return transition
  }
  await notifyFiscalAgreementGenerated({
    actorId: context.user.id,
    application: loaded.application,
    documentId: transition.documentId,
  })

  revalidateFiscalApplicationRoutes(loaded.application.project_id)
  return {
    ok: true,
    applicationId: loaded.application.id,
    assetId: null,
    documentId: transition.documentId,
  }
}

export async function sendFiscalSponsorshipAgreementForSignature(
  input: SendFiscalSponsorshipAgreementInput
): Promise<SendFiscalSponsorshipAgreementResult> {
  const context = await resolveProjectAndContext(input.projectId)
  if ("error" in context) return context
  // Guest applicants are not members of the internal host organization.
  // Never use that organization's identity or members to prepare their agreement.
  const guestScope = await context.supabase.rpc("fiscal_guest_project_reviewer_access", {
    p_project_id: context.project.id,
    p_user_id: context.user.id,
  })
  if (guestScope.error || guestScope.data !== null) {
    return { error: "Guest agreement preparation and signing are not available yet." }
  }

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
      error: "Only the assigned Coach House reviewer can send this agreement.",
    }
  }

  const loaded = await loadFiscalApplicationForProject(context)
  if ("error" in loaded) return loaded

  const documentResult = await loadLatestAgreementDocument({
    applicationId: loaded.application.id,
    documentId: input.documentId,
    supabase: context.supabase,
  })
  if ("error" in documentResult) return documentResult

  const signerResult = await resolveFiscalApplicantSigner(loaded.application)
  if ("error" in signerResult) return signerResult
  const applicantEmail = signerResult.signer.email

  const applicantName =
    loaded.application.applicant_full_name?.trim() ||
    [
      loaded.application.applicant_first_name,
      loaded.application.applicant_last_name,
    ]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    signerResult.signer.name
  if (
    documentResult.document.storage_bucket !== "fiscal-signing" ||
    documentResult.document.template_key !==
      FISCAL_SPONSORSHIP_FORM_B_TEMPLATE.key ||
    documentResult.document.template_sha256 !==
      FISCAL_SPONSORSHIP_FORM_B_TEMPLATE.sha256 ||
    documentResult.document.template_version !==
      FISCAL_SPONSORSHIP_FORM_B_TEMPLATE.version ||
    !documentResult.document.file_sha256
  ) {
    return { error: "Prepare the native Form B agreement before sending." }
  }
  const fields = normalizeFiscalSponsorshipFormBFields(
    (documentResult.document.field_values ?? {}) as Record<string, string>
  )

  const transition = await transitionFiscalFormBSend({
    actorId: context.user.id,
    applicantSignerEmail: applicantEmail,
    applicantSignerId: signerResult.signer.id,
    applicantSignerName: applicantName,
    applicationId: loaded.application.id,
    documentId: documentResult.document.id,
    expectedApplicationUpdatedAt: loaded.application.updated_at,
    expectedDocumentUpdatedAt: documentResult.document.updated_at,
    fields,
    templateKey: FISCAL_SPONSORSHIP_FORM_B_TEMPLATE.key,
    templateSha256: FISCAL_SPONSORSHIP_FORM_B_TEMPLATE.sha256,
    templateVersion: FISCAL_SPONSORSHIP_FORM_B_TEMPLATE.version,
  })
  if ("error" in transition) return transition

  if (transition.transitioned) {
    await notifyFiscalAgreementSent({
      actorId: context.user.id,
      application: loaded.application,
      applicantSignerEmail: signerResult.signer.email,
      applicantSignerId: signerResult.signer.id,
      packetId: transition.packetId,
      providerSubmissionId: null,
    })
  }

  revalidateFiscalApplicationRoutes(loaded.application.project_id)
  return {
    ok: true,
    applicationId: loaded.application.id,
    packetId: transition.packetId,
    providerSubmissionId: null,
  }
}
