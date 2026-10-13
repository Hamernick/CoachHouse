"use client"

import { getDocumentEditorHref } from "@/lib/workspace/editor-navigation"

import Link from "next/link"
import { useId, type ReactNode } from "react"
import {
  IconCheck,
  IconDots,
  IconRestore,
  IconTrash,
} from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import type { DocumentIndexRow } from "../types"
import type { OrganizationDocumentFile } from "../hooks/use-organization-document-files"
import { DocumentThumbnail } from "./document-thumbnail"
import { useDocumentSlotDrop } from "../hooks/use-document-slot-drop"
import {
  formatCardDate,
  isEmptyDocumentSlot,
  type LibraryItem,
} from "./documents-library-items"

type DocumentsLibraryCardProps = {
  actions?: ReactNode
  item: LibraryItem
  viewMode: "grid" | "list"
  selected: boolean
  selecting: boolean
  pending: boolean
  uploading: boolean
  canEdit: boolean
  editMode: boolean
  onOpen: (trigger: HTMLButtonElement) => void
  onDropFile?: (file: File) => void
  onToggle: () => void
  renderRowActions?: (row: DocumentIndexRow) => ReactNode
  pendingUploadedFileIds: string[]
  onRestoreUploadedFile: (file: OrganizationDocumentFile) => Promise<void>
  onTrashUploadedFile: (file: OrganizationDocumentFile) => Promise<void>
  onPermanentlyDeleteUploadedFile: (
    file: OrganizationDocumentFile
  ) => Promise<void>
}

