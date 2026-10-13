"use client"

import { useCallback, useEffect, useState } from "react"

import { toast } from "@/lib/toast"
import { downloadFile as saveDownload } from "@/lib/download-file"
import { ORGANIZATION_DOCUMENT_QUOTA_BYTES } from "@/lib/organization/document-storage"
import type { DocumentActionOptions } from "./use-documents-library-selection"
import { MAX_BYTES, MAX_UPLOAD_MB } from "../constants"

export { ORGANIZATION_DOCUMENT_QUOTA_BYTES } from "@/lib/organization/document-storage"

export type OrganizationDocumentFile = {
  id: string
  coreSectionId?: string
  name: string
  mimeType: string
  sizeBytes: number
  deletedAt: string | null
  createdAt: string
  updatedAt: string
}

type FilesResponse = {
  hasStorageAccess?: boolean
  files?: OrganizationDocumentFile[]
  quota?: {
    usedBytes: number
    limitBytes: number
  }
  error?: string
}

async function readResponseError(response: Response) {
  const payload = (await response.json().catch(() => null)) as {
    error?: string
  } | null
  return payload?.error ?? "Unable to upload file."
}

export function useOrganizationDocumentFiles(refreshKey = "") {
  const [hasStorageAccess, setHasStorageAccess] = useState(false)
  const [files, setFiles] = useState<OrganizationDocumentFile[]>([])
  const [usedBytes, setUsedBytes] = useState(0)
  const [limitBytes, setLimitBytes] = useState(
    ORGANIZATION_DOCUMENT_QUOTA_BYTES
  )
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadingCoreSectionId, setUploadingCoreSectionId] = useState<
    string | null
  >(null)
  const [pendingFileIds, setPendingFileIds] = useState<string[]>([])

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/account/organization-document-files", {
        cache: "no-store",
      })
      const payload = (await response
        .json()
        .catch(() => null)) as FilesResponse | null
      if (!response.ok) {
        throw new Error(payload?.error ?? "Unable to load uploaded files.")
      }
      setHasStorageAccess(payload?.hasStorageAccess === true)
      setFiles(payload?.files ?? [])
      setUsedBytes(payload?.quota?.usedBytes ?? 0)
      setLimitBytes(
        payload?.quota?.limitBytes ?? ORGANIZATION_DOCUMENT_QUOTA_BYTES
      )
    } catch (error: unknown) {
      setHasStorageAccess(false)
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to load uploaded files."
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load, refreshKey])

  const uploadFiles = useCallback(
    async (selectedFiles: File[], coreSectionId?: string) => {
      if (selectedFiles.length === 0 || uploading) return
      if (coreSectionId && selectedFiles.length !== 1) {
        toast.error("Drop one file into this document slot.")
        return
      }

      const invalidFile = selectedFiles.find(
        (file) => file.size === 0 || file.size > MAX_BYTES
      )
      if (invalidFile) {
        toast.error(
          invalidFile.size === 0
            ? `${invalidFile.name} is empty.`
            : `${invalidFile.name} is too large. Max size is ${MAX_UPLOAD_MB} MB.`
        )
        return
      }

      const batchBytes = selectedFiles.reduce(
        (total, file) => total + file.size,
        0
      )
      if (usedBytes + batchBytes > limitBytes) {
        toast.error(
          "These files exceed the organization’s remaining document storage."
        )
        return
      }

      setUploading(true)
      setUploadingCoreSectionId(coreSectionId ?? null)
      const toastId = toast.loading(
        selectedFiles.length === 1
          ? `Uploading ${selectedFiles[0]?.name ?? "file"}…`
          : `Uploading ${selectedFiles.length} files…`
      )
      let uploadedCount = 0

      try {
        for (const file of selectedFiles) {
          const form = new FormData()
          form.set("file", file)
          if (coreSectionId) form.set("coreSectionId", coreSectionId)
          const response = await fetch(
            "/api/account/organization-document-files",
            { method: "POST", body: form }
          )
          if (!response.ok) {
            throw new Error(await readResponseError(response))
          }
          const payload = (await response.json()) as {
            file: OrganizationDocumentFile
          }
          setFiles((current) => [payload.file, ...current])
          setUsedBytes((current) => current + payload.file.sizeBytes)
          uploadedCount += 1
        }

        toast.success(
          uploadedCount === 1
            ? "File uploaded"
            : `${uploadedCount} files uploaded`,
          { id: toastId }
        )
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : "Upload failed.", {
          id: toastId,
        })
      } finally {
        setUploading(false)
        setUploadingCoreSectionId(null)
      }
    },
    [limitBytes, uploading, usedBytes]
  )

  const openFile = useCallback(async (file: OrganizationDocumentFile) => {
    try {
      const response = await fetch(
        `/api/account/organization-document-files?id=${encodeURIComponent(file.id)}`,
        { cache: "no-store" }
      )
      const payload = (await response.json().catch(() => null)) as {
        url?: string
        error?: string
      } | null
      if (!response.ok || !payload?.url) {
        throw new Error(payload?.error ?? "Unable to open file.")
      }
      window.open(payload.url, "_blank", "noopener,noreferrer")
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Unable to open file."
      )
    }
  }, [])

  const downloadFile = useCallback(
    async (
      file: OrganizationDocumentFile,
      options: DocumentActionOptions = {}
    ) => {
      try {
        const response = await fetch(
          `/api/account/organization-document-files?id=${encodeURIComponent(file.id)}&download=true`,
          { cache: "no-store" }
        )
        const payload = (await response.json().catch(() => null)) as {
          url?: string
          error?: string
        } | null
        if (!response.ok || !payload?.url) {
          throw new Error(payload?.error ?? "Unable to download file.")
        }
        await saveDownload(payload.url, file.name)
      } catch (error: unknown) {
        toast.error(
          error instanceof Error ? error.message : "Unable to download file."
        )
        if (options.throwOnError) throw error
      }
    },
    []
  )

  const updateFileLifecycle = useCallback(
    async (file: OrganizationDocumentFile, action: "trash" | "restore") => {
      setPendingFileIds((current) => [...current, file.id])
      try {
        const response = await fetch(
          "/api/account/organization-document-files",
          {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ id: file.id, action }),
          }
        )
        if (!response.ok) throw new Error(await readResponseError(response))
        const payload = (await response.json()) as {
          file: OrganizationDocumentFile
        }
        setFiles((current) =>
          current.map((item) =>
            item.id === payload.file.id ? payload.file : item
          )
        )
        return payload.file
      } finally {
        setPendingFileIds((current) => current.filter((id) => id !== file.id))
      }
    },
    []
  )

  const restoreFile = useCallback(
    async (file: OrganizationDocumentFile) => {
      try {
        await updateFileLifecycle(file, "restore")
        toast.success("File restored")
      } catch (error: unknown) {
        toast.error(
          error instanceof Error ? error.message : "Unable to restore file."
        )
      }
    },
    [updateFileLifecycle]
  )

  const trashFile = useCallback(
    async (
      file: OrganizationDocumentFile,
      options: DocumentActionOptions = {}
    ) => {
      try {
        const trashedFile = await updateFileLifecycle(file, "trash")
        toast.success("Moved to Recently Deleted", {
          action: {
            label: "Undo",
            onClick: () => void restoreFile(trashedFile),
          },
        })
      } catch (error: unknown) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Unable to move file to Recently Deleted."
        )
        if (options.throwOnError) throw error
      }
    },
    [restoreFile, updateFileLifecycle]
  )

  const permanentlyDeleteFile = useCallback(
    async (
      file: OrganizationDocumentFile,
      options: DocumentActionOptions = {}
    ) => {
      setPendingFileIds((current) => [...current, file.id])
      try {
        const response = await fetch(
          "/api/account/organization-document-files",
          {
            method: "DELETE",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ id: file.id }),
          }
        )
        if (!response.ok) throw new Error(await readResponseError(response))
        setFiles((current) => current.filter((item) => item.id !== file.id))
        setUsedBytes((current) => Math.max(0, current - file.sizeBytes))
        toast.success("File permanently deleted")
      } catch (error: unknown) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Unable to permanently delete file."
        )
        if (options.throwOnError) throw error
      } finally {
        setPendingFileIds((current) => current.filter((id) => id !== file.id))
      }
    },
    []
  )

  return {
    hasStorageAccess,
    downloadFile,
    files,
    limitBytes,
    loading,
    openFile,
    pendingFileIds,
    permanentlyDeleteFile,
    restoreFile,
    trashFile,
    uploadFiles,
    uploading,
    uploadingCoreSectionId,
    usedBytes,
  }
}
