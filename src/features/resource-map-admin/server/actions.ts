"use server"

import { revalidatePath } from "next/cache"

import { requireAdmin } from "@/lib/admin/auth"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import type { Json } from "@/lib/supabase"

import {
  normalizeCanonicalEditInput,
  normalizeCanonicalStateInput,
  normalizeImportReviewInput,
  normalizeMatchReviewInput,
  normalizePromotionInput,
  normalizeVisibilityInput,
} from "../lib"
import type {
  ResourceMapAdminActionResult,
  ResourceMapAdminCanonicalAction,
  ResourceMapAdminCanonicalEditInput,
  ResourceMapAdminCanonicalStateInput,
  ResourceMapAdminImportReviewInput,
  ResourceMapAdminMatchReviewInput,
  ResourceMapAdminPromotionInput,
  ResourceMapAdminVisibilityInput,
} from "../types"
import { assertResourceMapImportReadyForApproval } from "./approval-readiness"

type ResourceMapAdminClient = ReturnType<typeof createSupabaseAdminClient>
type CanonicalTable = "resource_map_organizations" | "resource_map_services"
type VisibilityTable = "resource_map_contacts" | "resource_map_links"
type ResourceMapAdminTable =
  | CanonicalTable
  | VisibilityTable
  | "resource_map_import_records"
  | "resource_map_import_record_matches"
type ResourceMapRow = Record<string, unknown>

function formatResourceMapAdminError(error: unknown) {
  if (error instanceof Error) return error.message
  if (!error || typeof error !== "object") return "Unknown resource map error."

  const record = error as Record<string, unknown>
  const message = typeof record.message === "string" ? record.message : null
  const details = typeof record.details === "string" ? record.details : null
  return (
    [message, details].filter(Boolean).join(" — ") ||
    "Unknown resource map error."
  )
}

function canonicalTableForTarget(
  target: ResourceMapAdminCanonicalStateInput["target"]
): CanonicalTable {
  return target === "organization"
    ? "resource_map_organizations"
    : "resource_map_services"
}

function visibilityTableForKind(
  kind: ResourceMapAdminVisibilityInput["kind"]
): VisibilityTable {
  return kind === "contact" ? "resource_map_contacts" : "resource_map_links"
}

function curationEventActionForCanonicalAction(
  action: ResourceMapAdminCanonicalAction
) {
  return action === "delete" ? "delete" : action
}

function publicVisibilityForRestore(row: ResourceMapRow) {
  return row.approved_at ? "published" : "draft"
}

function buildCanonicalUpdate({
  action,
  actorId,
  reason,
  now,
  row,
}: {
  action: ResourceMapAdminCanonicalAction
  actorId: string
  reason: string | null | undefined
  now: string
  row: ResourceMapRow
}) {
  if (action === "approve") {
    return {
      visibility: "published",
      review_status: "approved",
      approved_by: actorId,
      approved_at: now,
      hidden_by: null,
      hidden_at: null,
      hidden_reason: null,
      suppressed_by: null,
      suppressed_at: null,
      suppression_reason: null,
      deleted_by: null,
      deleted_at: null,
      delete_reason: null,
      updated_by: actorId,
    }
  }

  if (action === "hide") {
    return {
      visibility: "hidden",
      hidden_by: actorId,
      hidden_at: now,
      hidden_reason: reason,
      updated_by: actorId,
    }
  }

  if (action === "suppress") {
    return {
      visibility: "suppressed",
      suppressed_by: actorId,
      suppressed_at: now,
      suppression_reason: reason,
      updated_by: actorId,
    }
  }

  if (action === "restore") {
    return {
      visibility: publicVisibilityForRestore(row),
      hidden_by: null,
      hidden_at: null,
      hidden_reason: null,
      suppressed_by: null,
      suppressed_at: null,
      suppression_reason: null,
      deleted_by: null,
      deleted_at: null,
      delete_reason: null,
      updated_by: actorId,
    }
  }

  return {
    visibility: "deleted",
    deleted_by: actorId,
    deleted_at: now,
    delete_reason: reason,
    updated_by: actorId,
  }
}

async function loadRowById(
  admin: ResourceMapAdminClient,
  table: ResourceMapAdminTable,
  id: string
) {
  const { data, error } = await admin
    .from(table)
    .select("*")
    .eq("id", id)
    .maybeSingle()

  if (error) {
    throw new Error(formatResourceMapAdminError(error))
  }

  if (!data) {
    throw new Error("Resource map record not found.")
  }

  return data as ResourceMapRow
}