export function DocumentsLibraryCard({
  actions,
  item,
  viewMode,
  selected,
  selecting,
  pending,
  uploading,
  canEdit,
  editMode,
  onOpen,
  onDropFile,
  onToggle,
  renderRowActions,
  pendingUploadedFileIds,
  onRestoreUploadedFile,
  onTrashUploadedFile,
  onPermanentlyDeleteUploadedFile,
}: DocumentsLibraryCardProps) {
  const missingUpload = isEmptyDocumentSlot(item)
  const drop = useDocumentSlotDrop(onDropFile)
  const dropDescriptionId = useId()
  const cardDate = formatCardDate(item.deletedAt ?? item.updatedAt)
  return (
    <article
      {...(missingUpload ? drop.handlers : {})}
      data-document-id={item.id}
      data-document-dropzone={missingUpload || undefined}
      data-dragging-file={(missingUpload && drop.dragging) || undefined}
      data-selected={selected || undefined}
      aria-busy={uploading || undefined}
      className={cn(
        "group/card bg-muted/80 ring-border/60 relative flex aspect-square flex-col overflow-hidden rounded-xl ring-1 transition-[background-color,box-shadow,transform] duration-200 motion-reduce:transition-none sm:min-h-0",
        "hover:bg-muted focus-within-visible:ring-ring/50 focus-within-visible:ring-2 hover:shadow-lg hover:shadow-black/5 dark:bg-[#303030] dark:hover:bg-[#363636]",
        missingUpload &&
          "hover:bg-muted/40 dark:hover:bg-muted/40 bg-transparent ring-0 hover:shadow-none dark:bg-transparent",
        viewMode === "list" &&
          "aspect-auto min-h-20 flex-row items-center gap-3 rounded-2xl px-4 pr-24 sm:min-h-20"
      )}
    >
      {actions}
      <Button
        type="button"
        variant="ghost"
        className={cn(
          "absolute inset-0 z-0 h-auto w-auto rounded-xl border-2 border-transparent p-0 hover:bg-transparent focus-visible:ring-2",
          missingUpload &&
            "border-border hover:border-muted-foreground/60 border border-dashed",
          missingUpload &&
            drop.dragging &&
            "border-primary bg-primary/5 hover:bg-primary/5",
          selected && "border-foreground",
          viewMode === "list" && "rounded-2xl"
        )}
        onClick={(event) =>
          selecting ? onToggle() : onOpen(event.currentTarget)
        }
        aria-label={
          selecting
            ? `${selected ? "Deselect" : "Select"} ${item.name}`
            : uploading
              ? `Uploading ${item.name}…`
              : missingUpload
                ? item.row?.source === "roadmap"
                  ? `Start ${item.name}`
                  : `Upload ${item.name}`
                : `Open ${item.name}`
        }
        aria-describedby={missingUpload ? dropDescriptionId : undefined}
        disabled={
          pending ||
          (item.deleted && !selecting) ||
          (missingUpload && (selecting || !canEdit || !editMode)) ||
          uploading
        }
      />
      <h3
        aria-label={item.name}
        className={cn(
          "pointer-events-none relative z-10 line-clamp-2 px-3 pt-3 pr-11 text-sm leading-5 font-medium break-words",
          viewMode === "list" && "min-w-0 flex-1 px-0 pt-0"
        )}
      >
        {item.row?.source === "roadmap" ? (
          <Link
            href={
              item.coreDriveSource?.webViewLink ??
              getDocumentEditorHref(item.row.section.slug)
            }
            target={item.coreDriveSource ? "_blank" : undefined}
            rel={item.coreDriveSource ? "noopener noreferrer" : undefined}
            className="pointer-events-auto relative z-20 hover:underline"
            aria-label={`Open ${item.name}${item.coreDriveSource ? " in Google Drive" : " editor"}`}
          >
            {item.name}
          </Link>
        ) : (
          item.name
        )}
      </h3>
      <div
        className={cn(
          "text-foreground pointer-events-none relative z-10 flex min-h-0 flex-1 items-center justify-center",
          viewMode === "grid" && missingUpload && "absolute inset-0",
          viewMode === "list" && "order-first flex-none [&_svg]:size-5"
        )}
      >
        <DocumentThumbnail item={item} compact={viewMode === "list"} />
      </div>
      {cardDate ? (
        <div
          className={cn(
            "text-muted-foreground pointer-events-none relative z-10 flex min-h-11 items-center px-3 pr-12 pb-1 text-xs",
            viewMode === "list" && "hidden min-h-0 px-0 pb-0 sm:flex"
          )}
        >
          <span className="truncate tabular-nums">
            {item.deletedAt ? `Deleted ${cardDate}` : cardDate}
          </span>
        </div>
      ) : (
        <div
          id={missingUpload ? dropDescriptionId : undefined}
          className={
            viewMode === "list"
              ? "hidden"
              : "text-muted-foreground pointer-events-none mt-auto min-h-11 px-3 pt-2 pb-2 text-xs"
          }
        >
          {missingUpload
            ? uploading
              ? "Uploading…"
              : canEdit && editMode
                ? drop.dragging
                  ? "Drop file here"
                  : item.row?.source === "roadmap"
                    ? "Start writing or choose from Drive"
                    : "Drop file or click to upload"
                : "Not uploaded"
            : null}
        </div>
      )}
      {viewMode === "list" && item.row && !selecting ? (
        <div className="relative z-20 shrink-0">
          {renderRowActions?.(item.row)}
        </div>
      ) : null}
      {!actions && item.uploadedFile && canEdit && editMode ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                "absolute top-2 right-2 z-20 size-11 rounded-full bg-transparent opacity-100 hover:bg-black/5 focus-visible:ring-2 sm:size-8 sm:opacity-0 sm:group-hover/card:opacity-100 sm:focus:opacity-100 dark:hover:bg-white/10",
                selected && "sm:opacity-100",
                viewMode === "list" &&
                  "top-1/2 right-12 -translate-y-1/2 sm:opacity-100"
              )}
              disabled={pendingUploadedFileIds.includes(item.uploadedFile.id)}
              aria-label={`Manage ${item.name}`}
            >
              <IconDots className="size-4" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-48 rounded-xl p-1.5 shadow-xl dark:border-white/10 dark:bg-[#303030]"
          >
            <DropdownMenuGroup>
              {item.deleted ? (
                <>
                  <DropdownMenuItem
                    className="min-h-11 rounded-lg text-base sm:min-h-9 sm:text-sm"
                    onSelect={() =>
                      void onRestoreUploadedFile(item.uploadedFile!)
                    }
                  >
                    <IconRestore className="size-4" aria-hidden />
                    Restore
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    className="min-h-11 rounded-lg text-base sm:min-h-9 sm:text-sm"
                    onSelect={() => {
                      if (
                        window.confirm(
                          `Permanently delete ${item.name}? This cannot be undone.`
                        )
                      ) {
                        void onPermanentlyDeleteUploadedFile(item.uploadedFile!)
                      }
                    }}
                  >
                    <IconTrash className="size-4" aria-hidden />
                    Delete permanently
                  </DropdownMenuItem>
                </>
              ) : (
                <DropdownMenuItem
                  variant="destructive"
                  className="min-h-11 rounded-lg text-base sm:min-h-9 sm:text-sm"
                  onSelect={() => void onTrashUploadedFile(item.uploadedFile!)}
                >
                  <IconTrash className="size-4" aria-hidden />
                  Move to Recently Deleted
                </DropdownMenuItem>
              )}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      {!missingUpload ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "absolute right-2 bottom-2 z-20 size-11 rounded-full bg-transparent p-0 opacity-100 transition-opacity hover:bg-transparent focus-visible:ring-2 sm:size-8 sm:opacity-0 sm:group-hover/card:opacity-100 sm:focus:opacity-100 dark:hover:bg-transparent",
            selected && "opacity-100 sm:opacity-100",
            viewMode === "list" &&
              "top-1/2 bottom-auto -translate-y-1/2 sm:opacity-100"
          )}
          disabled={
            pending ||
            (item.row?.source === "upload" && !item.row.document?.path)
          }
          onClick={() => onToggle()}
          aria-pressed={selected}
          aria-label={`${selected ? "Deselect" : "Select"} ${item.name}`}
        >
          <span
            className={cn(
              "border-muted-foreground/45 flex size-4 items-center justify-center rounded-full border-[1.5px] transition-[background-color,border-color]",
              selected && "border-foreground bg-foreground"
            )}
            aria-hidden
          >
            {selected ? (
              <IconCheck className="text-background size-2.5" />
            ) : null}
          </span>
        </Button>
      ) : null}
    </article>
  )
}
