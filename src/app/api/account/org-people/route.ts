import { isActiveContact } from "@/lib/people/contact-schema"
import { NextResponse, type NextRequest } from "next/server"

import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route"
import { normalizePersonCategory, type PersonCategory } from "@/lib/people/categories"
import { resolveActiveOrganization } from "@/lib/organization/active-org"

type OrgPersonSummary = {
  id: string
  name: string
  title: string | null
  category: PersonCategory
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

export async function GET(request: NextRequest) {
  const response = NextResponse.next()
  const supabase = createSupabaseRouteHandlerClient(request, response)
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json({ error: error?.message ?? "Unauthorized" }, { status: 401 })
  }

  const { orgId } = await resolveActiveOrganization(supabase, user.id)

  const { data: orgRow, error: orgErr } = await supabase
    .from("organizations")
    .select("profile")
    .eq("user_id", orgId)
    .maybeSingle<{ profile: Record<string, unknown> | null }>()

  if (orgErr) {
    return NextResponse.json({ error: orgErr.message }, { status: 500 })
  }

  const profile = (orgRow?.profile ?? {}) as Record<string, unknown>
  const raw = Array.isArray(profile.org_people) ? profile.org_people.filter(isActiveContact) : []
  const people = raw
    .filter((entry): entry is Record<string, unknown> => isRecord(entry))
    .map(
      (entry): OrgPersonSummary => ({
        id: typeof entry.id === "string" ? entry.id : "",
        name: typeof entry.name === "string" ? entry.name : "",
        title: typeof entry.title === "string" ? entry.title : null,
        category: normalizePersonCategory(typeof entry.category === "string" ? entry.category : ""),
      }),
    )
    .filter((person) => Boolean(person.id && person.name))

  return NextResponse.json({ people }, { status: 200 })
}
