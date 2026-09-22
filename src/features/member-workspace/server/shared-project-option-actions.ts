"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { resolveMemberWorkspaceActorContext } from "./member-workspace-actor-context"
import { actorCanAccessOrganizations } from "./member-workspace-actor-permissions"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

const optionSchema = z.object({ id: z.string().uuid(), label: z.string().trim().min(1).max(80).refine((value) => !value.includes(",")), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(), updatedAt: z.string().optional() })
const settingsSchema = z.object({ tags: z.array(optionSchema), sprintTypes: z.array(optionSchema) })
const unavailable = "Shared project options need the latest database migration."

export async function loadSharedProjectOptions() {
  const actor = await resolveMemberWorkspaceActorContext()
  if (!actorCanAccessOrganizations(actor)) {
    // Members can still edit their project without receiving other organizations' vocabulary.
    if (actor.hasMemberWorkspaceAccess) return { settings: { tags: [], sprintTypes: [] } }
    return { error: "Only Coach House staff can manage shared options." }
  }
  const { data, error } = await createSupabaseAdminClient().rpc("load_shared_project_options", {})
  if (error) return { error: ["42883", "PGRST202"].includes(error.code) ? unavailable : "Could not load shared options." }
  const parsed = settingsSchema.safeParse(data)
  return parsed.success ? { settings: parsed.data } : { error: "Could not read shared options." }
}

export async function manageSharedProjectOption(input: { action: "save" | "delete"; kind: "tag" | "sprintType"; option: z.infer<typeof optionSchema> }) {
  const actor = await resolveMemberWorkspaceActorContext()
  if (!actorCanAccessOrganizations(actor)) return { error: "Only Coach House staff can manage shared options." }
  const parsed = z.object({ action: z.enum(["save", "delete"]), kind: z.enum(["tag", "sprintType"]), option: optionSchema }).safeParse(input)
  if (!parsed.success) return { error: "Check the option name and color." }
  const value = parsed.data
  const { data, error } = await createSupabaseAdminClient().rpc("manage_shared_project_option", {
    p_actor_id: actor.userId, p_action: value.action, p_kind: value.kind, p_option: value.option, p_expected_updated_at: value.option.updatedAt ?? null,
  })
  if (error) return { error: ["42883", "PGRST202"].includes(error.code) ? unavailable : "Could not save the shared option." }
  const result = data as { error?: string; option?: unknown } | null
  if (result?.error) return { error: result.error }
  const option = optionSchema.safeParse(result?.option)
  if (!option.success) return { error: "Could not read the saved option." }
  revalidatePath("/projects", "layout"); revalidatePath("/organizations", "layout")
  return { option: option.data }
}
