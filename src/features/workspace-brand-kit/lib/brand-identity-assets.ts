import type { BrandAssetId, BrandAssetPreview, StoredBrandAsset } from "@/features/nonprofit-documentation"
import { BRAND_ASSET_IDS } from "@/lib/organization/brand-identity-schema"
import type { OrgProfile } from "@/lib/organization/org-profile-brand-types"
import { resolveWorkspaceBrandIdentity } from "./brand-identity-profile"

export function brandFileEndpoint(organizationId: string, fileId?: string) {
  const params = new URLSearchParams({ expectedOrganizationId: organizationId })
  if (fileId) params.set("id", fileId)
  return `/api/account/organization-document-files?${params}`
}

export async function brandFileUrl(organizationId: string, fileId: string) {
  const response = await fetch(brandFileEndpoint(organizationId, fileId), { cache: "no-store" })
  const result = await response.json()
  if (!response.ok || typeof result.url !== "string") throw new Error(result.error ?? "Unable to open brand file.")
  return result.url as string
}

export function workspaceBrandAssetPreviews(profile: OrgProfile): BrandAssetPreview[] {
  const identity = resolveWorkspaceBrandIdentity(profile)
  return BRAND_ASSET_IDS.flatMap<BrandAssetPreview>(id => {
    const reference = identity.assets[id]
    if (reference) return [{ id, name: reference.name, type: reference.type, updatedAt: reference.updatedAt }]
    // An explicit null suppresses a legacy logo after removal from this kit.
    const legacy = id === "primary-logo" ? profile.logoUrl : id === "brand-mark" ? profile.brandMarkUrl : null
    if (reference === undefined && legacy) return [{ id, name: id, type: "", updatedAt: identity.draft.updatedAt }]
    return []
  })
}

export async function resolveWorkspaceBrandAssetUrl(profile: OrgProfile, id: BrandAssetId) {
  const asset = resolveWorkspaceBrandIdentity(profile).assets[id]
  if (asset) {
    if (!profile.expectedOrganizationId) throw new Error("Reload the organization before opening brand files.")
    return brandFileUrl(profile.expectedOrganizationId, asset.fileId)
  }
  return id === "primary-logo" ? profile.logoUrl : id === "brand-mark" ? profile.brandMarkUrl : undefined
}

export async function loadWorkspaceBrandOriginal(profile: OrgProfile, asset: BrandAssetPreview): Promise<StoredBrandAsset> {
  const url = await resolveWorkspaceBrandAssetUrl(profile, asset.id)
  if (!url) throw new Error("Brand file is unavailable.")
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Unable to download ${asset.name}.`)
  const blob = await response.blob()
  const type = asset.type || blob.type
  const extension = ({ "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/svg+xml": "svg" } as Record<string, string>)[type]
  return { ...asset, type, blob, name: asset.type || !extension ? asset.name : `${asset.name}.${extension}` }
}
