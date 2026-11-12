import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase"
import { readWorkspaceBoardForProjection } from "@/lib/organization/particle-board-read"
import { supabaseErrorToError } from "@/lib/supabase/errors"
import { readWorkspaceBoardStateValue } from "./workspace-state"

/** The entitled Accelerator route needs only its progress, never Particle or
 * catalog content. This read-only seed must not become a board save snapshot. */
export async function readWorkspaceAcceleratorBoardState(
  supabase: SupabaseClient<Database>, orgId: string, actorId: string,
) {
  const result = await readWorkspaceBoardForProjection(supabase, orgId, actorId)
  if (result.error && result.error.code !== "42P01" && result.error.code !== "PGRST205") {
    throw supabaseErrorToError(result.error, "Unable to load workspace board state.")
  }
  const state = result.data?.state
  const accelerator = state && typeof state === "object" && !Array.isArray(state)
    ? state.accelerator : undefined
  // Whitelist before normalization: its forward-compatible graph preservation
  // is appropriate on the canvas, but would disclose unrelated content here.
  return readWorkspaceBoardStateValue(state ? { accelerator } : undefined)
}
