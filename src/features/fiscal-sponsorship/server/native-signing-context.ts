import { resolveAuthenticatedAppContext } from "@/lib/auth/request-context"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import type { Database } from "@/lib/supabase"
import {
  FISCAL_SPONSORSHIP_FORM_B_REQUIRED_FIELDS,
  normalizeFiscalSponsorshipFormBFields,
  type FiscalSponsorshipFormBFields,
} from "../lib/form-b-field-manifest"
import type { FiscalSponsorshipNativeSignature } from "../lib/form-b-pdf"
import type {
  FiscalSponsorshipSignatureMethod,
  FiscalSponsorshipSignerRole,
  FiscalSponsorshipSigningSession,
} from "../types"
import { canManageFiscalSponsorshipForOrganization } from "./workflow-support"

export const FISCAL_SPONSORSHIP_SIGNING_BUCKET = "fiscal-signing"
export const FISCAL_SPONSORSHIP_CONSENT_VERSION = "2026-07-16"
export const FISCAL_SPONSORSHIP_CONSENT_TEXT =
  "I consent to use electronic records and signatures for this Form B Fiscal Sponsorship Agreement and confirm that I am authorized to sign for the named party."

export type SignaturePacketRow =
  Database["public"]["Tables"]["fiscal_sponsorship_signature_packets"]["Row"]
export type FiscalDocumentRow =
  Database["public"]["Tables"]["fiscal_sponsorship_documents"]["Row"]
export type FiscalSignatureRow =
  Database["public"]["Tables"]["fiscal_sponsorship_signatures"]["Row"]
export type FiscalDraftRow =
  Database["public"]["Tables"]["fiscal_sponsorship_signing_drafts"]["Row"]

export type SigningContext = {
  appContext: Awaited<ReturnType<typeof resolveAuthenticatedAppContext>>
  packet: SignaturePacketRow
  document: FiscalDocumentRow
  role: FiscalSponsorshipSignerRole
  projectName: string
  organizationName: string
  signerName: string
  signerEmail: string
  draft: FiscalDraftRow | null
  signatures: FiscalSignatureRow[]
}

export function parseFormBFields(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return normalizeFiscalSponsorshipFormBFields(
    value as Partial<FiscalSponsorshipFormBFields>
  )
}

function parseOrganizationName(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  return typeof record.name === "string" && record.name.trim()
    ? record.name.trim()
    : null
}

export function toNativeSignature(
  signature: FiscalSignatureRow
): FiscalSponsorshipNativeSignature {
  return {
    method: signature.signature_method as FiscalSponsorshipSignatureMethod,
    signatureSha256: signature.signature_sha256,
    signedAt: signature.signed_at,
    signerEmail: signature.signer_email,
    signerName: signature.signer_name,
    signerTitle: signature.signer_title,
    value: signature.signature_value,
  }
}

export function getSignatureForRole(
  signatures: FiscalSignatureRow[],
  role: FiscalSponsorshipSignerRole
) {
  return signatures.find((signature) => signature.signer_role === role) ?? null
}

export function validateSignatureValue({
  method,
  value,
}: {
  method: FiscalSponsorshipSignatureMethod
  value: string
}) {
  const trimmed = value.trim()
  if (method === "typed") {
    if (trimmed.length < 2) return "Type your full legal name."
    if (trimmed.length > 120) {
      return "Typed signatures must be 120 characters or fewer."
    }
    return null
  }

  if (!trimmed.startsWith("data:image/png;base64,")) {
    return "Draw your signature before continuing."
  }
  if (trimmed.length > 750_000) return "The drawn signature is too large."
  return null
}

export function validateSignerTitle(value: string) {
  const trimmed = value.trim()
  if (trimmed.length < 2) return "Enter your title or signing capacity."
  if (trimmed.length > 120) {
    return "Signer titles must be 120 characters or fewer."
  }
  return null
}

export function canRoleSign({
  packet,
  role,
}: Pick<SigningContext, "packet" | "role">) {
  if (role === "applicant") return packet.status === "sent"
  return packet.status === "applicant_signed"
}

