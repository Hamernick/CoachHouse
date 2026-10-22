"use server"

import { revalidatePath, revalidateTag } from "next/cache"

import { requireOrganizationDocumentStorage, resolveOrganizationDocumentStorageAccess, DOCUMENT_STORAGE_UPGRADE_MESSAGE } from "@/lib/organization/document-storage-access"

import { resolveOrganizationDocumentAccess } from "@/lib/organization/document-access"

import { getSelectedGoogleDriveFile } from "@/features/google-drive"
import { readAiDocumentApplication,commitAiDocumentApplication } from "@/features/workspace-ai"
import type { AiDocumentApplication } from "@/features/workspace-ai/client"
import { normalizeCoreDocumentDriveSource } from "@/lib/roadmap/core-document-source"

import { sanitizeHtml } from "@/lib/markdown/sanitize"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { Json } from "@/lib/supabase"
import type { BudgetTableRow } from "@/lib/modules"
import {
  ROADMAP_SECTION_LIMIT,
  PUBLIC_ORGANIZATION_PROFILE_SECTION_IDS,
  getOrganizationNarrativeKeyForSectionId,
  getRoadmapWorkspaceRevalidationPaths,
  normalizeOrganizationNarrativeHtml,
  removeRoadmapSection,
  resolveRoadmapSections,
  updateRoadmapSection,
  updateOrganizationNarrativeSection,
  type RoadmapSection,
} from "@/lib/roadmap"
import { publicSharingEnabled } from "@/lib/feature-flags"
import {
  ORG_MEDIA_BUCKET,
  resolveOrgMediaCleanupPath,
} from "@/lib/storage/org-media"
import {
  canEditOrganization,
  resolveActiveOrganization,
} from "@/lib/organization/active-org"
import { createNotification } from "@/lib/notifications"

type SaveInput = {
  aiRunId?: string
  reviewedAiRevision?: string
  driveFileId?: string | null
  targetOrganizationId?: string
  expectedOrganizationId?: string
  expectedUserId?: string
  sectionId?: string
  expectedLastUpdated?: string | null
  title?: string
  subtitle?: string
  content?: string
  budgetRows?: BudgetTableRow[]
  imageUrl?: string | null
  isPublic?: boolean
  layout?: "square" | "vertical" | "wide"
  status?: "not_started" | "in_progress" | "complete"
  ctaLabel?: string
  ctaUrl?: string
}

type SaveResult =
  | { section: RoadmapSection; aiApplication?: AiDocumentApplication; aiReplay?: boolean }
  | {
      error: string
      code?: "conflict" | "scope_changed"
      currentSection?: RoadmapSection
      aiApplication?: AiDocumentApplication
    }
type DeleteResult = { ok: true } | { error: string }

function revalidateRoadmapWorkspacePaths({
  publicSlug,
  sectionSlug,
  includePublicRoadmap = true,
}: {
  publicSlug?: string | null
  sectionSlug?: string | null
  includePublicRoadmap?: boolean
}) {
  for (const path of getRoadmapWorkspaceRevalidationPaths({
    publicSlug,
    sectionSlug,
    includePublicRoadmap,
  })) {
    revalidatePath(path)
  }
}

function revalidatePublicOrganizationProfile(sectionId: string | null) {
  if (!sectionId || !PUBLIC_ORGANIZATION_PROFILE_SECTION_IDS.has(sectionId)) {
    return
  }
  revalidateTag("public-map-organizations", { expire: 0 })
  revalidateTag("public-profiles", { expire: 0 })
  revalidatePath("/map")
  revalidatePath("/resources")
}

