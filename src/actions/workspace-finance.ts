"use server"

import { revalidatePath } from "next/cache"

import { resolveAuthenticatedAppContext } from "@/lib/auth/request-context"
import type { Database } from "@/lib/supabase"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

import {
  normalizeWorkspaceFinanceCsvImportBatch,
  type WorkspaceFinanceCsvImportBatchInput,
} from "../features/workspace-finance/lib/csv-import"
import {
  normalizeWorkspaceFinanceManualRecord,
  type WorkspaceFinanceManualRecordInput,
} from "../features/workspace-finance/lib/manual-record"
import { getWorkspaceFinanceRecordTypeLabel } from "../features/workspace-finance/lib/record-types"
import { canManageWorkspaceFinance as canManageFinance } from "../lib/workspace/workspace-finance-access"
import type {
  WorkspaceFinanceOpportunityWorkflowStatus,
  WorkspaceFinanceRecordInput,
} from "../features/workspace-finance/types"

type FinanceRecordInsert =
  Database["public"]["Tables"]["organization_finance_records"]["Insert"]

type WorkspaceFinanceCsvImportResult =
  | { ok: true; imported: number; skipped: number }
  | { error: string }

type WorkspaceFinanceOpportunityStatusResult = { ok: true; updatedAt?: string } | { error: string }
type WorkspaceFinanceRecordProgramResult = { ok: true } | { error: string }
type WorkspaceFinanceManualRecordResult =
  | { ok: true; record: WorkspaceFinanceRecordInput }
  | { error: string }

const WORKSPACE_FINANCE_OPPORTUNITY_STATUSES =
  new Set<WorkspaceFinanceOpportunityWorkflowStatus>([
    "new",
    "saved",
    "applied",
    "awarded",
    "not_awarded",
    "dismissed",
  ])
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function revalidateFinanceRoutes() {
  revalidatePath("/workspace")
  revalidatePath("/my-organization")
  revalidatePath("/organization/workspace")
}

export async function importWorkspaceFinanceCsvBatch(
  input: WorkspaceFinanceCsvImportBatchInput
): Promise<WorkspaceFinanceCsvImportResult> {
  const normalized = normalizeWorkspaceFinanceCsvImportBatch(input)
  if (!normalized) return { error: "The CSV import data is invalid." }

  let context: Awaited<ReturnType<typeof resolveAuthenticatedAppContext>>
  try {
    context = await resolveAuthenticatedAppContext()
  } catch {
    return { error: "You must be signed in to import Finance records." }
  }

  const { activeOrg, supabase, user } = context
  if (
    !(await canManageFinance({
      activeOrg,
      supabase,
      userId: user.id,
    }))
  ) {
    return { error: "Only Finance managers can import records." }
  }

  let admin: ReturnType<typeof createSupabaseAdminClient>
  try {
    admin = createSupabaseAdminClient()
  } catch {
    return { error: "Finance import is not configured." }
  }

  if (normalized.programId) {
    const { data: program, error: programError } = await admin
      .from("programs")
      .select("id")
      .eq("id", normalized.programId)
      .eq("user_id", activeOrg.orgId)
      .maybeSingle<{ id: string }>()

    if (programError || !program) {
      return { error: "Choose a program from this organization." }
    }
  }

  const externalRecordIds = normalized.records.map(
    ({ rowNumber }) => `${normalized.fileFingerprint}:${rowNumber}`
  )
  const { data: existingRows, error: existingError } = await admin
    .from("organization_finance_records")
    .select("external_record_id")
    .eq("org_id", activeOrg.orgId)
    .eq("external_provider", "csv")
    .in("external_record_id", externalRecordIds)
    .returns<Array<{ external_record_id: string | null }>>()

  if (existingError) {
    return { error: "Unable to check this CSV import." }
  }

  const existingIds = new Set(
    (existingRows ?? []).flatMap(({ external_record_id: id }) =>
      id ? [id] : []
    )
  )
  const records: FinanceRecordInsert[] = normalized.records.flatMap(
    (record) => {
      const externalRecordId = `${normalized.fileFingerprint}:${record.rowNumber}`
      if (existingIds.has(externalRecordId)) return []

      return [
        {
          org_id: activeOrg.orgId,
          program_id: normalized.programId,
          effective_at: record.effectiveAt,
          record_type: record.recordType,
          direction: record.direction,
          source_kind: record.sourceKind,
          source_label: record.sourceLabel,
          amount_cents: record.amountCents,
          currency_code: record.currencyCode,
          status: "recorded",
          external_provider: "csv",
          external_record_id: externalRecordId,
          created_source: "import",
          created_by: user.id,
        },
      ]
    }
  )

  if (records.length) {
    const { error } = await admin
      .from("organization_finance_records")
      .insert(records)
    if (error) {
      return error.code === "23505"
        ? { error: "This CSV changed during import. Try importing it again." }
        : { error: "Unable to import Finance records." }
    }
  }

  if (normalized.finalBatch) revalidateFinanceRoutes()
  return {
    ok: true,
    imported: records.length,
    skipped: normalized.records.length - records.length,
  }
}

