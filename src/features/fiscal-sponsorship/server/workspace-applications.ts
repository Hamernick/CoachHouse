import { revalidatePath } from "next/cache"
import { z } from "zod"

import { createMemberWorkspaceProjectAction } from "@/features/member-workspace"
import { resolveAuthenticatedAppContext } from "@/lib/auth/request-context"
import { canEditOrganization } from "@/lib/organization/active-org"
import {
  buildFiscalSponsorshipApplicationDraft,
  buildFiscalSponsorshipApplicationInput,
} from "../lib/application-draft"
import { buildFiscalSponsorshipProjectWorkbenchData } from "../lib/project-workbench-data"
import type { FiscalWorkspaceApplication } from "../lib/workspace-applications"
import type { FiscalSponsorshipApplicationPrefill } from "../types"
import { saveFiscalSponsorshipApplicationDraft } from "./actions"

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

export async function loadFiscalWorkspaceApplications(): Promise<
  | { applications: FiscalWorkspaceApplication[]; orgId: string; canCreate: boolean }
  | { error: string }
> {
  const { supabase, activeOrg, user, profileAudience } =
    await resolveAuthenticatedAppContext()
  const { data: projects, error } = await supabase.from("organization_projects")
    .select("id, name, description, project_kind, option_settings, guided_setup")
    .eq("org_id", activeOrg.orgId)
    .eq("organization_unassigned", false)
    .order("created_at", { ascending: false })
  if (error) return { error: "Could not load sponsorship applications. Try again." }

  const candidates = (projects ?? []).filter((project) =>
    project.project_kind === "organization_admin" ||
    record(project.option_settings).fiscalSponsorshipEnabled === true ||
    record(project.guided_setup).fiscalSponsorshipEnabled === true
  )
  // Guest intake projects have a separate review surface and access boundary.
  const permissions = await Promise.all(candidates.map((project) =>
    supabase.rpc("fiscal_guest_project_reviewer_access", {
      p_project_id: project.id, p_user_id: user.id,
    })
  ))
  if (permissions.some((permission) => permission.error || permission.data === undefined)) {
    return { error: "Could not verify application access. Try again." }
  }
  const accessible = candidates.filter((_, index) => permissions[index].data === null)
  const result = accessible.length
    ? await supabase.from("fiscal_sponsorship_applications")
        .select("project_id, project_name, project_description, status, metadata")
        .eq("org_id", activeOrg.orgId)
        .in("project_id", accessible.map((project) => project.id))
    : { data: [], error: null }
  if (result.error) return { error: "Could not load sponsorship applications. Try again." }

  const applications: FiscalWorkspaceApplication[] = accessible.flatMap((project) => {
    const application = result.data?.find((row) => row.project_id === project.id)
    // Do not present an untouched organization shell as an application.
    if (!application && project.project_kind === "organization_admin") return []
    const sourceId = record(application?.metadata).selectedActivityId
    return [{
      projectId: project.id,
      name: application?.project_name?.trim() || project.name,
      description: application?.project_description ?? project.description,
      status: (application?.status ?? null) as FiscalWorkspaceApplication["status"],
      sourceActivityId: typeof sourceId === "string" ? sourceId : null,
    }]
  })
  return {
    applications,
    orgId: activeOrg.orgId,
    canCreate: profileAudience.isPlatformStaff || canEditOrganization(activeOrg.role),
  }
}

export async function startFiscalWorkspaceApplication(input: {
  orgId: string
  name: string
  description?: string
  organizationName?: string | null
  prefill?: FiscalSponsorshipApplicationPrefill | null
}): Promise<
  | { error: string }
  | { application: FiscalWorkspaceApplication; prefill: FiscalSponsorshipApplicationPrefill; warning: string | null }
> {
  const parsed = z.object({
    orgId: z.string().uuid(),
    name: z.string().trim().min(1).max(160),
    description: z.string().trim().max(4000).optional(),
    organizationName: z.string().trim().max(256).nullable().optional(),
  }).safeParse(input)
  if (!parsed.success) return { error: "Enter an activity name (160 characters or fewer)." }
  const context = await resolveAuthenticatedAppContext()
  if (parsed.data.orgId !== context.activeOrg.orgId) {
    return { error: "Your organization changed. Reopen Fiscal Sponsorship before starting." }
  }
  if (!context.profileAudience.isPlatformStaff && !canEditOrganization(context.activeOrg.role)) {
    return { error: "Only organization editors can start sponsorship applications." }
  }
  // The existing project action enforces entitlement, organization membership,
  // edit permissions, and transactional project creation.
  const created = await createMemberWorkspaceProjectAction({
    orgId: context.activeOrg.orgId,
    name: parsed.data.name,
    description: parsed.data.description,
    status: "planned",
    priority: "medium",
    fiscalSponsorshipEnabled: true,
  })
  if ("error" in created) return created
  const prefill = {
    ...input.prefill,
    projectName: parsed.data.name,
    projectDescription: parsed.data.description || null,
  }
  const application: FiscalWorkspaceApplication = {
    projectId: created.id,
    name: parsed.data.name,
    description: parsed.data.description || null,
    status: "draft",
    sourceActivityId: prefill.sourceActivityId ?? null,
  }
  const data = buildFiscalSponsorshipProjectWorkbenchData({
    project: { id: created.id, name: application.name, description: application.description },
    organization: { name: parsed.data.organizationName ?? "", ownerName: prefill.applicantFullName },
    applicationPrefill: prefill,
  })
  // Persist the initial intake, so a selected activity's prefill survives reload.
  // If that write fails, return the created project rather than creating it again.
  let warning: string | null = null
  try {
    const saved = await saveFiscalSponsorshipApplicationDraft(
      buildFiscalSponsorshipApplicationInput({
        data,
        draft: buildFiscalSponsorshipApplicationDraft({ data }),
      })
    )
    if ("error" in saved) warning = saved.error
  } catch {
    warning = "Your activity was created, but the application could not be saved. Open it to continue."
  }
  revalidatePath("/workspace")
  return { application, prefill, warning }
}