export async function saveRoadmapSectionAction({
  aiRunId,
  reviewedAiRevision,
  driveFileId,
  targetOrganizationId,
  expectedOrganizationId,
  expectedUserId,
  sectionId,
  expectedLastUpdated,
  title,
  subtitle,
  content,
  budgetRows,
  imageUrl,
  isPublic,
  layout,
  status,
  ctaLabel,
  ctaUrl,
}: SaveInput): Promise<SaveResult> {
  const allowPublicSharing = publicSharingEnabled
  let supabase = await createSupabaseServerClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError) {
    return { error: userError.message }
  }

  if (!user) {
    return { error: "Unauthorized" }
  }

  const access = targetOrganizationId
    ? await resolveOrganizationDocumentAccess(
        supabase,
        user.id,
        targetOrganizationId
      )
    : { ...(await resolveActiveOrganization(supabase, user.id)), supabase }
  if ("error" in access) return { error: access.error ?? "Forbidden" }
  supabase = access.supabase
  const { orgId, role } = access
  if (!canEditOrganization(role)) return { error: "Forbidden" }
  const documentAccess = await resolveOrganizationDocumentStorageAccess({ supabase, orgId })
  if ("error" in documentAccess) return { error: documentAccess.error }
  const driveOnly = driveFileId !== undefined && Boolean(sectionId) &&
    [title, subtitle, content, budgetRows, imageUrl, isPublic, layout, status, ctaLabel, ctaUrl].every((value) => value === undefined)
  if (!documentAccess.hasStorageAccess && !driveOnly) return { error: DOCUMENT_STORAGE_UPGRADE_MESSAGE }

  if (
    (expectedOrganizationId && orgId !== expectedOrganizationId) ||
    (expectedUserId && user.id !== expectedUserId)
  ) {
    return {
      error:
        "Your account or organization changed. Reopen this document before saving.",
      code: "scope_changed",
    }
  }

  const { data: orgRow, error: orgError } = await supabase
    .from("organizations")
    .select("profile, public_slug, updated_at")
    .eq("user_id", orgId)
    .maybeSingle<{
      profile: Json | null
      public_slug: string | null
      updated_at: string
    }>()

  if (orgError) {
    return { error: orgError.message }
  }

  const currentProfile = (orgRow?.profile ?? {}) as Record<string, unknown>
  const existingSections = resolveRoadmapSections(currentProfile)
  const normalizedSectionId =
    typeof sectionId === "string" ? sectionId.trim() : ""
  const previousSection = normalizedSectionId
    ? (existingSections.find((section) => section.id === normalizedSectionId) ??
      null)
    : null

  let aiApplication: AiDocumentApplication | undefined
  if (aiRunId) {
    if (!previousSection || previousSection.driveSource || driveFileId !== undefined ||
      !expectedOrganizationId || !expectedUserId || expectedLastUpdated === undefined)
      return { error: "Reopen this core document before saving an AI draft." }
    try {
      const checked = await readAiDocumentApplication({ id:aiRunId,organizationId:orgId,userId:user.id,
        sectionId:previousSection.id,revision:expectedLastUpdated,reviewedRevision:reviewedAiRevision })
      const receipt=checked.application
      if (checked.stale) return { error:"The document changed. Review your draft before saving.",code:"conflict",currentSection:previousSection }
      if (receipt) {
        if (receipt.saved_revision !== previousSection.lastUpdated)
          return { error:"This proposal was already saved, and the document has changed since. Review your current draft.",code:"conflict",currentSection:previousSection,aiApplication:receipt }
        return { section:previousSection,aiApplication:receipt,aiReplay:true }
      }
    } catch (cause) { return { error:cause instanceof Error ? cause.message : "Unable to verify the AI proposal." } }
  }

  if (
    previousSection &&
    expectedLastUpdated !== undefined &&
    previousSection.lastUpdated !== expectedLastUpdated
  ) {
    return {
      error:
        "This roadmap section was updated elsewhere. Reload before saving.",
      code: "conflict",
      currentSection: previousSection,
    }
  }

  if (!previousSection && existingSections.length >= ROADMAP_SECTION_LIMIT) {
    return {
      error: `Roadmaps support up to ${ROADMAP_SECTION_LIMIT} sections.`,
    }
  }
  let driveSource: RoadmapSection["driveSource"] | undefined
  if (driveFileId !== undefined) {
    if (
      !previousSection ||
      !expectedOrganizationId ||
      !expectedUserId ||
      expectedLastUpdated === undefined
    ) {
      return { error: "Reopen this document before changing its source." }
    }
    if (driveFileId === null) {
      driveSource = null
    } else {
      try {
        const file = await getSelectedGoogleDriveFile(user.id, driveFileId)
        driveSource = normalizeCoreDocumentDriveSource({
          provider: "google_drive",
          fileId: file.id,
          name: file.name,
          webViewLink: file.webViewLink,
        })
        if (!driveSource)
          return { error: "Choose a valid Google Drive document." }
      } catch {
        return {
          error:
            "Unable to access this Google Drive file. Reconnect in Tools and try again.",
        }
      }
    }
  }
  const isNewSection = !previousSection
  const narrativeKey =
    getOrganizationNarrativeKeyForSectionId(normalizedSectionId)
  const sanitizedContent =
    typeof content === "string"
      ? narrativeKey
        ? normalizeOrganizationNarrativeHtml(content)
        : sanitizeHtml(content)
      : content
  const sectionUpdates = {
    driveSource,
    title: driveFileId !== undefined ? previousSection?.title : title,
    subtitle,
    content: sanitizedContent,
    budgetRows,
    imageUrl,
    isPublic: aiRunId || driveSource ? false : allowPublicSharing ? isPublic : false,
    layout,
    status: aiRunId ? "in_progress" as const : status,
    ctaLabel,
    ctaUrl,
  }
  const { nextProfile, section } = narrativeKey
    ? updateOrganizationNarrativeSection(
        currentProfile,
        narrativeKey,
        sectionUpdates
      )
    : updateRoadmapSection(currentProfile, sectionId ?? null, sectionUpdates)

  const cleanupPath = resolveOrgMediaCleanupPath({
    previousUrl: previousSection?.imageUrl ?? null,
    nextUrl: section.imageUrl ?? null,
    userId: orgId,
  })

  const readSaveConflict = async (): Promise<SaveResult> => {
    const {data} = await supabase.from("organizations").select("profile").eq("user_id",orgId).maybeSingle<{profile:Json | null}>()
    return {error:"This document changed. Review the saved version before saving.",code:"conflict",
      currentSection:data ? resolveRoadmapSections((data.profile ?? {}) as Record<string,unknown>).find(entry=>entry.id===normalizedSectionId) : undefined}
  }

  if (orgRow && aiRunId) {
    try {
      const committed = await commitAiDocumentApplication({ id:aiRunId,organizationId:orgId,userId:user.id,
        organizationRevision:orgRow.updated_at,sourceRevision:expectedLastUpdated ?? null,reviewedRevision:reviewedAiRevision,profile:nextProfile,section })
      if ("conflict" in committed) return readSaveConflict()
      if (committed.replayed) return { error:"This proposal was already saved. Retry to recover the saved version." }
      aiApplication=committed.application
    } catch (cause) { return { error:cause instanceof Error ? cause.message : "Unable to save this AI draft." } }
  } else if (orgRow) {
    const { data: updatedRow, error: updateError } = await supabase
      .from("organizations")
      .update({ profile: nextProfile as Json })
      .eq("user_id", orgId)
      .eq("updated_at", orgRow.updated_at)
      .select("user_id")
      .maybeSingle<{ user_id: string }>()

    if (updateError) return { error: updateError.message }
    if (!updatedRow) {
      return readSaveConflict()
    }
  } else {
    const { error: insertError } = await supabase.from("organizations").insert({
      user_id: orgId,
      profile: nextProfile as Json,
    })
    if (insertError) return { error: insertError.message }
  }

  if (cleanupPath) {
    await supabase.storage.from(ORG_MEDIA_BUCKET).remove([cleanupPath])
  }

  revalidateRoadmapWorkspacePaths({
    publicSlug: orgRow?.public_slug,
    sectionSlug: section.slug,
  })
  revalidatePublicOrganizationProfile(section.id)

  if (isNewSection) {
    const notifyResult = await createNotification(supabase, {
      userId: user.id,
      title: "Roadmap section added",
      description: section.title
        ? `New section: ${section.title}.`
        : "A new roadmap section was added.",
      href: "/organization",
      tone: "success",
      type: "roadmap_section_added",
      actorId: user.id,
      metadata: { sectionId: section.id },
    })
    if ("error" in notifyResult) {
      console.error("Failed to create roadmap notification", notifyResult.error)
    }
  }

  return { section, ...(aiApplication ? {aiApplication} : {}) }
}

