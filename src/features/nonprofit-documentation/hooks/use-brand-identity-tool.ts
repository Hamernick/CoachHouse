"use client"
import { useCallback, useEffect, useMemo, useState } from "react"
import type {
  BrandAssetId,
  BrandIdentityDraft,
  StoredBrandAsset,
} from "../types"
import {
  BRAND_IDENTITY_STORAGE_KEY,
  DEFAULT_BRAND_IDENTITY_DRAFT,
  sanitizeBrandDraft,
} from "../lib/brand-identity"
import {
  clearBrandAssets,
  loadBrandAssets,
  removeBrandAsset,
  saveBrandAsset,
} from "../lib/brand-identity-storage"
import { brandAssetError } from "../lib/brand-asset-validation"
export function useBrandIdentityTool() {
  const [draft, setDraft] = useState(DEFAULT_BRAND_IDENTITY_DRAFT)
  const [assets, setAssets] = useState<StoredBrandAsset[]>([])
  const [ready, setReady] = useState(false)
  const [textAvailable, setTextAvailable] = useState(true)
  const [assetsLoaded, setAssetsLoaded] = useState(false)
  const [pendingAssets, setPendingAssets] = useState(0)
  const [textError, setTextError] = useState<string | null>(null)
  const [assetError, setAssetError] = useState<string | null>(null)
  const [notice, setNotice] = useState("Loading saved guide")
  useEffect(() => {
    let active = true
    try {
      const stored = window.localStorage.getItem(BRAND_IDENTITY_STORAGE_KEY)
      if (stored) setDraft(sanitizeBrandDraft(JSON.parse(stored)))
    } catch {
      setTextAvailable(false)
      setTextError(
        "Saved text could not be read. Your saved guide has not been overwritten. Reload to retry."
      )
    }
    loadBrandAssets()
      .then((savedAssets) => {
        if (active) {
          setAssets(savedAssets)
          setAssetsLoaded(true)
          setAssetError(null)
        }
      })
      .catch(() => {
        if (active)
          setAssetError(
            "Saved images could not be loaded. Uploads and exports are paused; reload to retry."
          )
      })
      .finally(() => {
        if (active) {
          setReady(true)
          setNotice("Saved on this device")
        }
      })
    return () => {
      active = false
    }
  }, [])
  useEffect(() => {
    if (!ready || !textAvailable) return
    try {
      window.localStorage.setItem(
        BRAND_IDENTITY_STORAGE_KEY,
        JSON.stringify(draft)
      )
      setTextError(null)
      setNotice("Saved on this device")
    } catch {
      setTextError(
        "Text could not be saved on this device. Keep this page open and export your guide."
      )
    }
  }, [draft, ready, textAvailable])
  const assetUrls = useMemo(
    () =>
      Object.fromEntries(
        assets.map((asset) => [asset.id, URL.createObjectURL(asset.blob)])
      ) as Partial<Record<BrandAssetId, string>>,
    [assets]
  )
  useEffect(
    () => () => {
      for (const url of Object.values(assetUrls)) URL.revokeObjectURL(url)
    },
    [assetUrls]
  )
  const updateDraft = useCallback(
    (
      update:
        | Partial<BrandIdentityDraft>
        | ((current: BrandIdentityDraft) => BrandIdentityDraft)
    ) => {
      setNotice("Saving")
      setDraft((current) => ({
        ...(typeof update === "function"
          ? update(current)
          : { ...current, ...update }),
        updatedAt: new Date().toISOString(),
      }))
    },
    []
  )
  const uploadAsset = useCallback(
    async (id: BrandAssetId, file: File) => {
      if (!assetsLoaded) return false
      const invalid = brandAssetError([file])
      if (invalid) {
        setNotice(invalid)
        return false
      }
      const asset: StoredBrandAsset = {
        id,
        name: file.name,
        type: file.type,
        blob: file,
        updatedAt: new Date().toISOString(),
      }
      setPendingAssets((count) => count + 1)
      try {
        await saveBrandAsset(asset)
        setAssets((current) => [
          ...current.filter((item) => item.id !== id),
          asset,
        ])
        setAssetError(null)
        setNotice("Saved on this device")
        return true
      } catch {
        setAssetError(
          "This browser could not save the image. The previous image is unchanged."
        )
        return false
      } finally {
        setPendingAssets((count) => count - 1)
      }
    },
    [assetsLoaded]
  )
  const deleteAsset = useCallback(
    async (id: BrandAssetId) => {
      if (!assetsLoaded) throw new Error("Saved images have not loaded")
      setPendingAssets((count) => count + 1)
      try {
        await removeBrandAsset(id)
        setAssets((current) => current.filter((asset) => asset.id !== id))
        setAssetError(null)
        setNotice("Image removed")
      } catch (error) {
        setAssetError("The image could not be removed. Try again.")
        throw error
      } finally {
        setPendingAssets((count) => count - 1)
      }
    },
    [assetsLoaded]
  )
  const reset = useCallback(async () => {
    if (!assetsLoaded || !textAvailable || pendingAssets) return
    setPendingAssets((count) => count + 1)
    try {
      await clearBrandAssets()
      setAssets([])
      setAssetError(null)
      setDraft(DEFAULT_BRAND_IDENTITY_DRAFT)
      setNotice("Started a fresh guide")
    } catch {
      setAssetError(
        "The guide could not be reset. Your current guide is still available."
      )
    } finally {
      setPendingAssets((count) => count - 1)
    }
  }, [assetsLoaded, textAvailable, pendingAssets])
  return {
    draft,
    assets,
    assetUrls,
    ready: ready && textAvailable,
    assetsReady: assetsLoaded && pendingAssets === 0,
    message:
      textError ?? assetError ?? (pendingAssets ? "Saving image…" : notice),
    updateDraft,
    uploadAsset,
    deleteAsset,
    reset,
  }
}
