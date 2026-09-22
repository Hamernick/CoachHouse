import type { resolveMemberWorkspaceActorContext } from "./member-workspace-actor-context"
import type { User } from "@/features/platform-admin-dashboard"

export async function loadGuidedProjectMembers({ projectId, organizationId, supabase }: {
  projectId: string; organizationId: string; supabase: Awaited<ReturnType<typeof resolveMemberWorkspaceActorContext>>["supabase"]
}): Promise<User[] | undefined> {
  const { data, error } = await supabase.from("organization_projects").select("guided_setup").eq("id", projectId).eq("org_id", organizationId).maybeSingle<{ guided_setup: { ownerId?: string; contributorIds?: string[] } | null }>()
  // Older schemas/projects retain the existing member-label projection.
  if (error || !data?.guided_setup) return undefined
  const ids = [...new Set([data.guided_setup.ownerId, ...(data.guided_setup.contributorIds ?? [])].filter((id): id is string => Boolean(id)))]
  if (!ids.length) return []
  const result = await supabase.from("profiles").select("id, full_name, avatar_url").in("id", ids)
  if (result.error) throw new Error("Unable to load project people.")
  const profiles = new Map((result.data ?? []).map((profile) => [profile.id, profile]))
  return ids.map((id) => ({ id, name: profiles.get(id)?.full_name?.trim() || "Team member", avatarUrl: profiles.get(id)?.avatar_url ?? undefined }))
}