export async function deleteRoadmapSectionAction(
  sectionId: string | null | undefined
): Promise<DeleteResult> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError) {
    return { error: userError.message }
  }

  if (!user) {
    return { error: "Unauthorized" }
  }

  const { orgId, role } = await resolveActiveOrganization(supabase, user.id)
  if (!canEditOrganization(role)) return { error: "Forbidden" }
  const documentAccess = await requireOrganizationDocumentStorage({ supabase, orgId })
  if ("error" in documentAccess) return { error: documentAccess.error }


  const { data: orgRow, error: orgError } = await supabase
    .from("organizations")
    .select("profile, public_slug, updated_at")
    .eq("user_id", orgId)
    .maybeSingle<{
      profile: Json | null
      public_slug: string | null
      updated_at: string
    }>()

  if (orgError) {
    return { error: orgError.message }
  }

  const currentProfile = (orgRow?.profile ?? {}) as Record<string, unknown>
  const targetId = typeof sectionId === "string" ? sectionId.trim() : ""
  const previousSection = targetId
    ? (resolveRoadmapSections(currentProfile).find(
        (section) => section.id === targetId
      ) ?? null)
    : null
  const { nextProfile, removed, error } = removeRoadmapSection(
    currentProfile,
    sectionId
  )

  if (error) {
    return { error }
  }

  if (!removed) {
    return { error: "Unable to delete section." }
  }

  if (!orgRow) return { error: "Organization not found." }

  const { data: updatedRow, error: updateError } = await supabase
    .from("organizations")
    .update({ profile: nextProfile as Json })
    .eq("user_id", orgId)
    .eq("updated_at", orgRow.updated_at)
    .select("user_id")
    .maybeSingle<{ user_id: string }>()

  if (updateError) return { error: updateError.message }
  if (!updatedRow) {
    return {
      error: "This organization was updated elsewhere. Reload before deleting.",
    }
  }

  const cleanupPath = resolveOrgMediaCleanupPath({
    previousUrl: previousSection?.imageUrl ?? null,
    nextUrl: null,
    userId: orgId,
  })

  if (cleanupPath) {
    await supabase.storage.from(ORG_MEDIA_BUCKET).remove([cleanupPath])
  }

  revalidateRoadmapWorkspacePaths({
    publicSlug: orgRow?.public_slug,
    sectionSlug: previousSection?.slug,
  })
  revalidatePublicOrganizationProfile(previousSection?.id ?? null)

  return { ok: true }
}

