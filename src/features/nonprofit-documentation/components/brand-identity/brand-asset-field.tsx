"use client"
import { useRef, useState } from "react"
import Image from "next/image"
import DownloadIcon from "lucide-react/dist/esm/icons/download"
import Trash2Icon from "lucide-react/dist/esm/icons/trash-2"
import UploadIcon from "lucide-react/dist/esm/icons/upload"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { BrandAssetId, StoredBrandAsset } from "../../types"
import { downloadBlob } from "../../lib/brand-identity-export"
import {
  BRAND_ASSET_ACCEPT,
  brandAssetError,
} from "../../lib/brand-asset-validation"
import { BrandAssetExample } from "./brand-asset-example"
import { brandIdentityOwner } from "./brand-identity-owner"
export function BrandAssetField({
  id,
  label,
  guidance,
  asset,
  previewUrl,
  onUpload,
  onDelete,
  aspect = "wide",
  disabled = false,
}: {
  id: BrandAssetId
  label: string
  guidance: string
  asset?: StoredBrandAsset
  previewUrl?: string
  onUpload: (id: BrandAssetId, file: File) => Promise<boolean>
  onDelete: (id: BrandAssetId) => Promise<void>
  aspect?: "wide" | "square" | "portrait"
  disabled?: boolean
}) {
  const input = useRef<HTMLInputElement>(null)
  const pending = useRef(false)
  const depth = useRef(0)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const owner = (slot: string) =>
    brandIdentityOwner(
      "brand-asset-field",
      "BrandAssetField",
      id,
      slot,
      `${label}: this tile replaces only ${id}.`
    )
  async function upload(files: File[]) {
    if (disabled || pending.current) return
    const invalid = brandAssetError(files)
    setError(invalid)
    if (invalid) return
    pending.current = true
    setBusy(true)
    try {
      if (!(await onUpload(id, files[0])))
        setError("This image could not be saved. Try again.")
    } catch {
      setError("This image could not be saved. Try again.")
    } finally {
      pending.current = false
      setBusy(false)
    }
  }
  async function remove() {
    if (pending.current) return
    pending.current = true
    setBusy(true)
    setError(null)
    try {
      await onDelete(id)
    } catch {
      setError("The image could not be removed. Try again.")
    } finally {
      pending.current = false
      setBusy(false)
    }
  }
  return (
    <figure className="min-w-0" {...owner("asset")}>
      <div
        role="group"
        aria-label={`${label} dropzone`}
        className={cn(
          "group/asset bg-muted/45 relative overflow-hidden rounded-lg border transition-colors",
          dragging && "border-primary ring-primary ring-2"
        )}
        onDragEnter={(event) => {
          event.preventDefault()
          if (!disabled && !busy) {
            depth.current++
            setDragging(true)
          }
        }}
        onDragOver={(event) => {
          event.preventDefault()
          event.dataTransfer.dropEffect = disabled || busy ? "none" : "copy"
        }}
        onDragLeave={(event) => {
          event.preventDefault()
          if (--depth.current <= 0) {
            depth.current = 0
            setDragging(false)
          }
        }}
        onDrop={(event) => {
          event.preventDefault()
          depth.current = 0
          setDragging(false)
          void upload(Array.from(event.dataTransfer.files))
        }}
        {...owner("dropzone")}
      >
        <Button
          type="button"
          variant="ghost"
          disabled={disabled || busy}
          aria-label={`${asset ? "Replace" : "Upload"} ${label.toLowerCase()}`}
          aria-describedby={`asset-${id}-help${error ? ` asset-${id}-error` : ""}`}
          onClick={() => input.current?.click()}
          className={cn(
            "relative flex h-auto w-full flex-col overflow-hidden rounded-none p-0 whitespace-normal shadow-none",
            aspect === "square"
              ? "aspect-square"
              : aspect === "portrait"
                ? "aspect-[4/5]"
                : "aspect-[16/9]"
          )}
          {...owner("upload-trigger")}
        >
          <span className="pointer-events-none absolute inset-0">
            {previewUrl ? (
              <Image
                src={previewUrl}
                alt={`${label} preview`}
                fill
                sizes={aspect === "square" ? "320px" : "720px"}
                className={
                  id === "primary-logo" || id === "brand-mark"
                    ? "object-contain"
                    : "object-cover"
                }
                unoptimized
              />
            ) : (
              <BrandAssetExample id={id} />
            )}
          </span>
          {!asset ? (
            <span className="bg-background/90 text-muted-foreground absolute top-3 left-3 rounded px-2 py-1 text-[10px] font-normal">
              Example
            </span>
          ) : null}
          {busy || dragging ? (
            <span
              role="status"
              className="bg-background/90 text-foreground absolute inset-0 flex items-center justify-center text-sm"
              {...owner("upload-status")}
            >
              {busy ? "Saving image…" : "Drop image"}
            </span>
          ) : null}
        </Button>
        <div
          className={cn(
            "absolute top-2 right-2 flex gap-1",
            id === "primary-logo" && !asset
              ? "pointer-events-auto opacity-100"
              : "pointer-events-none opacity-0 group-focus-within/asset:pointer-events-auto group-focus-within/asset:opacity-100 group-hover/asset:pointer-events-auto group-hover/asset:opacity-100 [@media(hover:none)]:pointer-events-auto [@media(hover:none)]:opacity-100"
          )}
          {...owner("image-actions")}
        >
          {!asset ? (
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="size-8 shadow-none [@media(hover:none)]:size-11"
              disabled={disabled || busy}
              aria-label={`Choose ${label.toLowerCase()} file`}
              onClick={() => input.current?.click()}
              {...owner("choose-file-trigger")}
            >
              <UploadIcon aria-hidden />
            </Button>
          ) : null}
          {asset ? (
            <>
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className="size-8 shadow-none [@media(hover:none)]:size-11"
                aria-label={`Download ${label.toLowerCase()}`}
                onClick={() => downloadBlob(asset.blob, asset.name)}
                {...owner("download-trigger")}
              >
                <DownloadIcon aria-hidden />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className="size-8 shadow-none [@media(hover:none)]:size-11"
                disabled={disabled || busy}
                aria-label={`Remove ${label.toLowerCase()}`}
                onClick={() => void remove()}
                {...owner("remove-trigger")}
              >
                <Trash2Icon aria-hidden />
              </Button>
            </>
          ) : null}
        </div>
      </div>
      <figcaption className="mt-2" {...owner("caption")}>
        <p className="text-sm font-medium">{label}</p>
        <p
          id={`asset-${id}-help`}
          className="text-muted-foreground mt-1 text-xs leading-5"
        >
          {guidance}
        </p>
        {error ? (
          <p
            id={`asset-${id}-error`}
            role="alert"
            className="text-destructive mt-1 text-xs"
          >
            {error}
          </p>
        ) : null}
      </figcaption>
      <input
        ref={input}
        type="file"
        accept={BRAND_ASSET_ACCEPT}
        disabled={disabled || busy}
        aria-label={`${label} file`}
        className="hidden"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? [])
          if (files.length) void upload(files)
          event.target.value = ""
        }}
      />
    </figure>
  )
}
