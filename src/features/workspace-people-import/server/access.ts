import "server-only"
import { requireServerSession } from "@/lib/auth"
import {
  canEditOrganization,
  resolveActiveOrganization,
} from "@/lib/organization/active-org"
type ImportAccess =
  | { error: string }
  | {
      supabase: Awaited<ReturnType<typeof requireServerSession>>["supabase"]
      orgId: string
      actorId: string
    }
export async function requirePeopleImportAccess(
  organizationId: string
): Promise<ImportAccess> {
  const { supabase, session } = await requireServerSession("/people")
  const { orgId, role } = await resolveActiveOrganization(
    supabase,
    session.user.id
  )
  if (orgId !== organizationId)
    return { error: "Your organization changed. Reopen this import." } as const
  let permitted = canEditOrganization(role)
  if (!permitted) {
    const { data } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .maybeSingle<{ role: string | null }>()
    permitted = data?.role === "admin"
  }
  if (!permitted) return { error: "Forbidden" } as const
  return { supabase, orgId, actorId: session.user.id }
}