type ToggleResult = { ok: true } | { error: string }

export async function setRoadmapPublicAction(
  nextPublic: boolean
): Promise<ToggleResult> {
  if (!publicSharingEnabled) {
    return { error: "Public sharing is disabled until launch." }
  }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError) {
    return { error: userError.message }
  }

  if (!user) {
    return { error: "Unauthorized" }
  }

  const { orgId, role } = await resolveActiveOrganization(supabase, user.id)
  if (!canEditOrganization(role)) return { error: "Forbidden" }
  const documentAccess = await requireOrganizationDocumentStorage({ supabase, orgId })
  if ("error" in documentAccess) return { error: documentAccess.error }


  const { data: subscription, error: subscriptionError } = await supabase
    .from("subscriptions")
    .select("status, created_at")
    .eq("user_id", orgId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ status: string | null }>()

  if (subscriptionError) {
    return { error: subscriptionError.message }
  }

  const canPublishPublicRoadmap =
    subscription?.status === "active" || subscription?.status === "trialing"

  if (!canPublishPublicRoadmap) {
    return { error: "Upgrade to Organization to publish your roadmap." }
  }

  const { data: orgRow, error } = await supabase
    .from("organizations")
    .upsert({
      user_id: orgId,
      is_public_roadmap: nextPublic,
    })
    .select("public_slug")
    .maybeSingle<{ public_slug: string | null }>()

  if (error) {
    return { error: error.message }
  }

  revalidateRoadmapWorkspacePaths({
    publicSlug: orgRow?.public_slug,
  })

  return { ok: true }
}