async function insertCurationEvent({
  admin,
  action,
  actorId,
  reason,
  beforeState,
  afterState,
  organizationId,
  serviceId,
  importRecordId,
  contactId,
  linkId,
}: {
  admin: ResourceMapAdminClient
  action: string
  actorId: string
  reason?: string | null
  beforeState: ResourceMapRow | null
  afterState: ResourceMapRow | null
  organizationId?: string | null
  serviceId?: string | null
  importRecordId?: string | null
  contactId?: string | null
  linkId?: string | null
}) {
  const { error } = await admin.from("resource_map_curation_events").insert({
    action,
    actor_id: actorId,
    reason: reason ?? null,
    before_state: (beforeState ?? {}) as Json,
    after_state: (afterState ?? {}) as Json,
    organization_id: organizationId ?? null,
    service_id: serviceId ?? null,
    import_record_id: importRecordId ?? null,
    contact_id: contactId ?? null,
    link_id: linkId ?? null,
  })

  if (error) {
    throw new Error(formatResourceMapAdminError(error))
  }
}

function revalidateResourceMapAdminPaths() {
  revalidatePath("/map")
  revalidatePath("/resources")
  revalidatePath("/admin")
  revalidatePath("/admin/platform/resource-map")
  revalidatePath("/internal")
}

async function requireResourceMapAdmin() {
  const { userId } = await requireAdmin()
  return {
    userId,
    admin: createSupabaseAdminClient(),
  }
}

export async function updateResourceMapCanonicalStateAction(
  input: ResourceMapAdminCanonicalStateInput
): Promise<ResourceMapAdminActionResult> {
  try {
    const normalized = normalizeCanonicalStateInput(input)
    const { admin, userId } = await requireResourceMapAdmin()
    const table = canonicalTableForTarget(normalized.target)
    const current = await loadRowById(admin, table, normalized.id)
    const now = new Date().toISOString()
    const update = buildCanonicalUpdate({
      action: normalized.action,
      actorId: userId,
      reason: normalized.reason,
      now,
      row: current,
    })

    const { data: updated, error } = await admin
      .from(table)
      .update(update)
      .eq("id", normalized.id)
      .select("*")
      .maybeSingle()

    if (error) {
      throw new Error(formatResourceMapAdminError(error))
    }

    if (!updated) {
      throw new Error("Resource map record was not updated.")
    }

    await insertCurationEvent({
      admin,
      action: curationEventActionForCanonicalAction(normalized.action),
      actorId: userId,
      reason: normalized.reason,
      beforeState: current,
      afterState: updated as ResourceMapRow,
      organizationId:
        normalized.target === "organization" ? normalized.id : null,
      serviceId: normalized.target === "service" ? normalized.id : null,
    })

    revalidateResourceMapAdminPaths()
    return { ok: true, id: normalized.id }
  } catch (error) {
    return { error: formatResourceMapAdminError(error) }
  }
}

export async function updateResourceMapCanonicalFieldsAction(
  input: ResourceMapAdminCanonicalEditInput
): Promise<ResourceMapAdminActionResult> {
  try {
    const normalized = normalizeCanonicalEditInput(input)
    const { admin, userId } = await requireResourceMapAdmin()
    const table = canonicalTableForTarget(normalized.target)
    const current = await loadRowById(admin, table, normalized.id)

    const { data: updated, error } = await admin
      .from(table)
      .update({
        ...normalized.fields,
        updated_by: userId,
      })
      .eq("id", normalized.id)
      .select("*")
      .maybeSingle()

    if (error) {
      throw new Error(formatResourceMapAdminError(error))
    }

    if (!updated) {
      throw new Error("Resource map record was not updated.")
    }

    await insertCurationEvent({
      admin,
      action: "edit",
      actorId: userId,
      reason: normalized.reason,
      beforeState: current,
      afterState: updated as ResourceMapRow,
      organizationId:
        normalized.target === "organization" ? normalized.id : null,
      serviceId: normalized.target === "service" ? normalized.id : null,
    })

    revalidateResourceMapAdminPaths()
    return { ok: true, id: normalized.id }
  } catch (error) {
    return { error: formatResourceMapAdminError(error) }
  }
}

export async function reviewResourceMapImportRecordAction(
  input: ResourceMapAdminImportReviewInput
): Promise<ResourceMapAdminActionResult> {
  try {
    const normalized = normalizeImportReviewInput(input)
    const { admin, userId } = await requireResourceMapAdmin()
    const current = await loadRowById(
      admin,
      "resource_map_import_records",
      normalized.importRecordId
    )
    const now = new Date().toISOString()
    if (normalized.status === "approved") {
      await assertResourceMapImportReadyForApproval({ admin, record: current })
    }
    const promotionStatus =
      normalized.status === "approved"
        ? "ready"
        : normalized.status === "rejected" || normalized.status === "stale"
          ? "blocked"
          : "not_promoted"

    const { data: updated, error } = await admin
      .from("resource_map_import_records")
      .update({
        review_status: normalized.status,
        promotion_status: promotionStatus,
        reviewed_by: userId,
        reviewed_at: now,
        rejection_reason:
          normalized.status === "rejected" ? normalized.reason : null,
        stale_reason: normalized.status === "stale" ? normalized.reason : null,
      })
      .eq("id", normalized.importRecordId)
      .select("*")
      .maybeSingle()

    if (error) {
      throw new Error(formatResourceMapAdminError(error))
    }

    if (!updated) {
      throw new Error("Import record was not updated.")
    }

    await insertCurationEvent({
      admin,
      action:
        normalized.status === "rejected"
          ? "reject"
          : normalized.status === "stale"
            ? "mark_stale"
            : normalized.status === "approved"
              ? "approve"
              : "edit",
      actorId: userId,
      reason: normalized.reason,
      beforeState: current,
      afterState: updated as ResourceMapRow,
      importRecordId: normalized.importRecordId,
    })

    revalidateResourceMapAdminPaths()
    return { ok: true, id: normalized.importRecordId }
  } catch (error) {
    return { error: formatResourceMapAdminError(error) }
  }
}

