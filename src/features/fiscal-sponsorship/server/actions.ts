"use server"

import { revalidatePath } from "next/cache"
import type { SupabaseClient } from "@supabase/supabase-js"

import { resolveAuthenticatedAppContext } from "@/lib/auth/request-context"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { canEditOrganization } from "@/lib/organization/active-org"
import type { Database, Json } from "@/lib/supabase"
import { normalizeFiscalSponsorshipInput } from "../lib"
import { hasFundraisingGoal } from "../lib/fundraising-goal"
import { canReadGuestFiscalProject } from "../lib/authorization"
import {
  getBudgetTotal,
  readBudgetRowsFromMetadata,
  readBudgetSourceActivityIdFromMetadata,
} from "../lib/budget-plan"
import type {
  FiscalSponsorshipApplicationRecord,
  FiscalSponsorshipApplicationStatus,
  FiscalSponsorshipApplicationInput,
  FiscalSponsorshipNormalizedApplicationInput,
  FiscalSponsorshipLegalEntityType,
  FiscalSponsorshipProjectDurationType,
  LoadFiscalSponsorshipApplicationResult,
  SaveFiscalSponsorshipApplicationResult,
} from "../types"
import { saveFiscalApplicationDraftTransition } from "./application-draft-transition-support"

type FiscalApplicationRow =
  Database["public"]["Tables"]["fiscal_sponsorship_applications"]["Row"]
type FiscalApplicationInsert =
  Database["public"]["Tables"]["fiscal_sponsorship_applications"]["Insert"]
type FiscalApplicationMutationClient = Pick<
  SupabaseClient<Database, "public">,
  "from"
>
type FiscalProjectRow = {
  id: string
  org_id: string
}
type ResolveFiscalProjectResult =
  | { ok: true; project: FiscalProjectRow }
  | { ok: false; error: string }

function isMissingFiscalApplicationTableError(error: unknown) {
  if (!error || typeof error !== "object") return false
  const record = error as Record<string, unknown>
  if (record.code === "42P01" || record.code === "PGRST205") return true

  const message =
    typeof record.message === "string"
      ? record.message
      : typeof record.details === "string"
        ? record.details
        : ""

  return message.includes("fiscal_sponsorship_applications")
}

async function resolveFiscalProject({
  projectId,
  supabase,
}: {
  projectId: string
  supabase: FiscalApplicationMutationClient
}): Promise<ResolveFiscalProjectResult> {
  const { data, error } = await supabase
    .from("organization_projects")
    .select("id, org_id")
    .eq("id", projectId)
    .maybeSingle<FiscalProjectRow>()

  if (error || !data) {
    return { ok: false, error: "Unable to find that organization project." }
  }

  return { ok: true, project: data }
}

function canAccessFiscalProject({
  activeOrgId,
  isAdmin,
  project,
}: {
  activeOrgId: string
  isAdmin: boolean
  project: FiscalProjectRow
}) {
  return isAdmin || project.org_id === activeOrgId
}

function canEditFiscalProject({
  activeOrgRole,
  isAdmin,
  project,
  activeOrgId,
}: {
  activeOrgRole: Parameters<typeof canEditOrganization>[0]
  isAdmin: boolean
  project: FiscalProjectRow
  activeOrgId: string
}) {
  return (
    isAdmin ||
    (project.org_id === activeOrgId && canEditOrganization(activeOrgRole))
  )
}

