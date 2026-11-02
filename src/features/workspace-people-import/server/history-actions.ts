"use server"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import type { OrgPerson } from "@/actions/people"
import { isActiveContact } from "@/lib/people/contact-schema"
import {
  PEOPLE_IMPORT_UNDO_DAYS,
  readPeopleImportHistory,
  undoPeopleImport,
  type PeopleImportSummary,
} from "@/lib/people/import-history"
import { mutateOrganizationPeopleProfile } from "@/lib/people/profile-write"
import { requirePeopleImportAccess } from "./access"

export async function listPeopleImports(
  organizationId: string
): Promise<{ imports: PeopleImportSummary[] } | { error: string }> {
  if (!z.string().min(1).max(128).safeParse(organizationId).success)
    return { error: "Choose an organization." }
  const access = await requirePeopleImportAccess(organizationId)
  if ("error" in access) return { error: access.error }
  const { data, error } = await access.supabase
    .from("organizations")
    .select("profile")
    .eq("user_id", access.orgId)
    .maybeSingle<{ profile: Record<string, unknown> | null }>()
  if (error) return { error: "Could not load recent imports." }
  const cutoff = Date.now() - PEOPLE_IMPORT_UNDO_DAYS * 86400000
  return {
    imports: readPeopleImportHistory(data?.profile?.people_import_history)
      .filter((item) => Date.parse(item.createdAt) >= cutoff)
      .reverse()
      .map(({ id, label, kind, createdAt, added, filled, undoneAt }) => ({
        id,
        label,
        kind,
        createdAt,
        added,
        filled,
        undoneAt,
      })),
  }
}
export async function undoWorkspacePeopleImport(input: {
  organizationId: string
  batchId: string
}): Promise<
  | {
      ok: true
      people: OrgPerson[]
      archived: number
      restored: number
      protectedCount: number
    }
  | { error: string }
> {
  const parsed = z
    .object({ organizationId: z.string().min(1).max(128), batchId: z.uuid() })
    .strict()
    .safeParse(input)
  if (!parsed.success) return { error: "Choose a recent import." }
  const access = await requirePeopleImportAccess(parsed.data.organizationId)
  if ("error" in access) return { error: access.error }
  const now = new Date().toISOString()
  const result = await mutateOrganizationPeopleProfile<
    OrgPerson,
    {
      people: OrgPerson[]
      archived: number
      restored: number
      protectedCount: number
    }
  >({
    supabase: access.supabase,
    orgId: access.orgId,
    mutate: (people, profile) => {
      const history = readPeopleImportHistory(profile.people_import_history)
      const batch = history.find((item) => item.id === parsed.data.batchId)
      if (
        !batch ||
        Date.parse(batch.createdAt) <
          Date.parse(now) - PEOPLE_IMPORT_UNDO_DAYS * 86400000
      )
        return { error: "This import is no longer available to undo." }
      const undone = undoPeopleImport(people, batch, now)
      const value = { ...undone, people: undone.people.filter(isActiveContact) }
      if (batch.undoneAt) return { ok: true, changed: false, value }
      return {
        ok: true,
        changed: true,
        people: undone.people,
        peopleImportHistory: history.map((item) =>
          item.id === batch.id ? { ...item, undoneAt: now } : item
        ),
        value,
      }
    },
  })
  if ("error" in result) return result
  for (const path of ["/my-organization", "/workspace", "/people"])
    revalidatePath(path)
  return { ok: true, ...result.value }
}
