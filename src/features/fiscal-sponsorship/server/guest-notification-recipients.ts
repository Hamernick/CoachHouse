import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase"

// null means an ordinary project. Failures mean no recipients, never host fallback.
export async function loadGuestNotificationRecipients(
  supabase: Pick<SupabaseClient<Database, "public">, "rpc">,
  projectId: string,
  excludeUserId?: string | null,
): Promise<string[] | null> {
  const { data, error } = await supabase.rpc("get_fiscal_guest_notification_recipients", {
    p_project_id: projectId,
  })
  if (error) return []
  if (data === null) return null
  if (!Array.isArray(data) || data.some((id) => typeof id !== "string")) return []
  return (data as string[]).filter((id) => id !== excludeUserId)
}
