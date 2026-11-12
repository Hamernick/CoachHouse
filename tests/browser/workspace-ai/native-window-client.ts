import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase"
export function createSupabaseBrowserClient() {
  return { auth: {
    getSession: async () => ({ data: { session: { user: { id: "00000000-0000-4000-8000-000000000003" } } }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
  } } as unknown as SupabaseClient<Database>
}
