"use server"

import { redirect } from "next/navigation"

import { validatePublicHandle } from "@/features/public-profiles"
import { fetchLearningEntitlements } from "@/lib/accelerator/entitlements"
import { markOrganizationSetupModuleCompleted } from "@/lib/accelerator/organization-setup"
import { writeOnboardingOrganizationProfile } from "@/lib/onboarding/organization-profile-write"
import { normalizeOrganizationFormationStatus } from "@/lib/onboarding/requirements"
import { organizationProfileNameSchema } from "@/lib/organization/profile-persistence-validation"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { isSupabaseAuthSessionMissingError } from "@/lib/supabase/auth-errors"
import { supabaseErrorToError } from "@/lib/supabase/errors"
import { trackUserJourneyMilestone } from "@/lib/user-journey"
import {
  type ActiveOrganization,
  canEditOrganization,
  resolveActiveOrganization,
} from "@/lib/organization/active-org"
import { RESERVED_PUBLIC_ORGANIZATION_SLUGS } from "@/lib/organization/reserved-public-slugs"
import type { ProfilesTable } from "@/lib/supabase/schema/tables"
import { uploadAvatarWithUser } from "@/lib/storage/avatars"

function buildOnboardingErrorRedirect({
  error,
  slug,
}: {
  intentFocus: "build" | "find" | "fund" | "support" | null
  error: string
  slug?: string
}) {
  const params = new URLSearchParams({ error })
  if (slug) {
    params.set("slug", slug)
  }
  return `/onboarding?${params.toString()}`
}

function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\\s-]/g, "")
    .trim()
    .replace(/\\s+/g, "-")
    .replace(/-+/g, "-")
  return base.slice(0, 60).replace(/^-+|-+$/g, "")
}

function workspaceOnboardingMetadata({
  preserveCompleted,
  intentFocus,
  accessSelectionOnly,
  updatedAt,
}: {
  preserveCompleted: boolean
  intentFocus: string | null
  accessSelectionOnly: boolean
  updatedAt: string
}) {
  if (preserveCompleted || intentFocus !== "build") return {}
  return {
    workspace_onboarding_stage: 2,
    workspace_onboarding_active: !accessSelectionOnly,
    workspace_onboarding_started_at: accessSelectionOnly ? null : updatedAt,
    workspace_onboarding_completed_at: null,
  }
}

