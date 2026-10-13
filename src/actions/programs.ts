/* eslint-disable @typescript-eslint/no-explicit-any */
"use server"

import { revalidatePath, revalidateTag } from "next/cache"
import { requireServerSession } from "@/lib/auth"
import { publicSharingEnabled } from "@/lib/feature-flags"
import {
  resolveProfileAudience,
  resolveTesterMetadata,
} from "@/lib/devtools/audience"
import {
  PROGRAM_MEDIA_BUCKET,
  resolveProgramMediaCleanupPath,
} from "@/lib/storage/program-media"
import {
  canEditOrganization,
  resolveActiveOrganization,
} from "@/lib/organization/active-org"
import { resolveProgramBannerImageUrl } from "@/lib/programs/display"
import { resolveStaffProgramAccess } from "@/lib/programs/staff-access"
import { mergeProgramWizardSnapshot } from "@/lib/programs/wizard-snapshot"

export type CreateProgramPayload = {
  title: string
  subtitle?: string | null
  description?: string | null
  location?: string | null
  locationType?: "in_person" | "online" | null
  locationUrl?: string | null
  teamIds?: string[] | null
  addressStreet?: string | null
  addressCity?: string | null
  addressState?: string | null
  addressPostal?: string | null
  addressCountry?: string | null
  imageUrl?: string | null
  duration?: string | null
  startDate?: string | null
  endDate?: string | null
  features?: string[] | null
  statusLabel?: string | null
  goalCents?: number | null
  raisedCents?: number | null
  isPublic?: boolean | null
  ctaLabel?: string | null
  ctaUrl?: string | null
  wizardSnapshot?: Record<string, unknown> | null
}

export async function createProgramAction(payload: CreateProgramPayload) {
  const { supabase, session } = await requireServerSession("/organization")
  const userId = session.user.id
  const [{ orgId, role }, profileAudience] = await Promise.all([
    resolveActiveOrganization(supabase, userId),
    resolveProfileAudience({
      supabase,
      userId,
      fallbackIsTester: resolveTesterMetadata(
        session.user.user_metadata ?? null
      ),
    }),
  ])
  const canEdit = profileAudience.isAdmin || canEditOrganization(role)
  if (!canEdit) return { error: "Forbidden" }
  const allowPublicSharing = publicSharingEnabled
  if (payload.isPublic === true && !allowPublicSharing) {
    return { error: "Public sharing is not available yet. Your activity visibility has not changed." }
  }
  const wizardSnapshotResult = mergeProgramWizardSnapshot({
    existing: null,
    incoming: payload.wizardSnapshot ?? {},
  })
  if (!wizardSnapshotResult.success) {
    return {
      error: wizardSnapshotResult.error,
      field: wizardSnapshotResult.field,
    }
  }

  const insert = {
    user_id: orgId,
    title: payload.title,
    subtitle: payload.subtitle ?? null,
    description: payload.description ?? null,
    location: payload.location ?? null,
    location_type: payload.locationType ?? "in_person",
    location_url: payload.locationUrl ?? null,
    team_ids: payload.teamIds ?? [],
    address_street: payload.addressStreet ?? null,
    address_city: payload.addressCity ?? null,
    address_state: payload.addressState ?? null,
    address_postal: payload.addressPostal ?? null,
    address_country: payload.addressCountry ?? null,
    image_url: payload.imageUrl ?? null,
    duration_label: payload.duration ?? null,
    start_date: payload.startDate
      ? (new Date(payload.startDate).toISOString() as unknown as any)
      : null,
    end_date: payload.endDate
      ? (new Date(payload.endDate).toISOString() as unknown as any)
      : null,
    features: payload.features ?? [],
    status_label: payload.statusLabel ?? null,
    goal_cents: payload.goalCents ?? 0,
    raised_cents: payload.raisedCents ?? 0,
    is_public: allowPublicSharing ? Boolean(payload.isPublic ?? false) : false,
    cta_label: payload.ctaLabel ?? null,
    cta_url: payload.ctaUrl ?? null,
    wizard_snapshot: wizardSnapshotResult.snapshot,
  }

  let { error } = await (supabase as any).from("programs").insert(insert)
  if (error && /wizard_snapshot/i.test(error.message)) {
    const legacyInsert = { ...insert }
    delete (legacyInsert as { wizard_snapshot?: unknown }).wizard_snapshot
    const retry = await (supabase as any).from("programs").insert(legacyInsert)
    error = retry.error
  }
  if (error) return { error: error.message }
  await revalidateOrganizationProgramViews(supabase, orgId)
  return { ok: true }
}

