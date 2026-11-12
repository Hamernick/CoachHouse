import "server-only"
import type { AuthenticatedAppRequestContext } from "@/lib/auth/request-context"
import { organizationMemorySchema, type OrganizationMemoryDependency, personalMemorySchema, type PersonalMemoryDependency, type PersonalMemoryMutation } from "../lib/personal-memory"

export function personalMemoryEnabled() {
  return process.env.WORKSPACE_AI_PERSONAL_MEMORY_ENABLED === "1"
}
export class PersonalMemoryError extends Error {}

/** The user JWT owns identity. No service-role writer or client-supplied owner. */
export async function readPersonalMemory(context: AuthenticatedAppRequestContext, organizationId: string, mutation?: PersonalMemoryMutation) {
  if (!personalMemoryEnabled()) throw new PersonalMemoryError("Memory is not available yet.")
  if (context.activeOrg.orgId !== organizationId) throw new PersonalMemoryError("Organization changed. Reopen Memory.")
  const { data, error } = await context.supabase.rpc("manage_personal_workspace_memory", {
    p_org_id: organizationId, p_action: mutation?.action ?? "read", p_revision: mutation?.revision ?? null,
    p_entry_id: mutation && "id" in mutation ? mutation.id : null,
    p_value: mutation && "value" in mutation ? mutation.value : null,
    p_enabled: mutation && "enabled" in mutation ? mutation.enabled : null,
  })
  if (error) throw new PersonalMemoryError(error.code === "40001" ? "Memory changed. Reload before saving; your draft is still here." : "Memory could not be verified. Reload and try again.")
  const memory = personalMemorySchema.parse(data)
  if (memory.organizationId !== organizationId || memory.userId !== context.user.id) throw new Error("Memory could not be verified.")
  return memory
}

export async function assertPersonalMemoryCurrent(context: AuthenticatedAppRequestContext, dependency?: PersonalMemoryDependency) {
  if (!dependency) return
  if (dependency.userId !== context.user.id || dependency.organizationId !== context.activeOrg.orgId) throw new Error("Memory unavailable.")
  const current = await readPersonalMemory(context, dependency.organizationId)
  if (!current.enabled || current.revision !== dependency.revision) throw new Error("Memory changed. Start a new chat with your current guidance.")
}

export function organizationMemoryEnabled() {
  return personalMemoryEnabled() && process.env.WORKSPACE_AI_ORGANIZATION_MEMORY_ENABLED === "1"
}

/** Same JWT/settings boundary, with a distinct explicit shared scope. */
export async function readOrganizationMemory(context: AuthenticatedAppRequestContext, organizationId: string, mutation?: PersonalMemoryMutation) {
  if (!organizationMemoryEnabled()) throw new PersonalMemoryError("Organization memory is not available yet.")
  if (context.activeOrg.orgId !== organizationId) throw new PersonalMemoryError("Organization changed. Reopen Memory.")
  const { data, error } = await context.supabase.rpc("manage_organization_workspace_memory", {
    p_org_id: organizationId, p_action: mutation?.action ?? "read", p_revision: mutation?.revision ?? null,
    p_entry_id: mutation && "id" in mutation ? mutation.id : null,
    p_value: mutation && "value" in mutation ? mutation.value : null,
    p_enabled: mutation && "enabled" in mutation ? mutation.enabled : null,
  })
  if (error) throw new PersonalMemoryError(error.code === "40001" ? "Memory changed. Reload before saving; your draft is still here." : "Organization memory could not be verified. Reload and check your access.")
  const memory = organizationMemorySchema.parse(data)
  if (memory.organizationId !== organizationId || memory.actorId !== context.user.id || memory.canManage !== (context.user.id === organizationId)) throw new Error("Memory could not be verified.")
  return memory
}

export async function assertOrganizationMemoryCurrent(context: AuthenticatedAppRequestContext, dependency?: OrganizationMemoryDependency) {
  if (!dependency) return
  if (dependency.actorId !== context.user.id || dependency.organizationId !== context.activeOrg.orgId) throw new Error("Memory unavailable.")
  const current = await readOrganizationMemory(context, dependency.organizationId)
  if (!current.enabled || current.revision !== dependency.revision) throw new Error("Memory changed. Start a new chat with your current guidance.")
}
