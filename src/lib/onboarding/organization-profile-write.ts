import type { SupabaseClient } from "@supabase/supabase-js"

import { commitPeopleProfileMutation } from "@/lib/people/profile-write"
import type { Database, Json } from "@/lib/supabase"

export const ONBOARDING_ORGANIZATION_SLUG_TAKEN = "That organization URL is already taken or reserved."

function isPublicSlugConflict(error: { code?: string; message: string } | null) {
  return error?.code === "23505" && (
    error.message === "Public handle is already taken." ||
    error.message === "Public handle is reserved." ||
    error.message.includes("uniq_organizations_public_slug_lower")
  )
}

type OnboardingOrganizationProfileInput = {
  avatarUrl: string | null
  formationStatus: "pre_501c3" | "in_progress" | "approved" | null
  fullName: string
  intentFocus: "build" | "find" | "fund" | "support"
  linkedin: string
  normalizedSlug: string
  orgName: string
  publicEmail: string
  roleInterest: "staff" | "operator" | "volunteer" | "board_member" | null
  targetOrgId: string
  title: string
  user: { id: string; email?: string | null }
}

export async function writeOnboardingOrganizationProfile({
  avatarUrl,
  formationStatus,
  fullName,
  intentFocus,
  linkedin,
  normalizedSlug,
  orgName,
  publicEmail,
  roleInterest,
  supabase,
  targetOrgId,
  title,
  user,
}: OnboardingOrganizationProfileInput & {
  supabase: SupabaseClient<Database>
}): Promise<{ ok: true } | { error: string }> {
  const result = await commitPeopleProfileMutation({
    readSnapshot: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("profile, updated_at")
        .eq("user_id", targetOrgId)
        .maybeSingle<{
          profile: Record<string, unknown> | null
          updated_at: string
        }>()
      if (error) return { error: error.message }
      return {
        snapshot: {
          exists: Boolean(data),
          profile: data?.profile ?? {},
          revision: data?.updated_at ?? null,
        },
      }
    },
    applyMutation: (currentProfile) => {
      const existingPeople = Array.isArray(currentProfile.org_people)
        ? (currentProfile.org_people as Array<Record<string, unknown>>)
        : []
      const existingOwner = existingPeople.find(
        (person) => person?.id === user.id
      )
      const nextOwnerPerson = {
        ...existingOwner,
        id: user.id,
        name: fullName || user.email || "You",
        title: title.length > 0 ? title : null,
        email: publicEmail.length > 0 ? publicEmail : null,
        linkedin:
          linkedin.length > 0
            ? linkedin
            : typeof existingOwner?.linkedin === "string"
              ? existingOwner.linkedin
              : null,
        category: "staff",
        image:
          avatarUrl ??
          (typeof existingOwner?.image === "string"
            ? existingOwner.image
            : null),
        reportsToId: existingOwner?.reportsToId ?? null,
        pos: existingOwner?.pos ?? null,
      }
      const ownerEmail = (nextOwnerPerson.email ?? "").toLowerCase()
      const nextPeople = [
        nextOwnerPerson,
        ...existingPeople.filter((person) => {
          const personId = typeof person?.id === "string" ? person.id : null
          if (personId === user.id) return false
          const personEmail =
            typeof person?.email === "string"
              ? person.email.toLowerCase()
              : null
          return !(personEmail && ownerEmail && personEmail === ownerEmail)
        }),
      ]
      return {
        ok: true,
        changed: true,
        nextProfile: {
          ...currentProfile,
          name: orgName,
          ...(formationStatus ? { formationStatus } : {}),
          ...(linkedin.length > 0 ? { linkedin } : {}),
          ...(avatarUrl &&
          (typeof currentProfile.logoUrl !== "string" ||
            currentProfile.logoUrl.trim().length === 0)
            ? { logoUrl: avatarUrl }
            : {}),
          onboarding_intent_focus: intentFocus,
          ...(roleInterest ? { onboarding_role_interest: roleInterest } : {}),
          org_people: nextPeople,
        },
        value: null,
      }
    },
    writeSnapshot: async (snapshot, nextProfile) => {
      const profile = nextProfile as Json
      if (!snapshot.exists) {
        const { data, error } = await supabase
          .from("organizations")
          .insert({
            user_id: targetOrgId,
            public_slug: normalizedSlug,
            profile,
          })
          .select("updated_at")
          .maybeSingle<{ updated_at: string }>()
        if (isPublicSlugConflict(error)) return { status: "error", error: ONBOARDING_ORGANIZATION_SLUG_TAKEN }
        if (error?.code === "23505") return { status: "conflict" }
        if (error) return { status: "error", error: error.message }
        return data ? { status: "written" } : { status: "conflict" }
      }

      if (!snapshot.revision) return { status: "conflict" }
      const { data, error } = await supabase
        .from("organizations")
        .update({ public_slug: normalizedSlug, profile })
        .eq("user_id", targetOrgId)
        .eq("updated_at", snapshot.revision)
        .select("updated_at")
        .maybeSingle<{ updated_at: string }>()
      if (isPublicSlugConflict(error)) return { status: "error", error: ONBOARDING_ORGANIZATION_SLUG_TAKEN }
      if (error) return { status: "error", error: error.message }
      return data ? { status: "written" } : { status: "conflict" }
    },
  })

  return "error" in result ? result : { ok: true }
}
