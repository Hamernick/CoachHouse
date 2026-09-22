import { createSupabaseAdminClient } from "@/lib/supabase/admin"

export async function checkEmailDeliveryPreferences(
  recipients: string[],
  topicId: string
) {
  if (topicId === "transactional") return null
  const addresses = [
    ...new Set(recipients.map((email) => email.trim().toLowerCase())),
  ]
  const admin = createSupabaseAdminClient()
  const [suppressed, preferences] = await Promise.all([
    admin
      .from("platform_email_suppressions")
      .select("email")
      .in("email", addresses),
    admin
      .from("platform_email_preferences")
      .select("email, status")
      .eq("topic_id", topicId)
      .in("email", addresses),
  ])
  if (suppressed.error || preferences.error)
    return "Unable to verify email preferences. No email was sent."
  if (suppressed.data?.length)
    return "A recipient has email delivery disabled. No email was sent."
  if (
    addresses.some(
      (email) =>
        !preferences.data?.some(
          (row) => row.email === email && row.status === "subscribed"
        )
    )
  ) {
    return "A recipient has not subscribed to this email topic. No email was sent."
  }
  return null
}
