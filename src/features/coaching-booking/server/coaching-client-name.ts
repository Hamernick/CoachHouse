import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase"
import { supabaseErrorToError } from "@/lib/supabase/errors"
import { normalizeCoachingClientName } from "../lib/calendar-title"

export async function loadCoachingClientName({
  supabase, userId,
}: { supabase: SupabaseClient<Database>; userId: string }) {
  const { data, error } = await supabase.from("profiles")
    .select("full_name").eq("id", userId).maybeSingle<{ full_name: string | null }>()
  if (error) throw supabaseErrorToError(error, "Unable to load coaching client name.")
  return normalizeCoachingClientName(data?.full_name)
}
