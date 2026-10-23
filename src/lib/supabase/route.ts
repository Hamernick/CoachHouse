import { createServerClient } from "@supabase/ssr"
import type { NextRequest, NextResponse } from "next/server"

import { env } from "@/lib/env"
import type { Database } from "./types"
import { organizationWorkspaceSupportEnabled } from "@/lib/feature-flags"
import { ORGANIZATION_SCOPE_HEADER, SUPPORT_ORGANIZATION_COOKIE } from "@/lib/organization/support-access"

export function createSupabaseRouteHandlerClient(
  request: NextRequest,
  response: NextResponse
) {
  const scopedOrg = organizationWorkspaceSupportEnabled
    ? request.headers.get(ORGANIZATION_SCOPE_HEADER) ?? request.cookies.get(SUPPORT_ORGANIZATION_COOKIE)?.value ?? request.cookies.get("coach_house_active_org")?.value
    : null
  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      ...(scopedOrg ? { global: { headers: { [ORGANIZATION_SCOPE_HEADER]: scopedOrg } } } : {}),
      cookies: {
        get(name) {
          return request.cookies.get(name)?.value
        },
        set(name, value, options) {
          response.cookies.set({ name, value, ...options })
        },
        remove(name, options) {
          response.cookies.set({ name, value: "", ...options, maxAge: 0 })
        },
      },
    }
  )
}
