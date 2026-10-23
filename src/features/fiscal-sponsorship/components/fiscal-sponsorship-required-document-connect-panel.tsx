"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import CheckCircle2Icon from "lucide-react/dist/esm/icons/check-circle-2"
import FileUpIcon from "lucide-react/dist/esm/icons/file-up"
import Loader2Icon from "lucide-react/dist/esm/icons/loader-2"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { FieldLegend, FieldSet } from "@/components/ui/field"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Dropzone,
  DropzoneContent,
  DropzoneEmptyState,
} from "@/components/ui/shadcn-io/dropzone"
import { toast } from "@/lib/toast"

import { uploadFiscalSponsorshipProjectAsset } from "../lib/project-asset-upload"
import type {
  ConnectFiscalSponsorshipDocumentAssetResult,
  FiscalSponsorshipDocumentKey,
  FiscalSponsorshipProjectAssetOption,
} from "../types"

const MAX_PROJECT_ASSET_BYTES = 50 * 1024 * 1024

export function FiscalSponsorshipRequiredDocumentConnectPanel({
  assets,
  connectDocumentAssetAction,
  description,
  documentKey,
  label,
  projectId,
}: {
  assets: FiscalSponsorshipProjectAssetOption[]
  connectDocumentAssetAction: (input: {
    assetId: string
    documentKey: FiscalSponsorshipDocumentKey
    projectId: string
  }) => Promise<ConnectFiscalSponsorshipDocumentAssetResult>
  description: string
  documentKey: FiscalSponsorshipDocumentKey
  label: string
  projectId: string
}) {
  const router = useRouter()
  const [selectedAssetId, setSelectedAssetId] = React.useState("")
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null)
  const [savedUpload, setSavedUpload] = React.useState<FiscalSponsorshipProjectAssetOption | null>(null)
  const availableAssets = savedUpload && !assets.some((asset) => asset.id === savedUpload.id) ? [...assets, savedUpload] : assets
  const [isPending, startTransition] = React.useTransition()
  const canConnect = Boolean(selectedFile || selectedAssetId)

  function handleConnect() {
    if (!canConnect) {
      toast.error("Choose a new or existing project file.")
      return
    }
    startTransition(async () => {
      const toastId = toast.loading(
        selectedFile ? `Uploading ${selectedFile.name}…` : "Connecting file…"
      )

      try {
        const uploadedAsset = selectedFile
          ? await uploadFiscalSponsorshipProjectAsset({
              description,
              file: selectedFile,
              projectId,
              title: selectedFile.name,
            })
          : null
        const assetId = uploadedAsset?.assetId || selectedAssetId
        // Keep a completed upload available if document connection must be retried.
        if (uploadedAsset) {
          setSelectedAssetId(assetId)
          setSavedUpload({ id: assetId, name: uploadedAsset.assetName || selectedFile?.name || label })
          setSelectedFile(null)
        }
        const result = await connectDocumentAssetAction({
          assetId,
          documentKey,
          projectId,
        })

        if ("error" in result) {
          throw new Error(result.error)
        }

        setSelectedAssetId("")
        setSelectedFile(null)
        toast.success("Fiscal document connected", { id: toastId })
        router.refresh()
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Unable to connect that fiscal document.",
          { id: toastId }
        )
      }
    })
  }

  return (
    <div
      data-fiscal-sponsorship-required-document-connect-panel={documentKey}
      className="bg-muted/25 border-border/70 flex min-w-0 flex-col gap-3 rounded-xl border p-3"
    >
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-foreground text-xs font-medium">Add {label}</p>
        <p className="text-muted-foreground text-[11px] leading-4">
          Drop a new file here or connect one already saved to this project.
        </p>
      </div>

      <Dropzone
        src={selectedFile ? [selectedFile] : undefined}
        maxFiles={1}
        maxSize={MAX_PROJECT_ASSET_BYTES}
        disabled={isPending}
        className="bg-background/70 hover:bg-muted/35 min-h-28 rounded-xl border-dashed p-4 shadow-none transition-[background-color,border-color]"
        onDrop={(acceptedFiles) => {
          const file = acceptedFiles[0] ?? null
          setSelectedFile(file)
          if (file) setSelectedAssetId("")
        }}
        onError={(error) => toast.error(error.message)}
      >
        <DropzoneEmptyState className="items-center gap-1 text-center" />
        <DropzoneContent className="items-center text-center" />
      </Dropzone>

      {availableAssets.length > 0 ? (
        <FieldSet className="min-w-0 gap-1.5">
          <FieldLegend className="text-muted-foreground text-[11px] font-medium">
            Or use an existing project file
          </FieldLegend>
          <RadioGroup
            value={selectedAssetId}
            onValueChange={(value) => {
              setSelectedAssetId(value)
              setSelectedFile(null)
            }}
            disabled={isPending}
            aria-label={`Choose existing project file for ${label}`}
            className="max-h-40 gap-1.5 overflow-y-auto overscroll-contain pr-1"
          >
            {availableAssets.map((asset) => {
              const inputId = `fiscal-required-${documentKey}-${asset.id}`

              return (
                <label
                  key={asset.id}
                  htmlFor={inputId}
                  className="hover:bg-muted/55 has-data-[state=checked]:bg-muted/45 has-data-[state=checked]:border-border flex min-h-11 min-w-0 cursor-pointer items-center gap-2.5 rounded-lg border border-transparent px-2.5 py-2 transition-[background-color,border-color]"
                >
                  <RadioGroupItem id={inputId} value={asset.id} />
                  <span className="text-foreground min-w-0 flex-1 truncate text-xs">
                    {asset.name}
                  </span>
                  {asset.sizeLabel ? (
                    <Badge variant="outline" className="shrink-0 tabular-nums">
                      {asset.sizeLabel}
                    </Badge>
                  ) : null}
                </label>
              )
            })}
          </RadioGroup>
        </FieldSet>
      ) : null}

      <div className="flex justify-end">
        <Button
          type="button"
          size="sm"
          className="rounded-full"
          disabled={!canConnect || isPending}
          aria-busy={isPending}
          onClick={handleConnect}
        >
          {isPending ? (
            <Loader2Icon
              data-icon="inline-start"
              className="animate-spin"
              aria-hidden
            />
          ) : selectedFile ? (
            <FileUpIcon data-icon="inline-start" aria-hidden />
          ) : (
            <CheckCircle2Icon data-icon="inline-start" aria-hidden />
          )}
          {selectedFile ? "Upload and connect" : "Connect file"}
        </Button>
      </div>
    </div>
  )
}