export async function completeOnboardingAction(form: FormData) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()
  if (userError && !isSupabaseAuthSessionMissingError(userError)) {
    throw supabaseErrorToError(userError, "Unable to load user.")
  }
  if (!user) redirect("/login?redirect=/onboarding")

  const first = String(form.get("firstName") || "").trim()
  const last = String(form.get("lastName") || "").trim()
  const phone = String(form.get("phone") || "").trim()
  const publicEmail = String(form.get("publicEmail") || "").trim()
  const title = String(form.get("title") || "").trim()
  const linkedin = String(form.get("linkedin") || "").trim()
  const marketingOptIn = form.has("optInUpdates")
  const newsletterOptIn = form.has("newsletterOptIn")
  const intentFocusRaw = String(form.get("intentFocus") || "").trim()
  const roleInterestRaw = String(form.get("roleInterest") || "").trim()
  const intentFocus =
    intentFocusRaw === "build" ||
    intentFocusRaw === "find" ||
    intentFocusRaw === "fund" ||
    intentFocusRaw === "support"
      ? intentFocusRaw
      : null
  const roleInterest =
    roleInterestRaw === "staff" ||
    roleInterestRaw === "operator" ||
    roleInterestRaw === "volunteer" ||
    roleInterestRaw === "board_member"
      ? roleInterestRaw
      : null
  const onboardingModeRaw = String(form.get("onboardingMode") || "").trim()
  const onboardingMode =
    onboardingModeRaw === "post_signup_access" ||
    onboardingModeRaw === "workspace_setup"
      ? onboardingModeRaw
      : "full"
  const builderPlanTierRaw = String(form.get("builderPlanTier") || "").trim()
  const builderPlanTier =
    builderPlanTierRaw === "organization" ||
    builderPlanTierRaw === "operations_support"
      ? builderPlanTierRaw
      : "free"
  const profileSetup = onboardingMode === "post_signup_access" && intentFocus === "build" && form.get("onboardingVersion") === "workspace_profile"
  const builderAccessSelectionOnly =
    intentFocus === "build" && onboardingMode === "post_signup_access" && !profileSetup
  const personHandleRaw = String(form.get("personHandle") || "").trim()
  const personHandleValidation = validatePublicHandle(personHandleRaw)

  const formationStatus = normalizeOrganizationFormationStatus(String(form.get("formationStatus") || "").trim())

  const orgName = String(form.get("orgName") || "").trim()
  const orgSlugRaw = String(form.get("orgSlug") || "").trim()
  const normalizedSlug = slugify(orgSlugRaw || orgName)

  if (!intentFocus) {
    redirect(
      buildOnboardingErrorRedirect({
        intentFocus,
        error: "missing_intent_focus",
      })
    )
  }

  const requiresOrganizationSetup =
    intentFocus === "build" &&
    (onboardingMode !== "post_signup_access" ||
      profileSetup || Boolean(orgName || orgSlugRaw || formationStatus))
  let organizationTarget: ActiveOrganization = { orgId: user.id, role: "owner" }
  if (requiresOrganizationSetup && onboardingMode === "workspace_setup") {
    organizationTarget = await resolveActiveOrganization(supabase, user.id)
    if (!canEditOrganization(organizationTarget.role)) {
      redirect(
        buildOnboardingErrorRedirect({
          intentFocus,
          error: "organization_access_required",
        })
      )
    }
  }
  const targetOrgId = organizationTarget.orgId

  if (intentFocus === "build") {
    if (builderPlanTier !== "free" && !profileSetup) {
      const entitlements = await fetchLearningEntitlements({
        supabase,
        userId: user.id,
        forceStripeSync: onboardingMode === "post_signup_access",
      })
      if (!entitlements.hasActiveSubscription) {
        redirect(
          buildOnboardingErrorRedirect({
            intentFocus,
            error: "builder_plan_required",
          })
        )
      }
    }

    if (requiresOrganizationSetup) {
      if (!formationStatus && !profileSetup) {
        redirect(buildOnboardingErrorRedirect({ intentFocus, error: "missing_formation_status" }))
      }
      if (!organizationProfileNameSchema.safeParse(orgName).success) {
        redirect(
          buildOnboardingErrorRedirect({
            intentFocus,
            error: orgName ? "invalid_org_name" : "missing_org_name",
          })
        )
      }
      if (!normalizedSlug) {
        redirect(
          buildOnboardingErrorRedirect({
            intentFocus,
            error: "missing_org_slug",
          })
        )
      }
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalizedSlug)) {
        redirect(
          buildOnboardingErrorRedirect({
            intentFocus,
            error: "invalid_org_slug",
            slug: normalizedSlug,
          })
        )
      }
      if (RESERVED_PUBLIC_ORGANIZATION_SLUGS.has(normalizedSlug)) {
        redirect(
          buildOnboardingErrorRedirect({
            intentFocus,
            error: "reserved_org_slug",
            slug: normalizedSlug,
          })
        )
      }

      const { count: slugCount, error: slugError } = await supabase
        .from("organizations")
        .select("user_id", { count: "exact", head: true })
        .ilike("public_slug", normalizedSlug)
        .neq("user_id", targetOrgId)

      if (slugError)
        throw supabaseErrorToError(
          slugError,
          "Unable to validate organization URL."
        )
      if ((slugCount ?? 0) > 0) {
        redirect(
          buildOnboardingErrorRedirect({
            intentFocus,
            error: "slug_taken",
            slug: normalizedSlug,
          })
        )
      }
    }
  }

  if (!builderAccessSelectionOnly && !personHandleValidation.valid) {
    redirect(
      buildOnboardingErrorRedirect({
        intentFocus,
        error:
          personHandleValidation.code === "reserved"
            ? "reserved_person_handle"
            : personHandleRaw
              ? "invalid_person_handle"
              : "missing_person_handle",
      })
    )
  }

  let avatarUrl: string | null = null
  const avatar = form.get("avatar")
  if (avatar instanceof File && avatar.size > 0) {
    avatarUrl = await uploadAvatarWithUser({
      client: supabase,
      userId: user.id,
      file: avatar,
    })
  }

  const fullName = [first, last].filter(Boolean).join(" ").trim()

  const profilePayload: ProfilesTable["Insert"] = { id: user.id }
  if (fullName.length > 0) profilePayload.full_name = fullName
  if (avatarUrl) profilePayload.avatar_url = avatarUrl
  if (title.length > 0) profilePayload.headline = title
  if (user.email) profilePayload.email = user.email

  const { error: profileUpsertError } = await supabase
    .from("profiles")
    .upsert(profilePayload, { onConflict: "id" })

  if (profileUpsertError) {
    console.error("completeOnboardingAction: profile upsert failed", {
      userId: user.id,
      message: profileUpsertError.message,
    })
    throw supabaseErrorToError(
      profileUpsertError,
      "Unable to save your profile."
    )
  }

  if (!builderAccessSelectionOnly && personHandleValidation.valid) {
    const { data: handleClaimData, error: handleClaimError } =
      await supabase.rpc("claim_person_public_handle", {
        p_handle: personHandleValidation.handle,
      })

    if (handleClaimError) {
      console.error("completeOnboardingAction: handle claim failed", {
        userId: user.id,
        message: handleClaimError.message,
      })
      throw supabaseErrorToError(
        handleClaimError,
        "Unable to save your username."
      )
    }

    const handleClaim =
      handleClaimData &&
      typeof handleClaimData === "object" &&
      !Array.isArray(handleClaimData)
        ? (handleClaimData as Record<string, unknown>)
        : null
    if (handleClaim?.ok !== true) {
      redirect(
        buildOnboardingErrorRedirect({
          intentFocus,
          error:
            handleClaim?.code === "reserved"
              ? "reserved_person_handle"
              : handleClaim?.code === "invalid"
                ? "invalid_person_handle"
                : "person_handle_taken",
        })
      )
    }
  }

  if (requiresOrganizationSetup) {
    const organizationWrite = await writeOnboardingOrganizationProfile({
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
    })

    if ("error" in organizationWrite) {
      console.error("completeOnboardingAction: organization upsert failed", {
        userId: user.id,
        message: organizationWrite.error,
      })
      throw supabaseErrorToError(
        { message: organizationWrite.error },
        "Unable to save your organization."
      )
    }
  }

  const onboardingUpdatedAt = new Date().toISOString()
  const preserveCompletedWorkspaceOnboarding =
    onboardingMode === "workspace_setup" &&
    Boolean(user.user_metadata?.workspace_onboarding_completed_at)

  // Workspace basics may be saved during access selection; account setup still follows.
  const { error: updateUserError } = await supabase.auth.updateUser({
    data: {
      onboarding_completed: !builderAccessSelectionOnly,
      onboarding_completed_at: builderAccessSelectionOnly
        ? null
        : onboardingUpdatedAt,
      full_name: fullName || null,
      first_name: first || null,
      last_name: last || null,
      marketing_opt_in: marketingOptIn,
      newsletter_opt_in: newsletterOptIn,
      phone: phone.length > 0 ? phone : null,
      ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
      onboarding_intent_focus: intentFocus,
      onboarding_role_interest: roleInterest,
      ...workspaceOnboardingMetadata({
        preserveCompleted: preserveCompletedWorkspaceOnboarding,
        intentFocus,
        accessSelectionOnly: builderAccessSelectionOnly,
        updatedAt: onboardingUpdatedAt,
      }),
    },
  })

  if (updateUserError) {
    console.error("completeOnboardingAction: auth metadata update failed", {
      userId: user.id,
      message: updateUserError.message,
    })
    throw supabaseErrorToError(updateUserError, "Unable to finish onboarding.")
  }

  if (requiresOrganizationSetup && !builderAccessSelectionOnly && !profileSetup) {
    await markOrganizationSetupModuleCompleted({
      supabase,
      userId: user.id,
    })
  }

  if (intentFocus === "build") {
    await trackUserJourneyMilestone({
      userId: user.id,
      orgId: targetOrgId,
      eventName: builderAccessSelectionOnly
        ? "workspace_onboarding_started"
        : "onboarding_completed",
      journey: "builder_onboarding",
      source: "onboarding_action",
      surface: "onboarding",
      planTier: builderPlanTier,
      checkpoint: builderAccessSelectionOnly
        ? "workspace_onboarding_started"
        : "account_onboarding_completed",
      metadata: {
        intentFocus,
        onboardingMode,
        builderPlanTier,
        hasOrganizationSetup: requiresOrganizationSetup,
        formationStatus,
        roleInterest,
      },
    })
    if (builderAccessSelectionOnly) {
      redirect("/workspace?source=onboarding_setup")
    }
    redirect(
      preserveCompletedWorkspaceOnboarding
        ? "/workspace?source=organization_setup"
        : "/workspace?onboarding_flow=1&onboarding_stage=2&source=onboarding"
    )
  }

  await trackUserJourneyMilestone({
    userId: user.id,
    orgId: user.id,
    eventName: "member_onboarding_completed",
    journey: "member_onboarding",
    source: "onboarding_action",
    surface: "workspace_onboarding",
    checkpoint: "member_onboarding_completed",
    metadata: {
      intentFocus,
      onboardingMode,
      roleInterest,
    },
  })

  redirect("/workspace?member_onboarding=0&source=member_onboarding")
}
