import { DEFAULT_WORKSTREAM_CATEGORIES as DEFAULT_CATEGORIES, simplifyWorkstreamCategories } from "./workstream-categories"
import { revalidatePath } from "next/cache"

import type { Database } from "@/lib/supabase"
import type { MemberWorkspaceWorkstreamCategory } from "../types"
import { actorCanAccessOrganizations } from "./member-workspace-actor-permissions"
import { resolveMemberWorkspaceActorContext } from "./member-workspace-actor-context"

type CategoryRow =
  Database["public"]["Tables"]["platform_admin_workstream_categories"]["Row"]
type StateRow =
  Database["public"]["Tables"]["platform_admin_project_workstream_states"]["Row"]
type WorkstreamMutationResult = { ok: true; id: string } | { error: string }
type WorkstreamRestoreResult = { ok: true } | { error: string }
type PlatformAdminActor = Awaited<
  ReturnType<typeof resolveMemberWorkspaceActorContext>
>


function isMissingTableError(error: unknown) {
  const code = (error as { code?: string } | null)?.code
  return code === "42P01" || code === "PGRST205"
}

function mapCategory(row: CategoryRow): MemberWorkspaceWorkstreamCategory {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    position: row.position,
    defaultKey: row.default_key,
  }
}

async function requirePlatformAdminActor(): Promise<
  { ok: true; actor: PlatformAdminActor } | { ok: false; error: string }
> {
  const actor = await resolveMemberWorkspaceActorContext()
  if (!actorCanAccessOrganizations(actor)) {
    return {
      ok: false,
      error: "Only platform admins can manage workstream categories.",
    }
  }
  return { ok: true, actor }
}

async function loadCategoryRows({
  ownerId,
  supabase,
}: {
  ownerId: string
  supabase: Awaited<
    ReturnType<typeof resolveMemberWorkspaceActorContext>
  >["supabase"]
}) {
  return supabase
    .from("platform_admin_workstream_categories")
    .select(
      "id, owner_id, name, color, position, default_key, created_at, updated_at"
    )
    .eq("owner_id", ownerId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true })
    .returns<CategoryRow[]>()
}

async function ensureDefaultCategoryRows({
  ownerId,
  supabase,
}: {
  ownerId: string
  supabase: Awaited<
    ReturnType<typeof resolveMemberWorkspaceActorContext>
  >["supabase"]
}) {
  const initial = await loadCategoryRows({ ownerId, supabase })
  if (initial.error) {
    if (isMissingTableError(initial.error)) return null
    throw new Error("Unable to load workstream categories.")
  }

  const existingKeys = new Set(
    (initial.data ?? []).map((row) => row.default_key).filter(Boolean)
  )
  const missingDefaults = DEFAULT_CATEGORIES.filter(
    (category) => !existingKeys.has(category.default_key)
  )

  if (missingDefaults.length > 0) {
    const { error } = await supabase
      .from("platform_admin_workstream_categories")
      .insert(
        missingDefaults.map((category) => ({ owner_id: ownerId, ...category }))
      )

    if (error) {
      if (isMissingTableError(error)) return null
      throw new Error(
        error.code === "23505"
          ? "A custom category conflicts with a default workstream category."
          : "Unable to create default workstream categories."
      )
    }
  }

  const refreshed = await loadCategoryRows({ ownerId, supabase })
  if (refreshed.error) {
    if (isMissingTableError(refreshed.error)) return null
    throw new Error("Unable to load workstream categories.")
  }

  return refreshed.data ?? []
}

export async function loadPlatformAdminWorkstreamConfiguration({
  actor,
  projectIds,
}: {
  actor: PlatformAdminActor
  projectIds: string[]
}) {
  if (!actorCanAccessOrganizations(actor)) return null
  const categoryRows = await ensureDefaultCategoryRows({
    ownerId: actor.userId,
    supabase: actor.supabase,
  })
  if (!categoryRows) return null

  const { categories, aliases } = simplifyWorkstreamCategories(categoryRows.map(mapCategory))
  const uniqueProjectIds = Array.from(
    new Set(projectIds.map((projectId) => projectId.trim()).filter(Boolean))
  )

  if (uniqueProjectIds.length === 0) {
    return { categories, categoryIdByProjectId: new Map<string, string>() }
  }

  const { data, error } = await actor.supabase
    .from("platform_admin_project_workstream_states")
    .select(
      "owner_id, project_id, category_id, started_at, created_at, updated_at"
    )
    .eq("owner_id", actor.userId)
    .in("project_id", uniqueProjectIds)
    .returns<StateRow[]>()

  if (error) {
    if (isMissingTableError(error)) return null
    throw new Error("Unable to load organization workstream stages.")
  }

  return {
    categories,
    categoryIdByProjectId: new Map(
      (data ?? []).map((row) => [row.project_id, aliases.get(row.category_id) ?? row.category_id] as const)
    ),
  }
}

