"use server"

import { revalidateTag } from "next/cache"
import { z } from "zod"
import { createSupabaseServerClient } from "@/lib/supabase/server"

const detailsSchema = z.object({
  bio: z.string().trim().max(500),
  location: z.string().trim().max(120),
  website: z.union([
    z.literal(""),
    z
      .string()
      .trim()
      .max(500)
      .url()
      .refine((value) => /^https?:\/\//.test(value)),
  ]),
})

function resultError(data: unknown, fallback: string) {
  if (data && typeof data === "object" && "ok" in data && data.ok === true)
    return null
  return data &&
    typeof data === "object" &&
    "error" in data &&
    typeof data.error === "string"
    ? data.error
    : fallback
}

export async function refreshPublicProfileAction() {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) throw new Error("Sign in to update your profile.")
  revalidateTag("public-profiles", { expire: 0 })
}

export async function setPublicProfileVisibilityAction(isPublic: boolean) {
  if (typeof isPublic !== "boolean")
    return { ok: false as const, error: "Choose a valid visibility setting." }
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc(
    "set_person_public_profile_visibility",
    { p_is_public: isPublic }
  )
  const message = error
    ? "Unable to update visibility. Try again."
    : resultError(data, "Choose a username before publishing.")
  if (message) return { ok: false as const, error: message }
  revalidateTag("public-profiles", { expire: 0 })
  return { ok: true as const }
}

export async function savePublicProfileDetailsAction(
  input: z.infer<typeof detailsSchema>
) {
  const parsed = detailsSchema.safeParse(input)
  if (!parsed.success)
    return {
      ok: false as const,
      error:
        "Check your public bio, location, and website. Use an http or https website address.",
    }
  const { bio, location, website } = parsed.data
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc(
    "save_person_public_profile_details",
    {
      p_bio: bio || null,
      p_location_label: location || null,
      p_website_url: website || null,
    }
  )
  const message = error
    ? "Unable to save your public details. Try again."
    : resultError(data, "Claim a username before saving public details.")
  if (message) return { ok: false as const, error: message }
  revalidateTag("public-profiles", { expire: 0 })
  return { ok: true as const }
}
