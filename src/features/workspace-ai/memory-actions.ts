"use server"

import { resolveAuthenticatedAppContext } from "@/lib/auth/request-context"
import { personalMemoryMutationSchema } from "./lib/personal-memory"
import { PersonalMemoryError, readPersonalMemory, readOrganizationMemory } from "./server/personal-memory"

export async function loadPersonalMemory() {
  const context = await resolveAuthenticatedAppContext()
  const memory = await readPersonalMemory(context, context.activeOrg.orgId)
  const { data } = await context.supabase.from("organizations").select("profile").eq("user_id", context.activeOrg.orgId).maybeSingle()
  const profile = data?.profile
  const name = profile && typeof profile === "object" && !Array.isArray(profile) ? profile.name : null
  return { memory, organizationName: typeof name === "string" ? name : "Current organization" }
}

export async function changePersonalMemory(input: unknown) {
  const parsed = personalMemoryMutationSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: "Enter guidance between 1 and 500 characters." }
  try {
    const context = await resolveAuthenticatedAppContext()
    return { ok: true as const, memory: await readPersonalMemory(context, parsed.data.organizationId, parsed.data) }
  } catch (cause) {
    return { ok: false as const, error: cause instanceof PersonalMemoryError ? cause.message : "Memory could not be verified. Reload and try again." }
  }
}

export async function loadOrganizationMemory() {
  const context = await resolveAuthenticatedAppContext()
  const memory = await readOrganizationMemory(context, context.activeOrg.orgId)
  const { data } = await context.supabase.from("organizations").select("profile").eq("user_id", context.activeOrg.orgId).maybeSingle()
  const profile = data?.profile
  const name = profile && typeof profile === "object" && !Array.isArray(profile) ? profile.name : null
  return { memory, organizationName: typeof name === "string" ? name : "Current organization" }
}

export async function changeOrganizationMemory(input: unknown) {
  const parsed = personalMemoryMutationSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: "Enter guidance between 1 and 500 characters." }
  try {
    const context = await resolveAuthenticatedAppContext()
    return { ok: true as const, memory: await readOrganizationMemory(context, parsed.data.organizationId, parsed.data) }
  } catch (cause) {
    return { ok: false as const, error: cause instanceof PersonalMemoryError ? cause.message : "Memory could not be verified. Reload and try again." }
  }
}
