import type { Json } from "@/lib/supabase"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

type ProjectCreationTransitionResult =
  | { ok: true; projectId: string }
  | { code: string; ok: false }

type ProjectUpdateTransitionResult =
  | { ok: true; projectId: string; updatedAt: string }
  | { code: string; ok: false }

function parseProjectCreationTransitionResult(
  value: unknown
): ProjectCreationTransitionResult | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null

  const result = value as Record<string, unknown>
  if (result.ok === false && typeof result.code === "string") {
    return { code: result.code, ok: false }
  }
  if (result.ok === true && typeof result.projectId === "string") {
    return { ok: true, projectId: result.projectId }
  }
  return null
}

function parseProjectUpdateTransitionResult(
  value: unknown
): ProjectUpdateTransitionResult | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null

  const result = value as Record<string, unknown>
  if (result.ok === false && typeof result.code === "string") {
    return { code: result.code, ok: false }
  }
  if (
    result.ok === true &&
    typeof result.projectId === "string" &&
    typeof result.updatedAt === "string"
  ) {
    return {
      ok: true,
      projectId: result.projectId,
      updatedAt: result.updatedAt,
    }
  }
  return null
}

function isMissingProjectCreationTransition(error: unknown) {
  if (!error || typeof error !== "object") return false
  const record = error as Record<string, unknown>
  if (record.code === "42883" || record.code === "PGRST202") return true
  return (
    typeof record.message === "string" &&
    record.message.includes("create_organization_project_transition")
  )
}

function isMissingProjectUpdateTransition(error: unknown) {
  if (!error || typeof error !== "object") return false
  const record = error as Record<string, unknown>
  if (record.code === "42883" || record.code === "PGRST202") return true
  return (
    typeof record.message === "string" &&
    record.message.includes("update_organization_project_transition")
  )
}

function isMissingProjectStatusTransition(error: unknown) {
  if (!error || typeof error !== "object") return false
  const record = error as Record<string, unknown>
  if (record.code === "42883" || record.code === "PGRST202") return true
  return (
    typeof record.message === "string" &&
    record.message.includes("update_organization_project_status_transition")
  )
}

function isMissingProjectScheduleTransition(error: unknown) {
  if (!error || typeof error !== "object") return false
  const record = error as Record<string, unknown>
  if (record.code === "42883" || record.code === "PGRST202") return true
  return (
    typeof record.message === "string" &&
    record.message.includes("update_organization_project_schedule_transition")
  )
}

function projectCreationFailure(code: string) {
  if (code === "organization_not_found") {
    return { error: "Choose a valid organization for the project." }
  }
  if (code === "invalid_overview") {
    return { error: "Unable to save the overview document." }
  }
  return { error: "Unable to create project." }
}

export async function transitionOrganizationProjectCreation({
  actorId,
  hasOverviewDocument,
  orgId,
  overviewDocumentHtml,
  overviewDocumentText,
  project,
}: {
  actorId: string
  hasOverviewDocument: boolean
  orgId: string
  overviewDocumentHtml: string | null
  overviewDocumentText: string | null
  project: Json
}) {
  const admin = createSupabaseAdminClient()
  const { data, error } = await admin.rpc(
    project && typeof project === "object" && !Array.isArray(project) && "option_settings" in project
      ? "create_organization_project_with_options" : "create_organization_project_transition",
    {
      p_actor_id: actorId,
      p_has_overview_document: hasOverviewDocument,
      p_org_id: orgId,
      p_overview_document_html: overviewDocumentHtml,
      p_overview_document_text: overviewDocumentText,
      p_project: project,
    }
  )

  if (error) {
    return isMissingProjectCreationTransition(error)
      ? {
          error:
            "Organizations are not available until the latest workspace database migrations are applied.",
        }
      : { error: "Unable to create project." }
  }

  const result = parseProjectCreationTransitionResult(data)
  if (!result) return { error: "Unable to create project." }
  return result.ok ? result : projectCreationFailure(result.code)
}

