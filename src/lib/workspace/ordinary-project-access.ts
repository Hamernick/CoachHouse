import "server-only"

import { z } from "zod"
import type { Database } from "@/lib/supabase"
import type { SupabaseClient } from "@supabase/supabase-js"

// General workspace tools must never treat the internal host organization as
// permission to read/edit a guest application. Its dedicated fiscal review
// surface authorizes reviewers separately. Ordinary authorization still applies.
export async function isOrdinaryWorkspaceProject({ supabase, userId, projectId }: {
  supabase: Pick<SupabaseClient<Database>, "rpc">
  userId: string
  projectId: string
}) {
  if (!z.string().uuid().safeParse(projectId).success) return false
  const result = await supabase.rpc("fiscal_guest_project_reviewer_access", {
    p_project_id: projectId, p_user_id: userId,
  })
  return !result.error && result.data === null
}
