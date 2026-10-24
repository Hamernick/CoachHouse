"use client"

import { useCallback, useState, type RefObject } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"

import { useDocumentPreviewUrl } from "../hooks/use-document-preview-url"
import type { LibraryItem } from "./documents-library-items"
import { DocumentPdfViewer } from "./document-pdf-viewer"

function DocumentPreviewContent({ item }: { item: LibraryItem }) {
  const driveThumbnail = Boolean(item.driveDocument)
  const signedPreview = useDocumentPreviewUrl(
    item.previewPath,
    item.previewVersion,
    !driveThumbnail
  )
  // Drive's endpoint serves thumbnail image bytes, including for PDF covers.
  const preview = {
    ...signedPreview,
    url: driveThumbnail ? (item.previewPath ?? null) : signedPreview.url,
    error: driveThumbnail ? null : signedPreview.error,
  }
  const originalUrl = item.driveDocument?.webViewLink ?? preview.url
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const onPreviewError = useCallback(
    () => setFailedUrl(preview.url),
    [preview.url]
  )
  const error =
    preview.error ||
    (preview.url && preview.url === failedUrl
      ? "This preview could not be displayed."
      : null)
  return (
    <>
      <DialogHeader className="pr-10">
        <DialogTitle className="break-words">{item.name}</DialogTitle>
        <DialogDescription>
          {driveThumbnail ? "Google Drive thumbnail preview" : "Document preview"}
        </DialogDescription>
      </DialogHeader>
      <div className="bg-muted/40 flex h-[65dvh] min-h-0 items-center justify-center overflow-hidden rounded-lg">
        {error ? (
          <div className="flex flex-col items-center gap-2 p-4">
            <p role="alert" className="text-sm">
              {error}
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setFailedUrl(null)
                preview.retry()
              }}
            >
              Retry preview
            </Button>
          </div>
        ) : !preview.url ? (
          <Skeleton
            className="size-full"
            aria-label="Loading document preview"
          />
        ) : driveThumbnail || item.fileType === "image" ? (
          // Private signed files bypass the public image optimizer.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview.url}
            alt={item.name}
            width={1200}
            height={1200}
            className="size-full object-contain"
            onError={() => setFailedUrl(preview.url)}
          />
        ) : (
          <DocumentPdfViewer
            key={preview.url}
            url={preview.url}
            name={item.name}
            onError={onPreviewError}
          />
        )}
      </div>
      {originalUrl ? (
        <div className="flex justify-end">
          <Button variant="outline" asChild>
            <a href={originalUrl} target="_blank" rel="noopener noreferrer">
              Open original
            </a>
          </Button>
        </div>
      ) : null}
    </>
  )
}

export function DocumentPreviewDialog({
  item,
  onClose,
  returnFocusRef,
}: {
  item: LibraryItem | null
  onClose: () => void
  returnFocusRef: RefObject<HTMLButtonElement | null>
}) {
  return (
    <Dialog
      open={Boolean(item)}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent

        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-3xl"
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          returnFocusRef.current?.focus()
        }}
      >
        {item ? (
          <DocumentPreviewContent
            key={`${item.id}:${item.previewVersion}`}
            item={item}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