function normalizeCategoryName(
  value: string
): { ok: true; name: string } | { ok: false; error: string } {
  const name = value.trim().replace(/\s+/g, " ")
  if (!name) return { ok: false, error: "Category name is required." }
  if (name.length > 48) {
    return {
      ok: false,
      error: "Category names must be 48 characters or fewer.",
    }
  }
  return { ok: true, name }
}

export async function createPlatformAdminWorkstreamCategoryAction(
  name: string
): Promise<WorkstreamMutationResult> {
  "use server"

  const resolved = await requirePlatformAdminActor()
  if (!resolved.ok) return { error: resolved.error }
  const normalized = normalizeCategoryName(name)
  if (!normalized.ok) return { error: normalized.error }
  const { actor } = resolved

  const { data: lastCategory, error: positionError } = await actor.supabase
    .from("platform_admin_workstream_categories")
    .select("position")
    .eq("owner_id", actor.userId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle<{ position: number }>()

  if (positionError) return { error: "Unable to create category." } as const

  const { data, error } = await actor.supabase
    .from("platform_admin_workstream_categories")
    .insert({
      owner_id: actor.userId,
      name: normalized.name,
      color: "violet",
      position: (lastCategory?.position ?? -1) + 1,
    })
    .select("id")
    .single<{ id: string }>()

  if (error || !data) {
    return {
      error:
        error?.code === "23505"
          ? "A category with that name already exists."
          : "Unable to create category.",
    } as const
  }

  revalidatePath("/organizations")
  revalidatePath("/projects")
  return { ok: true as const, id: data.id }
}

export async function updatePlatformAdminWorkstreamCategoryAction(
  categoryId: string,
  name: string
): Promise<WorkstreamMutationResult> {
  "use server"

  const resolved = await requirePlatformAdminActor()
  if (!resolved.ok) return { error: resolved.error }
  const normalized = normalizeCategoryName(name)
  if (!normalized.ok) return { error: normalized.error }
  const { actor } = resolved

  const { data, error } = await actor.supabase
    .from("platform_admin_workstream_categories")
    .update({ name: normalized.name })
    .eq("id", categoryId)
    .eq("owner_id", actor.userId)
    .select("id")
    .maybeSingle<{ id: string }>()

  if (error || !data) {
    return {
      error:
        error?.code === "23505"
          ? "A category with that name already exists."
          : "Unable to rename category.",
    } as const
  }

  revalidatePath("/organizations")
  revalidatePath("/projects")
  return { ok: true as const, id: data.id }
}

export async function deletePlatformAdminWorkstreamCategoryAction(
  categoryId: string
): Promise<WorkstreamMutationResult> {
  "use server"

  const resolved = await requirePlatformAdminActor()
  if (!resolved.ok) return { error: resolved.error }
  const { actor } = resolved
  const normalizedCategoryId = categoryId.trim()
  if (!normalizedCategoryId) {
    return { error: "Choose a category to delete." } as const
  }

  const { data: category, error: categoryError } = await actor.supabase
    .from("platform_admin_workstream_categories")
    .select("id, default_key")
    .eq("id", normalizedCategoryId)
    .eq("owner_id", actor.userId)
    .maybeSingle<{ id: string; default_key: string | null }>()

  if (categoryError) return { error: "Unable to delete category." } as const
  if (!category) {
    return { error: "That category is no longer available." } as const
  }
  if (category.default_key) {
    return {
      error:
        "Default workstream categories cannot be deleted. Rename them or restore their original names.",
    } as const
  }

  const { data: deletedCategory, error } = await actor.supabase
    .from("platform_admin_workstream_categories")
    .delete()
    .eq("id", normalizedCategoryId)
    .eq("owner_id", actor.userId)
    .select("id")
    .maybeSingle<{ id: string }>()

  if (error) return { error: "Unable to delete category." } as const
  if (!deletedCategory) {
    return { error: "That category is no longer available." } as const
  }

  revalidatePath("/organizations")
  revalidatePath("/projects")
  return { ok: true as const, id: deletedCategory.id }
}

export async function restorePlatformAdminWorkstreamDefaultsAction(): Promise<WorkstreamRestoreResult> {
  "use server"

  const resolved = await requirePlatformAdminActor()
  if (!resolved.ok) return { error: resolved.error }
  const { actor } = resolved
  const result = await loadCategoryRows({
    ownerId: actor.userId,
    supabase: actor.supabase,
  })

  if (result.error) {
    return {
      error: isMissingTableError(result.error)
        ? "Workstream categories need the latest database migration."
        : "Unable to load workstream categories.",
    } as const
  }

  const rows = result.data ?? []
  const defaultNames = new Set(
    DEFAULT_CATEGORIES.map((category) => category.name.toLowerCase())
  )
  const conflictingCustomCategory = rows.find(
    (row) => !row.default_key && defaultNames.has(row.name.trim().toLowerCase())
  )
  if (conflictingCustomCategory) {
    return {
      error: `Rename the custom “${conflictingCustomCategory.name}” category before restoring defaults.`,
    } as const
  }

  const rowsByDefaultKey = new Map(
    rows
      .filter((row) => row.default_key)
      .map((row) => [row.default_key, row] as const)
  )
  const missingDefaults = DEFAULT_CATEGORIES.filter(
    (category) => !rowsByDefaultKey.has(category.default_key)
  )
  if (missingDefaults.length > 0) {
    return {
      error: `Default workstream categories are missing: ${missingDefaults
        .map((category) => category.name)
        .join(", ")}. Reload the page before restoring defaults.`,
    } as const
  }

  const defaultPayload = DEFAULT_CATEGORIES.map((category) => ({
    id: rowsByDefaultKey.get(category.default_key)!.id,
    owner_id: actor.userId,
    ...category,
  }))
  const { error } = await actor.supabase
    .from("platform_admin_workstream_categories")
    .upsert(defaultPayload, { onConflict: "id" })

  if (error) {
    return {
      error:
        error.code === "23505"
          ? "A custom category now uses a default name. Rename it before restoring defaults."
          : "Unable to restore default workstream categories.",
    } as const
  }

  revalidatePath("/organizations")
  revalidatePath("/projects")
  return { ok: true as const }
}

export async function updatePlatformAdminProjectWorkstreamAction(
  projectId: string,
  categoryId: string
): Promise<WorkstreamMutationResult> {
  "use server"

  const resolved = await requirePlatformAdminActor()
  if (!resolved.ok) return { error: resolved.error }
  const { actor } = resolved
  const normalizedProjectId = projectId.trim()
  const normalizedCategoryId = categoryId.trim()
  if (!normalizedProjectId || !normalizedCategoryId) {
    return { error: "Choose a project and category." } as const
  }

  const [{ data: project }, { data: category }] = await Promise.all([
    actor.supabase
      .from("organization_projects")
      .select("id")
      .eq("id", normalizedProjectId)
      .maybeSingle<{ id: string }>(),
    actor.supabase
      .from("platform_admin_workstream_categories")
      .select("id")
      .eq("id", normalizedCategoryId)
      .eq("owner_id", actor.userId)
      .maybeSingle<{ id: string }>(),
  ])

  if (!project || !category) {
    return {
      error: "That project or category is no longer available.",
    } as const
  }

  const now = new Date().toISOString()
  const { error } = await actor.supabase
    .from("platform_admin_project_workstream_states")
    .upsert(
      {
        owner_id: actor.userId,
        project_id: normalizedProjectId,
        category_id: normalizedCategoryId,
        started_at: now,
        updated_at: now,
      },
      { onConflict: "owner_id,project_id" }
    )

  if (error) return { error: "Unable to move organization." } as const

  revalidatePath("/organizations")
  revalidatePath("/projects")
  return { ok: true as const, id: normalizedProjectId }
}
