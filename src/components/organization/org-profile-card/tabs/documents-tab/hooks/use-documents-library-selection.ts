"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "@/lib/toast"

import type { DriveLibraryDocument } from "./use-google-drive-library"
import type { OrganizationDocumentFile } from "./use-organization-document-files"
import type { DocumentIndexRow, DocumentsPolicyEntry } from "../types"

type SelectableLibraryItem = {
  id: string
  deleted: boolean
  row?: DocumentIndexRow
  uploadedFile?: OrganizationDocumentFile
  driveDocument?: DriveLibraryDocument
}

export type DocumentActionOptions = {
  confirm?: boolean
  throwOnError?: boolean
}

export type SelectionActions = {
  onDownloadUploadedFile: (
    file: OrganizationDocumentFile,
    options?: DocumentActionOptions
  ) => Promise<void>
  onDownloadUpload: (
    definition: Extract<DocumentIndexRow, { source: "upload" }>["definition"],
    options?: DocumentActionOptions
  ) => Promise<void>
  onDeleteUpload: (
    definition: Extract<DocumentIndexRow, { source: "upload" }>["definition"],
    options?: DocumentActionOptions
  ) => Promise<void>
  onDownloadPolicyDocument: (
    policy: DocumentsPolicyEntry,
    options?: DocumentActionOptions
  ) => Promise<void>
  onRemovePolicyDocument: (
    policy: DocumentsPolicyEntry,
    options?: DocumentActionOptions
  ) => Promise<void>
  onDetachDriveDocument: (
    documentId: string,
    options?: DocumentActionOptions
  ) => Promise<void>
  onTrashUploadedFile: (
    file: OrganizationDocumentFile,
    options?: DocumentActionOptions
  ) => Promise<void>
  onPermanentlyDeleteUploadedFile: (
    file: OrganizationDocumentFile,
    options?: DocumentActionOptions
  ) => Promise<void>
}

export function useDocumentsLibrarySelection({
  items,
  canEdit,
  canEditNative = true,
  editMode,
  actions,
}: {
  items: SelectableLibraryItem[]
  canEditNative?: boolean
  canEdit: boolean
  editMode: boolean
  actions: SelectionActions
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [pending, setPending] = useState(false)
  const selectedItems = useMemo(
    () => items.filter((item) => selectedIds.includes(item.id)),
    [items, selectedIds]
  )
  const canDownload =
    selectedItems.length > 0 &&
    selectedItems.every(
      (item) =>
        !item.deleted &&
        (Boolean(item.uploadedFile) ||
          (item.row?.source === "upload" && Boolean(item.row.document?.path)) ||
          (item.row?.source === "policy" &&
            Boolean(item.row.policy.document?.path)))
    )
  const canDelete =
    canEdit &&
    editMode &&
    selectedItems.length > 0 &&
    selectedItems.every((item) => canEditNative || Boolean(item.driveDocument)) &&
    selectedItems.every(
      (item) =>
        Boolean(item.uploadedFile) ||
        Boolean(item.driveDocument) ||
        (item.row?.source === "upload" && Boolean(item.row.document?.path)) ||
        (item.row?.source === "policy" &&
          Boolean(item.row.policy.document?.path))
    )

  useEffect(() => {
    const visibleIds = new Set(items.map((item) => item.id))
    setSelectedIds((current) => {
      const next = current.filter((id) => visibleIds.has(id))
      return next.length === current.length ? current : next
    })
  }, [items])

  const toggle = (itemId: string) => {
    if (pending) return
    setSelectedIds((current) =>
      current.includes(itemId)
        ? current.filter((id) => id !== itemId)
        : [...current, itemId]
    )
  }

  const runSelection = async (
    action: (item: SelectableLibraryItem) => Promise<void>
  ) => {
    setPending(true)
    const completed = new Set<string>()
    try {
      for (const item of selectedItems) {
        try {
          await action(item)
          completed.add(item.id)
        } catch {
          // Keep failures selected so the user can retry without reselecting.
        }
      }
      if (completed.size < selectedItems.length) {
        toast.error(
          "Some documents could not be processed. They remain selected."
        )
      }
      setSelectedIds((current) => current.filter((id) => !completed.has(id)))
    } finally {
      setPending(false)
    }
  }

  const download = async () => {
    if (!canDownload || pending) return
    await runSelection(async (item) => {
      if (item.uploadedFile) {
        await actions.onDownloadUploadedFile(item.uploadedFile, {
          throwOnError: true,
        })
      } else if (item.row?.source === "upload") {
        await actions.onDownloadUpload(item.row.definition, {
          throwOnError: true,
        })
      } else if (item.row?.source === "policy") {
        await actions.onDownloadPolicyDocument(item.row.policy, {
          throwOnError: true,
        })
      }
    })
  }

  const remove = async () => {
    if (!canDelete || pending) return
    const count = selectedItems.length
    if (
      !window.confirm(
        `Delete ${count} selected ${count === 1 ? "document" : "documents"}? This action cannot always be undone.`
      )
    ) {
      return
    }

    await runSelection(async (item) => {
      if (item.uploadedFile) {
        await (item.deleted
          ? actions.onPermanentlyDeleteUploadedFile(item.uploadedFile, {
              throwOnError: true,
            })
          : actions.onTrashUploadedFile(item.uploadedFile, {
              throwOnError: true,
            }))
      } else if (item.driveDocument) {
        await actions.onDetachDriveDocument(item.driveDocument.id, {
          throwOnError: true,
        })
      } else if (item.row?.source === "upload") {
        await actions.onDeleteUpload(item.row.definition, {
          confirm: false,
          throwOnError: true,
        })
      } else if (item.row?.source === "policy") {
        await actions.onRemovePolicyDocument(item.row.policy, {
          confirm: false,
          throwOnError: true,
        })
      }
    })
  }

  return {
    canDelete,
    canDownload,
    download,
    pending,
    remove,
    selectedIds,
    selectedItems,
    toggle,
  }
}