export type UpdateProgramPayload = Partial<CreateProgramPayload>

export async function updateProgramAction(
  id: string,
  payload: UpdateProgramPayload,
  organizationId?: string
) {
  const { supabase: sessionSupabase, session } = await requireServerSession("/organization")
  const userId = session.user.id
  const profileAudience = await resolveProfileAudience({
    supabase: sessionSupabase, userId,
    fallbackIsTester: resolveTesterMetadata(session.user.user_metadata ?? null),
  })
  const staffAccess = organizationId !== undefined
    ? await resolveStaffProgramAccess({ organizationId, userId, accessLevel: profileAudience.platformAccessLevel })
    : null
  if (staffAccess && "error" in staffAccess) return staffAccess
  const activeOrg = staffAccess ? null : await resolveActiveOrganization(sessionSupabase, userId)
  if (!staffAccess && !profileAudience.isAdmin && (!activeOrg || !canEditOrganization(activeOrg.role))) {
    return { error: "Forbidden" }
  }
  const orgId = staffAccess?.orgId ?? activeOrg!.orgId
  const supabase = staffAccess?.supabase ?? sessionSupabase
  const allowPublicSharing = publicSharingEnabled
  if (payload.isPublic === true && !allowPublicSharing) {
    return { error: "Public sharing is not available yet. Your activity visibility has not changed." }
  }
  const imageTouched = Object.prototype.hasOwnProperty.call(payload, "imageUrl")
  const hasKey = (key: keyof UpdateProgramPayload) =>
    Object.prototype.hasOwnProperty.call(payload, key)
  const pick = <K extends keyof UpdateProgramPayload>(
    key: K
  ): UpdateProgramPayload[K] | undefined =>
    hasKey(key) ? payload[key] : undefined

  let previousImageUrl: string | null = null
  let previousBannerImageUrl: string | null = null
  let expectedUpdatedAt: string | null = null
  let nextWizardSnapshot: Record<string, unknown> | undefined
  if (imageTouched || hasKey("wizardSnapshot")) {
    const { data: existing, error: existingError } = await (supabase as any)
      .from("programs")
      .select("image_url, wizard_snapshot, updated_at")
      .eq("id", id)
      .eq("user_id", orgId)
      .maybeSingle()

    if (existingError) return { error: existingError.message }
    const existingRow = existing as {
      image_url?: string | null
      wizard_snapshot?: Record<string, unknown> | null
      updated_at?: string | null
    } | null
    if (!existingRow) return { error: "Activity not found or no longer editable." }
    previousImageUrl = existingRow.image_url ?? null
    expectedUpdatedAt = existingRow?.updated_at ?? null
    previousBannerImageUrl = existingRow
      ? resolveProgramBannerImageUrl(existingRow)
      : null

    if (hasKey("wizardSnapshot")) {
      const wizardSnapshotResult = mergeProgramWizardSnapshot({
        existing: existingRow?.wizard_snapshot,
        incoming: payload.wizardSnapshot,
      })
      if (!wizardSnapshotResult.success) {
        return {
          error: wizardSnapshotResult.error,
          field: wizardSnapshotResult.field,
        }
      }
      nextWizardSnapshot = wizardSnapshotResult.snapshot
    }
  }

  const startDate = pick("startDate")
  const endDate = pick("endDate")
  const isPublic = pick("isPublic")

  const update = {
    title: pick("title"),
    subtitle: pick("subtitle"),
    description: pick("description"),
    location: pick("location"),
    location_type: pick("locationType") ?? undefined,
    location_url: pick("locationUrl"),
    team_ids: pick("teamIds") ?? undefined,
    address_street: pick("addressStreet"),
    address_city: pick("addressCity"),
    address_state: pick("addressState"),
    address_postal: pick("addressPostal"),
    address_country: pick("addressCountry"),
    image_url:
      payload.imageUrl === null ? null : (payload.imageUrl ?? undefined),
    duration_label: pick("duration"),
    start_date:
      startDate === undefined
        ? undefined
        : startDate
          ? (new Date(startDate).toISOString() as unknown as any)
          : null,
    end_date:
      endDate === undefined
        ? undefined
        : endDate
          ? (new Date(endDate).toISOString() as unknown as any)
          : null,
    features: pick("features"),
    status_label: pick("statusLabel"),
    goal_cents: pick("goalCents"),
    raised_cents: pick("raisedCents"),
    is_public:
      isPublic === undefined
        ? undefined
        : allowPublicSharing
          ? Boolean(isPublic)
          : false,
    cta_label: pick("ctaLabel"),
    cta_url: pick("ctaUrl"),
    wizard_snapshot: hasKey("wizardSnapshot")
      ? (nextWizardSnapshot ?? {})
      : undefined,
  }

  const executeUpdate = async (values: Record<string, unknown>) => {
    let query = (supabase as any)
      .from("programs")
      .update(values)
      .eq("id", id)
      .eq("user_id", orgId)
    if (expectedUpdatedAt) {
      query = query.eq("updated_at", expectedUpdatedAt)
    }
    return query.select("id").maybeSingle()
  }

  let { data: updatedProgram, error } = await executeUpdate(update)

  if (error && /wizard_snapshot/i.test(error.message)) {
    const legacyUpdate = { ...update }
    delete (legacyUpdate as { wizard_snapshot?: unknown }).wizard_snapshot
    const retry = await executeUpdate(legacyUpdate)
    updatedProgram = retry.data
    error = retry.error
  }

  if (error) return { error: error.message }
  if (!updatedProgram) {
    return {
      error: expectedUpdatedAt
        ? "This activity was updated elsewhere. Reload before saving."
        : "Activity not found or no longer editable.",
      conflict: Boolean(expectedUpdatedAt),
    }
  }

  /*
   * Keep media cleanup after the guarded write. A conflicting request must not
   * delete assets that still belong to the winning program version.
   */
  if (imageTouched) {
    const cleanupPath = resolveProgramMediaCleanupPath({
      previousUrl: previousImageUrl,
      nextUrl: payload.imageUrl ?? null,
      userId: orgId,
    })
    if (cleanupPath) {
      await supabase.storage.from(PROGRAM_MEDIA_BUCKET).remove([cleanupPath])
    }
  }
  if (hasKey("wizardSnapshot")) {
    const cleanupPath = resolveProgramMediaCleanupPath({
      previousUrl: previousBannerImageUrl,
      nextUrl: resolveProgramBannerImageUrl({
        wizard_snapshot: nextWizardSnapshot ?? null,
      }),
      userId: orgId,
    })
    if (cleanupPath) {
      await supabase.storage.from(PROGRAM_MEDIA_BUCKET).remove([cleanupPath])
    }
  }
  await revalidateOrganizationProgramViews(supabase, orgId)
  return { ok: true }
}

async function revalidateOrganizationProgramViews(
  supabase: Awaited<ReturnType<typeof requireServerSession>>["supabase"],
  userId: string
) {
  // Visibility changes must expire public projections, including withdrawals.
  revalidateTag("public-map-organizations", { expire: 0 })
  revalidateTag("public-profiles", { expire: 0 })
  revalidatePath("/organizations")
  revalidatePath("/organizations/[id]", "page")
  revalidatePath("/organization")
  revalidatePath("/workspace")
  revalidatePath("/organization/workspace")
  revalidatePath("/map")
  revalidatePath("/resources")
  try {
    const { data, error } = await supabase
      .from("organizations")
      .select("public_slug, is_public")
      .eq("user_id", userId)
      .maybeSingle<{ public_slug: string | null; is_public: boolean | null }>()

    if (error) return

    const slug =
      typeof data?.public_slug === "string" && data.public_slug.length > 0
        ? data.public_slug
        : null
    const isPublic = Boolean(data?.is_public)

    if (isPublic) revalidatePath("/community")
    if (slug) {
      revalidatePath(`/${slug}`)
      revalidatePath(`/${slug}`)
    }
  } catch {
    // Swallow revalidation errors; they should not block program writes.
  }
}