type HeroResult = { ok: true } | { error: string }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value)

export async function setRoadmapHeroImageAction(
  heroUrl: string | null
): Promise<HeroResult> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError) {
    return { error: userError.message }
  }

  if (!user) {
    return { error: "Unauthorized" }
  }

  const { orgId, role } = await resolveActiveOrganization(supabase, user.id)
  if (!canEditOrganization(role)) return { error: "Forbidden" }
  const documentAccess = await requireOrganizationDocumentStorage({ supabase, orgId })
  if ("error" in documentAccess) return { error: documentAccess.error }


  const nextHero =
    typeof heroUrl === "string" && heroUrl.trim().length > 0
      ? heroUrl.trim()
      : null

  const { data: orgRow, error: orgError } = await supabase
    .from("organizations")
    .select("profile, public_slug, is_public_roadmap, updated_at")
    .eq("user_id", orgId)
    .maybeSingle<{
      profile: Json | null
      public_slug: string | null
      is_public_roadmap: boolean | null
      updated_at: string
    }>()

  if (orgError) {
    return { error: orgError.message }
  }

  const currentProfile = (orgRow?.profile ?? {}) as Record<string, unknown>
  const currentRoadmap = isRecord(currentProfile.roadmap)
    ? (currentProfile.roadmap as Record<string, unknown>)
    : {}
  const previousHeroUrl =
    typeof currentRoadmap.heroUrl === "string"
      ? (currentRoadmap.heroUrl as string)
      : null
  const nextProfile = isRecord(currentProfile) ? { ...currentProfile } : {}
  const roadmapRecord = isRecord(nextProfile.roadmap)
    ? { ...(nextProfile.roadmap as Record<string, unknown>) }
    : {}
  roadmapRecord.heroUrl = nextHero
  nextProfile.roadmap = roadmapRecord

  const cleanupPath = resolveOrgMediaCleanupPath({
    previousUrl: previousHeroUrl,
    nextUrl: nextHero,
    userId: orgId,
  })

  if (orgRow) {
    const { data: updatedRow, error: updateError } = await supabase
      .from("organizations")
      .update({ profile: nextProfile as Json })
      .eq("user_id", orgId)
      .eq("updated_at", orgRow.updated_at)
      .select("user_id")
      .maybeSingle<{ user_id: string }>()

    if (updateError) return { error: updateError.message }
    if (!updatedRow) {
      return {
        error: "This organization was updated elsewhere. Reload before saving.",
      }
    }
  } else {
    const { error: insertError } = await supabase.from("organizations").insert({
      user_id: orgId,
      profile: nextProfile as Json,
    })
    if (insertError) return { error: insertError.message }
  }

  if (cleanupPath) {
    await supabase.storage.from(ORG_MEDIA_BUCKET).remove([cleanupPath])
  }

  revalidateRoadmapWorkspacePaths({
    publicSlug: orgRow?.public_slug,
    includePublicRoadmap: Boolean(orgRow?.is_public_roadmap),
  })

  return { ok: true }
}