export async function resolveSigningContext(
  packetId: string
): Promise<SigningContext | { error: string }> {
  const normalizedPacketId = packetId.trim()
  if (!normalizedPacketId) return { error: "Signature packet is required." }

  const appContext = await resolveAuthenticatedAppContext()
  const isPlatformStaff =
    appContext.profileAudience.isPlatformStaff ||
    appContext.profileAudience.isAdmin
  const supabase = isPlatformStaff
    ? createSupabaseAdminClient()
    : appContext.supabase
  const { data: packet, error: packetError } = await supabase
    .from("fiscal_sponsorship_signature_packets")
    .select("*")
    .eq("id", normalizedPacketId)
    .maybeSingle<SignaturePacketRow>()

  if (packetError || !packet || packet.provider !== "native") {
    return { error: "Native fiscal sponsorship signature packet not found." }
  }

  const canManageAsReviewer =
    isPlatformStaff &&
    (await canManageFiscalSponsorshipForOrganization({
      accessLevel: appContext.profileAudience.platformAccessLevel,
      organizationId: packet.org_id,
      projectId: packet.project_id,
      supabase,
      userId: appContext.user.id,
    }))
  const isAssignedApplicant = packet.applicant_signer_id === appContext.user.id
  const role: FiscalSponsorshipSignerRole | null =
    canManageAsReviewer &&
    ["applicant_signed", "completed"].includes(packet.status)
      ? "coach_house"
      : isAssignedApplicant
        ? "applicant"
        : canManageAsReviewer
          ? "coach_house"
          : null
  if (!role) return { error: "You are not assigned to this signature packet." }

  const [
    documentResult,
    profileResult,
    projectResult,
    organizationResult,
    draftResult,
    signaturesResult,
  ] = await Promise.all([
    supabase
      .from("fiscal_sponsorship_documents")
      .select("*")
      .eq("id", packet.document_id)
      .maybeSingle<FiscalDocumentRow>(),
    supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", appContext.user.id)
      .maybeSingle<{ full_name: string | null; email: string | null }>(),
    supabase
      .from("organization_projects")
      .select("name")
      .eq("id", packet.project_id)
      .maybeSingle<{ name: string }>(),
    supabase
      .from("organizations")
      .select("profile")
      .eq("user_id", packet.org_id)
      .maybeSingle<{ profile: unknown }>(),
    supabase
      .from("fiscal_sponsorship_signing_drafts")
      .select("*")
      .eq("packet_id", packet.id)
      .eq("signer_role", role)
      .maybeSingle<FiscalDraftRow>(),
    supabase
      .from("fiscal_sponsorship_signatures")
      .select("*")
      .eq("packet_id", packet.id)
      .order("signed_at", { ascending: true })
      .returns<FiscalSignatureRow[]>(),
  ])

  if (documentResult.error || !documentResult.data) {
    return { error: "Agreement document not found." }
  }
  if (draftResult.error) return { error: "Unable to load the signing draft." }
  if (signaturesResult.error)
    return { error: "Unable to load signature evidence." }

  const profile = profileResult.data
  const fallbackName =
    role === "applicant"
      ? packet.applicant_signer_name
      : packet.coach_signer_name
  const fallbackEmail =
    role === "applicant"
      ? packet.applicant_signer_email
      : packet.coach_signer_email

  return {
    appContext: { ...appContext, supabase },
    document: documentResult.data,
    draft: draftResult.data,
    organizationName:
      parseOrganizationName(organizationResult.data?.profile) ?? "Organization",
    packet,
    projectName: projectResult.data?.name ?? "Fiscal Sponsorship Project",
    role,
    signerEmail:
      profile?.email?.trim() ||
      fallbackEmail?.trim() ||
      appContext.user.email ||
      "",
    signerName:
      profile?.full_name?.trim() ||
      fallbackName?.trim() ||
      appContext.user.email ||
      "Signer",
    signatures: signaturesResult.data ?? [],
  }
}

export function buildSigningSession(
  context: SigningContext
): FiscalSponsorshipSigningSession {
  const documentFields = parseFormBFields(context.document.field_values)
  const draftFields = parseFormBFields(context.draft?.field_values)
  const fields =
    context.role === "applicant"
      ? (draftFields ?? documentFields)
      : documentFields
  if (!fields) throw new Error("The Form B field snapshot is unavailable.")

  return {
    applicantSignedAt: context.packet.applicant_signed_at,
    auditDocumentHref: context.packet.audit_document_id
      ? `/api/fiscal-sponsorship/documents/${context.packet.audit_document_id}?download=1`
      : null,
    canSign: canRoleSign(context),
    coachSignedAt: context.packet.coach_signed_at,
    confirmed:
      context.draft?.confirmed_fields?.length ===
      FISCAL_SPONSORSHIP_FORM_B_REQUIRED_FIELDS.length,
    draftRevision: context.draft?.revision ?? 0,
    draftUpdatedAt: context.draft?.updated_at ?? null,
    executedDocumentHref: context.packet.executed_document_id
      ? `/api/fiscal-sponsorship/documents/${context.packet.executed_document_id}?download=1`
      : null,
    fields,
    fieldsEditable:
      context.role === "applicant" && context.packet.status === "sent",
    organizationId: context.packet.org_id,
    organizationName: context.organizationName,
    packetId: context.packet.id,
    packetStatus: context.packet
      .status as FiscalSponsorshipSigningSession["packetStatus"],
    previewHref: `/api/fiscal-sponsorship/signing/${context.packet.id}/preview`,
    projectId: context.packet.project_id,
    projectName: context.projectName,
    role: context.role,
    signatureMethod:
      (context.draft
        ?.signature_method as FiscalSponsorshipSignatureMethod | null) ??
      "typed",
    signatureValue: context.draft?.signature_value ?? context.signerName,
    signerEmail: context.signerEmail,
    signerName: context.signerName,
    signerTitle: context.draft?.signer_title ?? "",
  }
}
