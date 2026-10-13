import {
  normalizeFiscalSponsorshipW9Fields,
  type FiscalSponsorshipW9RedactedFields,
  type FiscalSponsorshipW9TaxClassification,
} from "../lib/w9-field-manifest"
import type { FiscalSponsorshipLegalEntityType } from "../types"
import {
  loadFiscalApplicationForProject,
  resolveFiscalApplicantSigner,
  resolveProjectAndContext,
  type FiscalApplicantSigner,
  type FiscalApplicationRow,
} from "./workflow-support"

function inferW9TaxClassification(
  legalEntityType: string | null
): FiscalSponsorshipW9TaxClassification | "" {
  const normalized = legalEntityType as FiscalSponsorshipLegalEntityType | null
  if (normalized === "individual") return "individual"
  if (normalized === "llc") return "llc"
  if (normalized === "partnership") return "partnership"
  if (normalized === "informal_group_with_ein") return "other"
  return ""
}

export function buildW9Prefill({
  application,
  organizationName,
  previousFields,
}: {
  application: FiscalApplicationRow
  organizationName: string
  previousFields?: Partial<FiscalSponsorshipW9RedactedFields> | null
}) {
  const individualName =
    application.applicant_full_name?.trim() ||
    [application.applicant_first_name, application.applicant_last_name]
      .filter(Boolean)
      .join(" ")
      .trim()
  const isIndividual = application.legal_entity_type === "individual"
  const accountNumber = `CH-${application.project_id
    .replaceAll("-", "")
    .slice(0, 8)
    .toUpperCase()}`

  return normalizeFiscalSponsorshipW9Fields({
    accountNumber: previousFields?.accountNumber || accountNumber,
    address:
      previousFields?.address ||
      [application.mailing_street_address, application.mailing_street_address_2]
        .filter(Boolean)
        .join(", "),
    businessName: previousFields?.businessName ?? "",
    city: previousFields?.city || application.mailing_city || "",
    exemptPayeeCode: previousFields?.exemptPayeeCode ?? "",
    fatcaExemptionCode: previousFields?.fatcaExemptionCode ?? "",
    foreignPartnersOwnersBeneficiaries:
      previousFields?.foreignPartnersOwnersBeneficiaries ?? false,
    llcClassification: previousFields?.llcClassification ?? "",
    name:
      previousFields?.name ||
      (isIndividual ? individualName : organizationName),
    otherClassification:
      previousFields?.otherClassification ||
      (application.legal_entity_type === "informal_group_with_ein"
        ? "Informal group with EIN"
        : ""),
    postalCode:
      previousFields?.postalCode || application.mailing_postal_code || "",
    state: previousFields?.state || application.mailing_state || "",
    subjectToBackupWithholding:
      previousFields?.subjectToBackupWithholding ?? false,
    taxClassification:
      previousFields?.taxClassification ||
      inferW9TaxClassification(application.legal_entity_type),
    tin: "",
    tinType: previousFields?.tinType ?? "ein",
  })
}

export function parsePreviousW9Fields(
  value: unknown
): Partial<FiscalSponsorshipW9RedactedFields> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Partial<FiscalSponsorshipW9RedactedFields>
}

export async function loadW9Context(projectId: string): Promise<
  | {
      application: FiscalApplicationRow
      signer: FiscalApplicantSigner
    }
  | { error: string }
> {
  const context = await resolveProjectAndContext(projectId)
  if ("error" in context) return context
  const guestScope = await context.supabase.rpc("fiscal_guest_project_reviewer_access", {
    p_project_id: context.project.id, p_user_id: context.user.id,
  })
  if (guestScope.error || guestScope.data !== null) {
    return { error: "Guest tax-form signing is not available yet." }
  }
  const loaded = await loadFiscalApplicationForProject(context)
  if ("error" in loaded) return loaded
  const signerResult = await resolveFiscalApplicantSigner(loaded.application)
  if ("error" in signerResult) return signerResult
  if (context.user.id !== signerResult.signer.id) {
    return {
      error:
        "Sign in with the primary applicant’s Coach House account to complete this W-9.",
    }
  }
  return {
    application: loaded.application,
    signer: signerResult.signer,
  }
}
