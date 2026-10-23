import "server-only"

import { cookies } from "next/headers"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { writeActiveOrganizationCookie } from "@/lib/organization/active-org-cookie"
import { hasWorkspaceSupportAccess, SUPPORT_ORGANIZATION_COOKIE } from "@/lib/organization/support-access"
import type { MemberWorkspaceSetActiveOrganizationResult } from "../types"

export async function setActiveOrganization(orgId: string): Promise<MemberWorkspaceSetActiveOrganizationResult> {
  const target = orgId.trim()
  if (!target) return { error: "Choose an organization." }
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated." }

  let supportAccess = false
  if (target !== user.id) {
    supportAccess = await hasWorkspaceSupportAccess(supabase)
    if (supportAccess) {
      // This RPC checks the live grant, verifies the target, and records entry.
      // Do not fetch every accessible organization's full profile to switch one.
      const { error } = await supabase.rpc("record_workspace_support_entry" as never, { p_org: target } as never)
      if (error) return { error: "Unable to record support access. Please try again." }
    } else {
      const { data, error } = await supabase.from("organization_memberships")
        .select("org_id").eq("org_id", target).eq("member_id", user.id).maybeSingle()
      if (error || !data) return { error: "You do not have access to that organization." }
    }
  }
  await writeActiveOrganizationCookie(target)
  const cookieStore = await cookies()
  cookieStore.set(SUPPORT_ORGANIZATION_COOKIE, supportAccess ? target : "", {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/",
    maxAge: supportAccess ? 60 * 60 * 8 : 0,
  })
  return { ok: true, orgId: target, supportAccess }
}

export async function handleOrganizationSwitchPost(request: Request) {
  const respond = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } })
  if (request.headers.get("origin") !== new URL(request.url).origin) return respond({ error: "Invalid request origin." }, 403)
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return respond({ error: "Expected JSON." }, 415)
  try {
    const body = await request.text()
    if (body.length > 1000) return respond({ error: "Invalid organization." }, 400)
    const input = JSON.parse(body)
    if (typeof input?.orgId !== "string") return respond({ error: "Choose an organization." }, 400)
    return respond(await setActiveOrganization(input.orgId))
  } catch {
    return respond({ error: "Unable to switch organizations. Please try again." }, 503)
  }
}
