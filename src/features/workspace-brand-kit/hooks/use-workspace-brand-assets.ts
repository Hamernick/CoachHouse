"use client"

import { useEffect, useRef, useState } from "react"
import { brandAssetError, downloadBlob, type BrandAssetId } from "@/features/nonprofit-documentation"
import { useWorkspaceEditorStatus } from "@/components/workspace/workspace-editor-status"
import { organizationBrandIdentitySchema } from "@/lib/organization/brand-identity-schema"
import type { WorkspaceBrandKitProfileEditorProps } from "../components/workspace-brand-kit-profile-editor-types"
import { resolveWorkspaceBrandIdentity } from "../lib/brand-identity-profile"
import { brandFileEndpoint, loadWorkspaceBrandOriginal, resolveWorkspaceBrandAssetUrl, workspaceBrandAssetPreviews } from "../lib/brand-identity-assets"

export function useWorkspaceBrandAssets({ profile, onChange, onBusyChange, readOnly }: WorkspaceBrandKitProfileEditorProps) {
  const latest = useRef({ profile, onChange })
  latest.current = { profile, onChange }
  const mounted = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)
  const [assetUrls, setAssetUrls] = useState<Partial<Record<BrandAssetId, string>>>({})
  const assets = workspaceBrandAssetPreviews(profile)
  const references = JSON.stringify([profile.expectedOrganizationId, profile.brandIdentity?.assets, profile.logoUrl, profile.brandMarkUrl])
  useWorkspaceEditorStatus({ label: "Brand kit files", dirty: false, pending: busy })
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => {
    onBusyChange?.(busy)
    return () => onBusyChange?.(false)
  }, [busy, onBusyChange])
  useEffect(() => {
    let active = true
    const current = latest.current.profile
    const previews = workspaceBrandAssetPreviews(current)
    setLoading(true)
    setError("")
    setAssetUrls({})
    Promise.all(previews.map(async asset => [asset.id, await resolveWorkspaceBrandAssetUrl(current, asset.id)] as const))
      .then(entries => { if (active) setAssetUrls(Object.fromEntries(entries.filter(([, url]) => url))) })
      .catch(() => { if (active) setError("Some brand files could not load. Retry, or restore them in Documents.") })
      .finally(() => { if (active) setLoading(false) })
    // Signed URLs expire after 15 minutes; refresh while the editor remains mounted.
    const timer = window.setTimeout(() => setAttempt(value => value + 1), 10 * 60 * 1000)
    return () => { active = false; window.clearTimeout(timer) }
  }, [references, attempt])

  async function uploadAsset(id: BrandAssetId, file: File) {
    if (readOnly || busy) return false
    const validation = brandAssetError([file])
    if (validation) throw new Error(validation)
    const organizationId = profile.expectedOrganizationId
    if (!organizationId) throw new Error("Reload the organization before uploading files.")
    setBusy(true)
    try {
      const body = new FormData()
      body.set("file", file)
      const response = await fetch(brandFileEndpoint(organizationId), { method: "POST", body })
      const result = await response.json()
      if (!response.ok || !result.file) throw new Error(result.error ?? "Upload failed.")
      if (!mounted.current || latest.current.profile.expectedOrganizationId !== organizationId) return false
      const identity = resolveWorkspaceBrandIdentity(latest.current.profile)
      const value = organizationBrandIdentitySchema.parse({ ...identity, assets: { ...identity.assets, [id]: {
        fileId: result.file.id, name: result.file.name, type: result.file.mimeType,
        size: result.file.sizeBytes, updatedAt: result.file.updatedAt,
      } } })
      latest.current.onChange({ brandIdentity: value })
      return true
    } finally { if (mounted.current) setBusy(false) }
  }
  async function downloadAsset(id: BrandAssetId) {
    const asset = assets.find(asset => asset.id === id)
    if (!asset) throw new Error("Brand file is unavailable.")
    const original = await loadWorkspaceBrandOriginal(latest.current.profile, asset)
    downloadBlob(original.blob, original.name)
  }
  async function loadAssets() {
    // Resolve every original afresh; fail the export rather than silently omit a file.
    const originals = []
    for (const asset of assets) originals.push(await loadWorkspaceBrandOriginal(latest.current.profile, asset))
    return originals
  }
  return { assets, assetUrls, busy, error, loading, uploadAsset, downloadAsset, loadAssets, retry: () => setAttempt(value => value + 1) }
}