export async function createWorkspaceFinanceManualRecord(
  input: WorkspaceFinanceManualRecordInput
): Promise<WorkspaceFinanceManualRecordResult> {
  const normalized = normalizeWorkspaceFinanceManualRecord(input)
  if (!normalized) {
    return { error: "Check the date, amount, source, and record type." }
  }

  let context: Awaited<ReturnType<typeof resolveAuthenticatedAppContext>>
  try {
    context = await resolveAuthenticatedAppContext()
  } catch {
    return { error: "You must be signed in to add Finance records." }
  }

  const { activeOrg, supabase, user } = context
  if (
    !(await canManageFinance({
      activeOrg,
      supabase,
      userId: user.id,
    }))
  ) {
    return { error: "Only Finance managers can add records." }
  }

  let admin: ReturnType<typeof createSupabaseAdminClient>
  try {
    admin = createSupabaseAdminClient()
  } catch {
    return { error: "Finance records are not configured." }
  }

  if (normalized.programId) {
    const { data: program, error: programError } = await admin
      .from("programs")
      .select("id")
      .eq("id", normalized.programId)
      .eq("user_id", activeOrg.orgId)
      .maybeSingle<{ id: string }>()

    if (programError || !program) {
      return { error: "Choose a program from this organization." }
    }
  }

  const { data, error } = await admin
    .from("organization_finance_records")
    .insert({
      org_id: activeOrg.orgId,
      program_id: normalized.programId,
      effective_at: normalized.effectiveAt,
      record_type: normalized.recordType,
      direction: normalized.direction,
      source_kind: normalized.sourceKind,
      source_label: normalized.sourceLabel,
      amount_cents: normalized.amountCents,
      currency_code: normalized.currencyCode,
      status: "recorded",
      created_source: "manual",
      created_by: user.id,
    })
    .select("id")
    .single<{ id: string }>()

  if (error || !data) {
    return { error: "Unable to add this Finance record." }
  }

  revalidateFinanceRoutes()
  return {
    ok: true,
    record: {
      id: data.id,
      programId: normalized.programId,
      effectiveAt: normalized.effectiveAt,
      sourceLabel: normalized.sourceLabel,
      recordType: normalized.recordType,
      typeLabel: getWorkspaceFinanceRecordTypeLabel(normalized.recordType),
      amountCents: normalized.amountCents,
      currencyCode: normalized.currencyCode,
      direction: normalized.direction,
      status: "recorded",
      sourceKind: normalized.sourceKind,
    },
  }
}

export async function updateWorkspaceFinanceOpportunityStatus(input: {
  opportunityId: string
  status: WorkspaceFinanceOpportunityWorkflowStatus
}): Promise<WorkspaceFinanceOpportunityStatusResult> {
  if (
    !UUID_PATTERN.test(input.opportunityId) ||
    !WORKSPACE_FINANCE_OPPORTUNITY_STATUSES.has(input.status)
  ) {
    return { error: "The opportunity update is invalid." }
  }

  let context: Awaited<ReturnType<typeof resolveAuthenticatedAppContext>>
  try {
    context = await resolveAuthenticatedAppContext()
  } catch {
    return { error: "You must be signed in to update opportunities." }
  }

  const { activeOrg, supabase, user } = context
  if (
    !(await canManageFinance({
      activeOrg,
      supabase,
      userId: user.id,
    }))
  ) {
    return { error: "Only Finance managers can update opportunities." }
  }

  let admin: ReturnType<typeof createSupabaseAdminClient>
  try {
    admin = createSupabaseAdminClient()
  } catch {
    return { error: "Finance opportunities are not configured." }
  }

  const { data, error } = await admin
    .from("organization_finance_opportunities")
    .update({ status: input.status })
    .eq("id", input.opportunityId)
    .eq("org_id", activeOrg.orgId)
    .select("id,updated_at")
    .maybeSingle()

  if (error || !data) {
    return { error: "Unable to update this opportunity." }
  }

  revalidateFinanceRoutes()
  return { ok: true, updatedAt: data.updated_at }
}

export async function updateWorkspaceFinanceRecordProgram(input: {
  recordId: string
  programId: string | null
}): Promise<WorkspaceFinanceRecordProgramResult> {
  if (
    !UUID_PATTERN.test(input.recordId) ||
    (input.programId !== null && !UUID_PATTERN.test(input.programId))
  ) {
    return { error: "The Finance record update is invalid." }
  }

  let context: Awaited<ReturnType<typeof resolveAuthenticatedAppContext>>
  try {
    context = await resolveAuthenticatedAppContext()
  } catch {
    return { error: "You must be signed in to update Finance records." }
  }

  const { activeOrg, supabase, user } = context
  if (
    !(await canManageFinance({
      activeOrg,
      supabase,
      userId: user.id,
    }))
  ) {
    return { error: "Only Finance managers can update records." }
  }

  let admin: ReturnType<typeof createSupabaseAdminClient>
  try {
    admin = createSupabaseAdminClient()
  } catch {
    return { error: "Finance records are not configured." }
  }

  if (input.programId) {
    const { data: program, error: programError } = await admin
      .from("programs")
      .select("id")
      .eq("id", input.programId)
      .eq("user_id", activeOrg.orgId)
      .maybeSingle<{ id: string }>()

    if (programError || !program) {
      return { error: "Choose a program from this organization." }
    }
  }

  const { data, error } = await admin
    .from("organization_finance_records")
    .update({ program_id: input.programId })
    .eq("id", input.recordId)
    .eq("org_id", activeOrg.orgId)
    .eq("status", "recorded")
    .select("id")
    .maybeSingle()

  if (error || !data) {
    return { error: "Only recorded Finance items can change programs." }
  }

  revalidateFinanceRoutes()
  return { ok: true }
}
