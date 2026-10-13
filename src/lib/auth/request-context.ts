import type { User } from "@supabase/supabase-js"
import { cache } from "react"
import { getServerUser } from "@/server/auth/server-user"

import { resolveProfileAudience, resolveTesterMetadata } from "@/lib/devtools/audience"
import { readActiveOrganizationCookie } from "@/lib/organization/active-org-cookie"
import { resolveActiveOrganization } from "@/lib/organization/active-org"
import { isSupabaseAuthSessionMissingError } from "@/lib/supabase/auth-errors"
import { supabaseErrorToError } from "@/lib/supabase/errors"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export type AuthenticatedAppRequestContext = {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
  user: User
  profileAudience: Awaited<ReturnType<typeof resolveProfileAudience>>
  activeOrg: Awaited<ReturnType<typeof resolveActiveOrganization>>
}

const resolveOptionalAuthenticatedAppContextCached = cache(
  async (): Promise<AuthenticatedAppRequestContext | null> => {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
      error: userError,
    } = await getServerUser(supabase)

    if (userError && !isSupabaseAuthSessionMissingError(userError)) {
      throw supabaseErrorToError(userError, "Unable to load user.")
    }

    if (!user) {
      return null
    }

    const fallbackIsTester = resolveTesterMetadata(user.user_metadata ?? null)
    const preferredOrgId = await readActiveOrganizationCookie()
    const [profileAudience, activeOrg] = await Promise.all([
      resolveProfileAudience({
        supabase,
        userId: user.id,
        fallbackIsTester,
      }),
      resolveActiveOrganization(supabase, user.id, {
        preferredOrgId,
      }),
    ])

    return {
      supabase,
      user,
      profileAudience,
      activeOrg,
    }
  },
)

export async function resolveOptionalAuthenticatedAppContext() {
  return resolveOptionalAuthenticatedAppContextCached()
}

export async function resolveAuthenticatedAppContext() {
  const context = await resolveOptionalAuthenticatedAppContextCached()
  if (!context) {
    throw new Error("Not authenticated.")
  }
  return context
}
