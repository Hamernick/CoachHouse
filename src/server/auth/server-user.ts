import { cache } from "react"
import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase/types"

// React scopes this snapshot to one server render, never across requests/users.
// Keep the full verified response so callers retain their existing error policy.
// Outside RSC (including route handlers), React calls through without caching.
export const getServerUser = cache((supabase: SupabaseClient<Database>) =>
  supabase.auth.getUser()
)
