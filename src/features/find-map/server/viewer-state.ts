import { createSupabaseServerClient } from "@/lib/supabase/server"
import { getServerUser } from "@/server/auth/server-user"

export type PublicMapViewerState = {
  viewer: { id: string; email: string | null; displayName?: string | null; avatarUrl?: string | null } | null
}

export async function fetchPublicMapViewerState(): Promise<PublicMapViewerState> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await getServerUser(supabase)

  if (!user) {
    return {
      viewer: null,
    }
  }

  const metadata = user.user_metadata
  const metadataAvatar = [metadata?.avatar_url, metadata?.picture, metadata?.avatar]
    .find((value): value is string => typeof value === "string" && value.length > 0)

  return {
    viewer: {
      id: user.id,
      email: user.email ?? null,
      displayName: typeof metadata?.full_name === "string" ? metadata.full_name : null,
      avatarUrl: metadataAvatar ?? null,
    },
  }
}