function mapFiscalApplicationRow(
  row: FiscalApplicationRow
): FiscalSponsorshipApplicationRecord {
  return {
    id: row.id,
    orgId: row.org_id,
    projectId: row.project_id,
    status: row.status as FiscalSponsorshipApplicationStatus,
    applicantFullName: row.applicant_full_name,
    applicantFirstName: row.applicant_first_name,
    applicantLastName: row.applicant_last_name,
    mailingStreetAddress: row.mailing_street_address,
    mailingStreetAddress2: row.mailing_street_address_2,
    mailingCity: row.mailing_city,
    mailingState: row.mailing_state,
    mailingPostalCode: row.mailing_postal_code,
    phoneNumber: row.phone_number,
    primaryEmail: row.primary_email,
    legalEntityType:
      row.legal_entity_type as FiscalSponsorshipLegalEntityType | null,
    legalEntityHas501c3: row.legal_entity_has_501c3,
    formationStatus: row.formation_status,
    projectName: row.project_name,
    projectDurationType:
      row.project_duration_type as FiscalSponsorshipProjectDurationType | null,
    temporaryStartDate: row.temporary_start_date,
    temporaryEndDate: row.temporary_end_date,
    focusArea: row.focus_area,
    projectDescription: row.project_description,
    projectLocation: row.project_location,
    estimatedBudgetCents: row.estimated_budget_cents,
    expenseSummary: row.expense_summary,
    prospectiveFundingSources: row.prospective_funding_sources,
    publicBenefit: row.public_benefit,
    leadershipBackground: row.leadership_background,
    initiativeHistory: row.initiative_history,
    shortPublicDescription: row.short_public_description,
    operatesOutsideUnitedStates: row.operates_outside_united_states,
    receivesInvestorReturnFunds: row.receives_investor_return_funds,
    engagesInLobbying: row.engages_in_lobbying,
    hasLegalComplianceFinancialConcerns:
      row.has_legal_compliance_financial_concerns,
    concernsExplanation: row.concerns_explanation,
    sourceSnapshot: row.source_snapshot,
    documentTemplatePayload: row.document_template_payload,
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function buildFiscalApplicationPayload({
  input,
  orgId,
  projectId,
  userId,
}: {
  input: FiscalSponsorshipNormalizedApplicationInput
  orgId: string
  projectId: string
  userId: string
}): FiscalApplicationInsert {
  return {
    org_id: orgId,
    project_id: projectId,
    status: input.status,
    applicant_full_name: input.applicantFullName,
    applicant_first_name: input.applicantFirstName,
    applicant_last_name: input.applicantLastName,
    mailing_street_address: input.mailingStreetAddress,
    mailing_street_address_2: input.mailingStreetAddress2,
    mailing_city: input.mailingCity,
    mailing_state: input.mailingState,
    mailing_postal_code: input.mailingPostalCode,
    phone_number: input.phoneNumber,
    primary_email: input.primaryEmail,
    legal_entity_type: input.legalEntityType,
    legal_entity_has_501c3: input.legalEntityHas501c3,
    formation_status: input.formationStatus,
    project_name: input.projectName,
    project_duration_type: input.projectDurationType,
    temporary_start_date: input.temporaryStartDate,
    temporary_end_date: input.temporaryEndDate,
    focus_area: input.focusArea,
    project_description: input.projectDescription,
    project_location: input.projectLocation,
    estimated_budget_cents: input.estimatedBudgetCents,
    expense_summary: input.expenseSummary,
    prospective_funding_sources: input.prospectiveFundingSources,
    public_benefit: input.publicBenefit,
    leadership_background: input.leadershipBackground,
    initiative_history: input.initiativeHistory,
    short_public_description: input.shortPublicDescription,
    operates_outside_united_states: input.operatesOutsideUnitedStates,
    receives_investor_return_funds: input.receivesInvestorReturnFunds,
    engages_in_lobbying: input.engagesInLobbying,
    has_legal_compliance_financial_concerns:
      input.hasLegalComplianceFinancialConcerns,
    concerns_explanation: input.concernsExplanation,
    source_snapshot: input.sourceSnapshot,
    document_template_payload: input.documentTemplatePayload,
    metadata: input.metadata,
    updated_by: userId,
    created_by: userId,
  }
}

function revalidateFiscalApplicationRoutes(projectId: string) {
  revalidatePath("/organizations")
  revalidatePath(`/organizations/${projectId}`)
  revalidatePath("/workspace")
  revalidatePath("/my-organization")
  revalidatePath("/organization/workspace")
}

export async function loadFiscalSponsorshipApplicationDraft(
  projectId: string
): Promise<LoadFiscalSponsorshipApplicationResult> {
  const context = await resolveAuthenticatedAppContext()
  const { activeOrg, profileAudience } = context
  const isPlatformStaff =
    profileAudience.isPlatformStaff || profileAudience.isAdmin
  const supabase = profileAudience.isPlatformStaff
    ? createSupabaseAdminClient()
    : context.supabase
  const normalizedProjectId = projectId.trim()
  if (!normalizedProjectId) {
    return { error: "Choose a project before loading this application." }
  }

  const projectResult = await resolveFiscalProject({
    projectId: normalizedProjectId,
    supabase,
  })
  if (!projectResult.ok) return { error: projectResult.error }
  if (!(await canReadGuestFiscalProject({
    projectId: projectResult.project.id, userId: context.user.id, supabase,
  }))) return { error: "Unable to find that organization project." }

  if (
    !canAccessFiscalProject({
      activeOrgId: activeOrg.orgId,
      isAdmin: isPlatformStaff,
      project: projectResult.project,
    })
  ) {
    return { error: "You can only view applications for accessible projects." }
  }

  const { data, error } = await supabase
    .from("fiscal_sponsorship_applications")
    .select("*")
    .eq("project_id", projectResult.project.id)
    .eq("org_id", projectResult.project.org_id)
    .maybeSingle<FiscalApplicationRow>()

  if (error) {
    if (isMissingFiscalApplicationTableError(error)) {
      return {
        error:
          "Fiscal sponsorship applications are not available until the latest database migrations are applied.",
      }
    }
    return { error: "Unable to load fiscal sponsorship application." }
  }

  return {
    ok: true,
    application: data ? mapFiscalApplicationRow(data) : null,
  }
}

export async function saveFiscalSponsorshipApplicationDraft(
  input: FiscalSponsorshipApplicationInput
): Promise<SaveFiscalSponsorshipApplicationResult> {
  const normalized = normalizeFiscalSponsorshipInput(input)
  if (!normalized.ok) {
    return { error: normalized.error }
  }

  const context = await resolveAuthenticatedAppContext()
  const { activeOrg, profileAudience, user } = context
  const isPlatformStaff =
    profileAudience.isPlatformStaff || profileAudience.isAdmin
  const supabase = profileAudience.isPlatformStaff
    ? createSupabaseAdminClient()
    : context.supabase
  const projectResult = await resolveFiscalProject({
    projectId: normalized.value.projectId,
    supabase,
  })
  if (!projectResult.ok) return { error: projectResult.error }
  if (!(await canReadGuestFiscalProject({
    projectId: projectResult.project.id, userId: context.user.id, supabase,
  }))) return { error: "Unable to find that organization project." }

  if (
    !canEditFiscalProject({
      activeOrgId: activeOrg.orgId,
      activeOrgRole: activeOrg.role,
      isAdmin: isPlatformStaff,
      project: projectResult.project,
    })
  ) {
    return { error: "Only organization editors can save fiscal applications." }
  }

  const payload = buildFiscalApplicationPayload({
    input: normalized.value,
    orgId: projectResult.project.org_id,
    projectId: projectResult.project.id,
    userId: user.id,
  })
  const expectedUpdatedAt = input.expectedUpdatedAt?.trim() || null
  if (expectedUpdatedAt && Number.isNaN(Date.parse(expectedUpdatedAt))) {
    return { error: "Refresh this application before saving again." }
  }
  const metadata = normalized.value.metadata
  const hasBudgetRows = Boolean(
    !hasFundraisingGoal(metadata) &&
    metadata &&
    typeof metadata === "object" &&
    !Array.isArray(metadata) &&
    Array.isArray((metadata as Record<string, unknown>).budgetRows)
  )
  const budgetRows = readBudgetRowsFromMetadata(metadata)
  const result = await saveFiscalApplicationDraftTransition({
    actorId: user.id,
    allowLocked: isPlatformStaff,
    budgetRows: JSON.parse(JSON.stringify(budgetRows)) as Json,
    budgetTotalCents: Math.round(getBudgetTotal(budgetRows) * 100),
    expectedUpdatedAt,
    hasBudgetRows,
    payload: JSON.parse(JSON.stringify(payload)) as Json,
    projectId: projectResult.project.id,
    sourceActivityId: readBudgetSourceActivityIdFromMetadata(metadata),
  })

  if ("error" in result) return result

  revalidateFiscalApplicationRoutes(projectResult.project.id)
  return result
}

export async function saveFiscalSponsorship(
  input: FiscalSponsorshipApplicationInput
): Promise<SaveFiscalSponsorshipApplicationResult> {
  return saveFiscalSponsorshipApplicationDraft(input)
}
