import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { loadCoachingClientName } from "./coaching-client-name"

type CalendarDownloadBooking = {
  id: string
  user_id: string
  starts_at: string
  ends_at: string
  timezone: string
  attendee_notes: string | null
  google_meet_url: string | null
  google_event_html_link: string | null
}

/** Resolve identity only after the caller's booking SELECT passes its existing RLS. */
export async function loadCoachingCalendarDownload({
  supabase, bookingId, viewerUserId,
}: {
  supabase: SupabaseClient<Database>
  bookingId: string
  viewerUserId: string
}) {
  const { data: booking, error } = await supabase
    .from("coaching_bookings")
    .select("id, user_id, starts_at, ends_at, timezone, attendee_notes, google_meet_url, google_event_html_link")
    .eq("id", bookingId)
    .maybeSingle<CalendarDownloadBooking>()
  if (error || !booking) return { data: null, error }

  try {
    // Profiles permit self/admin reads; eligible organization members need a scoped
    // server lookup of the authorized booking owner rather than a hidden profile row.
    const identityClient = booking.user_id === viewerUserId ? supabase : createSupabaseAdminClient()
    const clientName = await loadCoachingClientName({ supabase: identityClient, userId: booking.user_id })
    return { data: { booking, clientName }, error: null }
  } catch {
    return { data: null, error: new Error("Unable to load coaching client name.") }
  }
}