export async function setResourceMapPublicVisibilityAction(
  input: ResourceMapAdminVisibilityInput
): Promise<ResourceMapAdminActionResult> {
  try {
    const normalized = normalizeVisibilityInput(input)
    const { admin, userId } = await requireResourceMapAdmin()
    const table = visibilityTableForKind(normalized.kind)
    const current = await loadRowById(admin, table, normalized.id)

    const { data: updated, error } = await admin
      .from(table)
      .update({ is_public: normalized.isPublic })
      .eq("id", normalized.id)
      .select("*")
      .maybeSingle()

    if (error) {
      throw new Error(formatResourceMapAdminError(error))
    }

    if (!updated) {
      throw new Error("Visibility target was not updated.")
    }

    await insertCurationEvent({
      admin,
      action:
        normalized.kind === "contact"
          ? "contact_visibility"
          : "link_visibility",
      actorId: userId,
      reason: normalized.reason,
      beforeState: current,
      afterState: updated as ResourceMapRow,
      contactId: normalized.kind === "contact" ? normalized.id : null,
      linkId: normalized.kind === "link" ? normalized.id : null,
      organizationId:
        typeof current.organization_id === "string"
          ? current.organization_id
          : null,
      serviceId:
        typeof current.service_id === "string" ? current.service_id : null,
    })

    revalidateResourceMapAdminPaths()
    return { ok: true, id: normalized.id }
  } catch (error) {
    return { error: formatResourceMapAdminError(error) }
  }
}

export async function reviewResourceMapImportMatchAction(
  input: ResourceMapAdminMatchReviewInput
): Promise<ResourceMapAdminActionResult> {
  try {
    const normalized = normalizeMatchReviewInput(input)
    const { admin, userId } = await requireResourceMapAdmin()
    const current = await loadRowById(
      admin,
      "resource_map_import_record_matches",
      normalized.matchId
    )
    const now = new Date().toISOString()

    const { data: updated, error } = await admin
      .from("resource_map_import_record_matches")
      .update({
        match_status: normalized.status,
        match_reason: normalized.reason,
        reviewed_by: userId,
        reviewed_at: now,
      })
      .eq("id", normalized.matchId)
      .select("*")
      .maybeSingle()

    if (error) {
      throw new Error(formatResourceMapAdminError(error))
    }

    if (!updated) {
      throw new Error("Match record was not updated.")
    }

    await insertCurationEvent({
      admin,
      action:
        normalized.status === "accepted"
          ? "merge_duplicate"
          : normalized.status === "rejected"
            ? "reject"
            : "edit",
      actorId: userId,
      reason: normalized.reason,
      beforeState: current,
      afterState: updated as ResourceMapRow,
      importRecordId:
        typeof current.import_record_id === "string"
          ? current.import_record_id
          : null,
      organizationId:
        typeof current.organization_id === "string"
          ? current.organization_id
          : null,
      serviceId:
        typeof current.service_id === "string" ? current.service_id : null,
    })

    revalidateResourceMapAdminPaths()
    return { ok: true, id: normalized.matchId }
  } catch (error) {
    return { error: formatResourceMapAdminError(error) }
  }
}

export async function markResourceMapImportPromotedAction(
  input: ResourceMapAdminPromotionInput
): Promise<ResourceMapAdminActionResult> {
  try {
    const normalized = normalizePromotionInput(input)
    const { admin, userId } = await requireResourceMapAdmin()
    const current = await loadRowById(
      admin,
      "resource_map_import_records",
      normalized.importRecordId
    )

    const { data: updated, error } = await admin
      .from("resource_map_import_records")
      .update({
        promotion_status: "promoted",
        promoted_organization_id: normalized.promotedOrganizationId,
        promoted_service_id: normalized.promotedServiceId,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", normalized.importRecordId)
      .select("*")
      .maybeSingle()

    if (error) {
      throw new Error(formatResourceMapAdminError(error))
    }

    if (!updated) {
      throw new Error("Import promotion state was not updated.")
    }

    await insertCurationEvent({
      admin,
      action: "promote",
      actorId: userId,
      reason: normalized.reason,
      beforeState: current,
      afterState: updated as ResourceMapRow,
      importRecordId: normalized.importRecordId,
      organizationId: normalized.promotedOrganizationId,
      serviceId: normalized.promotedServiceId,
    })

    revalidateResourceMapAdminPaths()
    return { ok: true, id: normalized.importRecordId }
  } catch (error) {
    return { error: formatResourceMapAdminError(error) }
  }
}
