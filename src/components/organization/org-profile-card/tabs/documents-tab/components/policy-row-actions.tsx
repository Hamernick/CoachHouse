"use client"

import Download from "lucide-react/dist/esm/icons/download"
import ExternalLink from "lucide-react/dist/esm/icons/external-link"
import Trash2 from "lucide-react/dist/esm/icons/trash-2"

import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { DocumentsPolicyEntry, PolicyRow } from "../types"
import {
  DOCUMENT_ROW_MOBILE_ACTION_BUTTON_CLASSNAME,
  type DocumentRowActionPresentation,
  getDocumentRowActionButtonClassName,
  getDocumentRowActionButtonSize,
  getDocumentRowActionsClassName,
  shouldShowDocumentRowActionLabel,
} from "./document-row-action-styles"

type PolicyRowActionsProps = {
  row: PolicyRow
  canEdit: boolean
  editMode: boolean
  deleting: boolean
  viewingDocument: boolean
  downloadingDocument: boolean
  onEdit: (policy: DocumentsPolicyEntry) => void
  onDelete: (policy: DocumentsPolicyEntry) => Promise<void>
  onViewDocument: (policy: DocumentsPolicyEntry) => Promise<void>
  onDownloadDocument: (policy: DocumentsPolicyEntry) => Promise<void>
  presentation?: DocumentRowActionPresentation
}

export function PolicyRowActions({
  row,
  canEdit,
  editMode,
  deleting,
  viewingDocument,
  downloadingDocument,
  onEdit,
  onDelete,
  onViewDocument,
  onDownloadDocument,
  presentation = "table",
}: PolicyRowActionsProps) {
  const showLabels = shouldShowDocumentRowActionLabel(presentation)
  const framedButtonClassName =
    getDocumentRowActionButtonClassName(presentation)
  const framedButtonSize = getDocumentRowActionButtonSize(presentation)

  return (
    <div className={getDocumentRowActionsClassName(presentation)}>
      {row.policy.document?.path ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              size={framedButtonSize}
              variant="ghost"
              className={framedButtonClassName}
              disabled={viewingDocument}
              onClick={() => void onViewDocument(row.policy)}
              aria-label="View policy file"
            >
              <ExternalLink
                data-icon={showLabels ? "inline-start" : undefined}
                aria-hidden
              />
              {showLabels ? <span className="truncate">View</span> : null}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            {viewingDocument ? "Opening…" : "View"}
          </TooltipContent>
        </Tooltip>
      ) : null}
      {row.policy.document?.path ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              size={framedButtonSize}
              variant="ghost"
              className={framedButtonClassName}
              disabled={downloadingDocument}
              onClick={() => void onDownloadDocument(row.policy)}
              aria-label="Download policy file"
            >
              <Download
                data-icon={showLabels ? "inline-start" : undefined}
                aria-hidden
              />
              {showLabels ? <span className="truncate">Download</span> : null}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            {downloadingDocument ? "Preparing…" : "Download"}
          </TooltipContent>
        </Tooltip>
      ) : null}
      {canEdit && editMode ? (
        <>
          <Button
            type="button"
            size="sm"
            variant={presentation === "mobile" ? "ghost" : "secondary"}
            className={
              presentation === "mobile"
                ? DOCUMENT_ROW_MOBILE_ACTION_BUTTON_CLASSNAME
                : undefined
            }
            onClick={() => onEdit(row.policy)}
          >
            Edit
          </Button>
          <Button
            type="button"
            size={framedButtonSize}
            variant="ghost"
            className={getDocumentRowActionButtonClassName(
              presentation,
              "destructive"
            )}
            disabled={deleting}
            aria-label={`Delete ${row.policy.title}`}
            onClick={() => void onDelete(row.policy)}
          >
            <Trash2
              data-icon={showLabels ? "inline-start" : undefined}
              aria-hidden
            />
            {showLabels ? <span className="truncate">Delete</span> : null}
          </Button>
        </>
      ) : (
        <Button type="button" variant="ghost" size="sm" onClick={() => onEdit(row.policy)}>View policy</Button>
      )}
    </div>
  )
}
