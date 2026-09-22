"use client"

import { useState } from "react"
import CopyIcon from "lucide-react/dist/esm/icons/copy"
import DownloadIcon from "lucide-react/dist/esm/icons/download"
import PrinterIcon from "lucide-react/dist/esm/icons/printer"

import { Button } from "@/components/ui/button"

import type { BrandIdentityDraft, StoredBrandAsset } from "../../types"
import { buildBrandTokens } from "../../lib/brand-identity"
import {
  buildBrandPackage,
  downloadBlob,
} from "../../lib/brand-identity-export"
import { BrandIdentitySection } from "./brand-identity-section"

export function ExportsSection({
  draft,
  assets,
  ready = false,
}: {
  draft: BrandIdentityDraft
  assets: StoredBrandAsset[]
  ready?: boolean
}) {
  const [status, setStatus] = useState("Ready to export")
  const [working, setWorking] = useState(false)

  async function downloadPackage() {
    if (!ready) return
    setWorking(true)
    setStatus("Building brand package")
    try {
      const result = await buildBrandPackage(draft, assets)
      downloadBlob(result.blob, result.filename)
      setStatus("Brand package downloaded")
    } catch {
      setStatus("The brand package could not be created")
    } finally {
      setWorking(false)
    }
  }

  async function copyTokens() {
    try {
      await navigator.clipboard.writeText(buildBrandTokens(draft))
      setStatus("CSS tokens copied")
    } catch {
      setStatus("Copy failed. Download the package to get the CSS tokens.")
    }
  }

  return (
    <BrandIdentitySection
      id="exports"
      title="Export assets"
      description="Download your brand kit, copy its CSS tokens, or print the guide."
      className="pb-0 sm:pb-0"
    >
      <div className="flex flex-col gap-2">
        <Button
          type="button"
          className="w-full justify-start shadow-none"
          disabled={working || !ready}
          onClick={() => void downloadPackage()}
        >
          <DownloadIcon data-icon="inline-start" aria-hidden />
          {working ? "Building package" : "Download ZIP"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start shadow-none"
          disabled={!ready}
          onClick={() => void copyTokens()}
        >
          <CopyIcon data-icon="inline-start" aria-hidden />
          Copy CSS tokens
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start shadow-none"
          disabled={!ready}
          onClick={() => window.print()}
        >
          <PrinterIcon data-icon="inline-start" aria-hidden />
          Print guide
        </Button>
      </div>
      <p className="text-muted-foreground mt-4 text-xs leading-5">
        ZIP includes brand data, CSS tokens, usage notes, and every uploaded original.
      </p>
      <dl className="mt-3 text-xs">
        <div className="flex items-center justify-between gap-4">
          <dt>Uploaded originals</dt>
          <dd className="text-muted-foreground tabular-nums">{assets.length} files</dd>
        </div>
      </dl>
      <p
        className="text-muted-foreground mt-3 text-xs leading-5"
        role="status"
        aria-live="polite"
      >
        {ready
          ? status
          : "Waiting for saved text and images. Reload to retry if storage is unavailable."}
      </p>
    </BrandIdentitySection>
  )
}