export async function transitionOrganizationProjectUpdate({
  actorId,
  expectedOrgId,
  expectedUpdatedAt,
  hasOverviewDocument,
  overviewDocumentHtml,
  overviewDocumentText,
  project,
  projectId,
}: {
  actorId: string
  expectedOrgId: string
  expectedUpdatedAt: string
  hasOverviewDocument: boolean
  overviewDocumentHtml: string | null
  overviewDocumentText: string | null
  project: Json
  projectId: string
}) {
  const admin = createSupabaseAdminClient()
  const { data, error } = await admin.rpc(
    project && typeof project === "object" && !Array.isArray(project) && "option_settings" in project
      ? "update_organization_project_with_options" : "update_organization_project_transition",
    {
      p_actor_id: actorId,
      p_expected_org_id: expectedOrgId,
      p_expected_updated_at: expectedUpdatedAt,
      p_has_overview_document: hasOverviewDocument,
      p_overview_document_html: overviewDocumentHtml,
      p_overview_document_text: overviewDocumentText,
      p_project: project,
      p_project_id: projectId,
    }
  )

  if (error) {
    return isMissingProjectUpdateTransition(error)
      ? {
          error:
            "Organizations are not available until the latest workspace database migrations are applied.",
        }
      : { error: "Unable to update project." }
  }

  const result = parseProjectUpdateTransitionResult(data)
  if (!result) return { error: "Unable to update project." }
  if (result.ok) return result
  if (result.code === "stale" || result.code === "scope_changed") {
    return { error: "This project changed. Refresh before saving again." }
  }
  if (result.code === "not_found") {
    return { error: "Unable to find that project." }
  }
  if (result.code === "invalid_overview") {
    return { error: "Unable to save the overview document." }
  }
  return { error: "Unable to update project." }
}

export async function transitionOrganizationProjectStatus({
  actorId,
  expectedOrgId,
  expectedUpdatedAt,
  projectId,
  status,
}: {
  actorId: string
  expectedOrgId: string
  expectedUpdatedAt: string
  projectId: string
  status: string
}) {
  const admin = createSupabaseAdminClient()
  const { data, error } = await admin.rpc(
    "update_organization_project_status_transition",
    {
      p_actor_id: actorId,
      p_expected_org_id: expectedOrgId,
      p_expected_updated_at: expectedUpdatedAt,
      p_project_id: projectId,
      p_status: status,
    }
  )

  if (error) {
    return isMissingProjectStatusTransition(error)
      ? {
          error:
            "Organizations are not available until the latest workspace database migrations are applied.",
        }
      : { error: "Unable to update project status." }
  }

  const result = parseProjectUpdateTransitionResult(data)
  if (!result) return { error: "Unable to update project status." }
  if (result.ok) return result
  if (result.code === "stale" || result.code === "scope_changed") {
    return { error: "This project changed. Refresh before saving again." }
  }
  if (result.code === "not_found") {
    return { error: "Unable to find that project." }
  }
  return { error: "Unable to update project status." }
}

export async function transitionOrganizationProjectSchedule({
  actorId,
  endDate,
  expectedOrgId,
  expectedUpdatedAt,
  projectId,
  startDate,
}: {
  actorId: string
  endDate: string
  expectedOrgId: string
  expectedUpdatedAt: string
  projectId: string
  startDate: string
}) {
  const admin = createSupabaseAdminClient()
  const { data, error } = await admin.rpc(
    "update_organization_project_schedule_transition",
    {
      p_actor_id: actorId,
      p_end_date: endDate,
      p_expected_org_id: expectedOrgId,
      p_expected_updated_at: expectedUpdatedAt,
      p_project_id: projectId,
      p_start_date: startDate,
    }
  )

  if (error) {
    return isMissingProjectScheduleTransition(error)
      ? {
          error:
            "Organizations are not available until the latest workspace database migrations are applied.",
        }
      : { error: "Unable to update project dates." }
  }

  const result = parseProjectUpdateTransitionResult(data)
  if (!result) return { error: "Unable to update project dates." }
  if (result.ok) return result
  if (result.code === "stale" || result.code === "scope_changed") {
    return { error: "This project changed. Refresh before saving again." }
  }
  if (result.code === "not_found") {
    return { error: "Unable to find that project." }
  }
  return { error: "Unable to update project dates." }
}
