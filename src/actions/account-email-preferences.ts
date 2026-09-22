"use server"

import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

export async function loadAccountEmailPreferencesAction() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user?.email)
    throw new Error("Sign in to load email preferences.")
  const admin = createSupabaseAdminClient()
  const address = user.email.trim().toLowerCase()
  const [preferences, suppressions] = await Promise.all([
    admin
      .from("platform_email_preferences")
      .select("topic_id, status")
      .eq("email", address)
      .in("topic_id", ["product_updates", "newsletter"]),
    admin.from("platform_email_suppressions").select("id").eq("email", address),
  ])
  if (preferences.error || suppressions.error)
    throw new Error("Unable to load email preferences. Try again.")
  const blocked = Boolean(suppressions.data?.length)
  const enabled = (topic: string, key: string) =>
    !blocked &&
    (preferences.data?.find((row) => row.topic_id === topic)?.status ===
      "subscribed" ||
      (!preferences.data?.some((row) => row.topic_id === topic) &&
        user.user_metadata[key] === true))
  return {
    marketingOptIn: enabled("product_updates", "marketing_opt_in"),
    newsletterOptIn: enabled("newsletter", "newsletter_opt_in"),
    blocked,
  }
}

export async function saveAccountEmailPreferencesAction(input: {
  marketingOptIn: boolean | null
  newsletterOptIn: boolean | null
}) {
  if (
    ![input?.marketingOptIn, input?.newsletterOptIn].every(
      (value) => value === null || typeof value === "boolean"
    )
  ) {
    return { ok: false as const, error: "Choose valid email preferences." }
  }
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc("save_account_email_preferences", {
    p_marketing_opt_in: input.marketingOptIn,
    p_newsletter_opt_in: input.newsletterOptIn,
  })
  if (
    error ||
    !data ||
    typeof data !== "object" ||
    !("ok" in data) ||
    data.ok !== true
  ) {
    return {
      ok: false as const,
      error:
        data &&
        typeof data === "object" &&
        "error" in data &&
        typeof data.error === "string"
          ? data.error
          : "Unable to save email preferences. Try again.",
    }
  }
  return { ok: true as const }
}
