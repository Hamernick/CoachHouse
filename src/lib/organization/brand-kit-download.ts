import { currentlyPublicOrganizationIds } from "@/lib/organization/public-read-admission"
import { extname } from "node:path"

import type { SupabaseClient } from "@supabase/supabase-js"

import {
  buildBrandKitReadme,
  resolveBrandManifest,
} from "@/features/workspace-brand-kit"
import { requireServerSession } from "@/lib/auth"
import { createZipArchive } from "@/lib/files/simple-zip"
import type { ZipEntry } from "@/lib/files/simple-zip"
import { resolveActiveOrganization } from "@/lib/organization/active-org"
import type { OrgProfile } from "@/lib/organization/org-profile-brand-types"
import { extractPublicObjectPath } from "@/lib/storage/public-url"
import { ORG_MEDIA_BUCKET } from "@/lib/storage/org-media"
import type { Database } from "@/lib/supabase"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

function readProfileString(profile: Record<string, unknown>, key: string) {
  const value = profile[key]
  return typeof value === "string" ? value : null
}

function readProfileStringArray(profile: Record<string, unknown>, key: string) {
  const value = profile[key]
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : []
}

function readTypographyConfig(profile: Record<string, unknown>) {
  const value = profile["brandTypography"]
  if (!value || typeof value !== "object") return null
  return value as OrgProfile["brandTypography"]
}

function hydrateBrandProfile({
  profile,
  publicSlug,
  isPublic,
}: {
  profile: Record<string, unknown>
  publicSlug?: string | null
  isPublic?: boolean | null
}): OrgProfile {
  return {
    name: readProfileString(profile, "name") ?? "",
    tagline: readProfileString(profile, "tagline") ?? "",
    boilerplate: readProfileString(profile, "boilerplate") ?? "",
    brandVoiceAudience: readProfileString(profile, "brandVoiceAudience") ?? "",
    brandVoiceTone: readProfileString(profile, "brandVoiceTone") ?? "",
    brandVoiceStyle: readProfileString(profile, "brandVoiceStyle") ?? "",
    brandVoicePersonality:
      readProfileString(profile, "brandVoicePersonality") ?? "",
    brandVoiceGuidelines:
      readProfileString(profile, "brandVoiceGuidelines") ?? "",
    brandVoiceAvoid: readProfileString(profile, "brandVoiceAvoid") ?? "",
    logoUrl: readProfileString(profile, "logoUrl") ?? "",
    brandMarkUrl: readProfileString(profile, "brandMarkUrl") ?? "",
    headerUrl: readProfileString(profile, "headerUrl") ?? "",
    brandPrimary: readProfileString(profile, "brandPrimary") ?? "",
    brandColors: readProfileStringArray(profile, "brandColors"),
    brandThemePresetId: readProfileString(profile, "brandThemePresetId") ?? "",
    brandAccentPresetId:
      readProfileString(profile, "brandAccentPresetId") ?? "",
    brandTypographyPresetId:
      readProfileString(profile, "brandTypographyPresetId") ?? "",
    brandTypography: readTypographyConfig(profile) ?? null,
    publicSlug: publicSlug ?? "",
    isPublic: Boolean(isPublic ?? false),
  }
}

function normalizeArchiveSlug(value: string | null | undefined) {
  const trimmed = typeof value === "string" ? value.trim() : ""
  if (!trimmed) return "organization"
  return (
    trimmed
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "organization"
  )
}

function normalizeAssetExtension(path: string) {
  const extension = extname(path).toLowerCase()
  if (extension === ".svg+xml") return ".svg"
  if (extension === ".jpeg") return ".jpg"
  return extension || ".png"
}

async function readAsset(
  supabase: SupabaseClient<Database>,
  url: string | null | undefined,
  targetBaseName: string
) {
  if (!url) return null
  const objectPath = extractPublicObjectPath(url, ORG_MEDIA_BUCKET)
  if (!objectPath) return null
  const { data, error } = await supabase.storage
    .from(ORG_MEDIA_BUCKET)
    .download(objectPath)
  if (error || !data) return null

  const extension = normalizeAssetExtension(objectPath)
  return {
    fileName: `${targetBaseName}${extension}`,
    bytes: new Uint8Array(await data.arrayBuffer()),
  }
}

