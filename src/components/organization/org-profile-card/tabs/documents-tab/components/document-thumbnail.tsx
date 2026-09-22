"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { IconCloudUpload } from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { useDocumentPreviewUrl } from "../hooks/use-document-preview-url"
import { DocumentsLibraryTypeIcon } from "./documents-library-type-icon"
import { DocumentPdfThumbnail } from "./document-pdf-thumbnail"
import {
  isEmptyDocumentSlot,
  type LibraryItem,
} from "./documents-library-items"

export function DocumentThumbnail({
  item,
  compact,
}: {
  item: LibraryItem
  compact: boolean
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const drivePreview = Boolean(item.driveDocument)
  const supported =
    drivePreview || item.fileType === "image" || item.fileType === "pdf"
  const preview = useDocumentPreviewUrl(
    item.previewPath,
    item.previewVersion,
    visible && supported && !drivePreview
  )
  const previewUrl =
    drivePreview && visible ? (item.previewPath ?? null) : preview.url
  const onError = useCallback(() => setFailedUrl(previewUrl), [previewUrl])

  useEffect(() => {
    const root = rootRef.current
    if (!root || !supported || !item.previewPath) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: "100px" }
    )
    observer.observe(root)
    return () => observer.disconnect()
  }, [item.previewPath, supported])

  return (
    <div
      ref={rootRef}
      className={cn(
        "flex size-full min-h-0 items-center justify-center overflow-hidden p-2",
        item.contentPreview && "items-start justify-start px-3 py-2",
        compact && "size-9 p-0"
      )}
    >
      {item.contentPreview ? (
        <div
          className="text-muted-foreground line-clamp-7 w-full text-left text-xs leading-relaxed break-words whitespace-pre-line"
          aria-label={`${item.name} text preview`}
        >
          {item.contentPreview}
        </div>
      ) : previewUrl && previewUrl !== failedUrl ? (
        drivePreview || item.fileType === "image" ? (
          // Authenticated document previews bypass the public image optimizer.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt={`${item.name} preview`}
            width={320}
            height={320}
            loading="lazy"
            className="size-full rounded-md object-contain"
            onError={onError}
          />
        ) : (
          <DocumentPdfThumbnail
            key={previewUrl}
            url={previewUrl}
            name={item.name}
            onError={onError}
          />
        )
      ) : isEmptyDocumentSlot(item) ? (
        <IconCloudUpload
          className="text-muted-foreground size-5 shrink-0"
          aria-hidden
        />
      ) : (
        <DocumentsLibraryTypeIcon type={item.fileType} />
      )}
    </div>
  )
}