async function buildBrandKitArchive({
  profile,
  supabase,
}: {
  profile: OrgProfile
  supabase: SupabaseClient<Database>
}) {
  const primaryLogo = await readAsset(supabase, profile.logoUrl, "logo-primary")
  const logoMark = await readAsset(supabase, profile.brandMarkUrl, "logo-mark")
  const bannerImage = await readAsset(
    supabase,
    profile.headerUrl,
    "brand-banner"
  )
  const { manifest, preset } = resolveBrandManifest(profile)
  manifest.logoPrimaryFile = primaryLogo?.fileName ?? null
  manifest.logoMarkFile = logoMark?.fileName ?? null
  manifest.bannerFile = bannerImage?.fileName ?? null

  const summary = buildBrandKitReadme({ manifest, preset })
  const entries: ZipEntry[] = []
  if (primaryLogo) {
    entries.push({
      name: `logos/${primaryLogo.fileName}`,
      data: primaryLogo.bytes,
    })
  }
  if (logoMark) {
    entries.push({
      name: `logos/${logoMark.fileName}`,
      data: logoMark.bytes,
    })
  }
  if (bannerImage) {
    entries.push({
      name: `banners/${bannerImage.fileName}`,
      data: bannerImage.bytes,
    })
  }
  entries.push(
    {
      name: "brand/brand.json",
      data: JSON.stringify(manifest, null, 2),
    },
    {
      name: "brand/brand.txt",
      data: summary,
    },
    {
      name: "README.txt",
      data: summary,
    }
  )
  const archive = createZipArchive(entries)

  return {
    archive,
    fileName: `${normalizeArchiveSlug(profile.publicSlug || profile.name)}-brand-kit.zip`,
    hasAssets: Boolean(primaryLogo || logoMark || bannerImage),
  }
}

export async function buildAccountBrandKitDownload() {
  const { supabase, session } = await requireServerSession("/workspace")
  const { orgId } = await resolveActiveOrganization(supabase, session.user.id)
  const { data, error } = await supabase
    .from("organizations")
    .select("profile, public_slug, is_public")
    .eq("user_id", orgId)
    .maybeSingle<{
      profile: Record<string, unknown> | null
      public_slug: string | null
      is_public: boolean | null
    }>()

  if (error || !data) {
    return {
      error: error?.message ?? "Organization not found",
      status: 404 as const,
    }
  }

  const profile = hydrateBrandProfile({
    profile: (data.profile ?? {}) as Record<string, unknown>,
    publicSlug: data.public_slug,
    isPublic: data.is_public,
  })

  return buildBrandKitArchive({ profile, supabase })
}

export async function buildPublicBrandKitDownload(slug: string) {
  const admin = createSupabaseAdminClient()
  const normalizedSlug = slug.trim().toLowerCase()
  const { data, error } = await admin
    .from("organizations")
    .select("user_id, profile, public_slug, is_public")
    .eq("public_slug", normalizedSlug)
    .eq("is_public", true)
    .maybeSingle<{
      user_id: string
      profile: Record<string, unknown> | null
      public_slug: string | null
      is_public: boolean | null
    }>()

  if (error || !data) {
    return {
      error: error?.message ?? "Organization not found",
      status: 404 as const,
    }
  }

  if (!(await currentlyPublicOrganizationIds([data.user_id])).has(data.user_id)) return { error: "Organization not found", status: 404 as const }

  const profile = hydrateBrandProfile({
    profile: (data.profile ?? {}) as Record<string, unknown>,
    publicSlug: data.public_slug,
    isPublic: data.is_public,
  })

  const result = await buildBrandKitArchive({ profile, supabase: admin })
  if (!(await currentlyPublicOrganizationIds([data.user_id])).has(data.user_id)) return { error: "Organization not found", status: 404 as const }
  if (!result.hasAssets) {
    return { error: "Brand kit not available", status: 404 as const }
  }

  return result
}
