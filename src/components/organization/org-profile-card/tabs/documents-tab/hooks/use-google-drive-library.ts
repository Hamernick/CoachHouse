"use client"

import { useCallback, useEffect, useState } from "react"

import {
  GoogleDrivePickerError,
  pickGoogleDriveFiles,
} from "@/features/google-drive/client"
import { toast } from "@/lib/toast"
import type { DocumentActionOptions } from "./use-documents-library-selection"

export type DriveLibraryDocument = {
  id: string
  name: string
  mimeType: string
  webViewLink: string
  modifiedAt: string | null
  status: "available" | "trashed" | "inaccessible" | "needs_reconnect"
}

type DriveResponse = {
  ok?: boolean
  code?: string
  authorizationUrl?: string
  connection?: { connected: boolean }
  documents?: DriveLibraryDocument[]
  attached?: number
  accessToken?: string
  developerKey?: string
  appId?: string
}

async function readDriveResponse(response: Response) {
  return (await response.json().catch(() => null)) as DriveResponse | null
}

function driveErrorMessage(code?: string) {
  if (code === "not_configured") return "Google Drive is not available yet."
  if (code === "forbidden")
    return "Only organization admins can add Drive files."
  if (code === "google_revoked" || code === "missing_refresh_token") {
    return "Reconnect Google Drive to continue."
  }
  return "Google Drive could not be reached. Try again."
}

export function useGoogleDriveLibrary({
  enabled,
  inWorkspace = false,
}: { enabled: boolean; inWorkspace?: boolean }) {
  const [documents, setDocuments] = useState<DriveLibraryDocument[]>([])
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [connectionResponse, documentsResponse] = await Promise.all([
        fetch("/api/integrations/google-drive/connection", {
          cache: "no-store",
        }),
        fetch("/api/integrations/google-drive/documents", {
          cache: "no-store",
        }),
      ])
      const connectionResult = await readDriveResponse(connectionResponse)
      const documentsResult = await readDriveResponse(documentsResponse)
      setConnected(Boolean(connectionResult?.connection?.connected))
      setDocuments(documentsResult?.documents ?? [])
    } catch {
      setConnected(false)
      setDocuments([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const attachSelectedFiles = useCallback(
    async (fileIds: string[]) => {
      const response = await fetch("/api/integrations/google-drive/documents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fileIds }),
      })
      const result = await readDriveResponse(response)
      if (!response.ok || typeof result?.attached !== "number") {
        throw new Error(result?.code ?? "provider_unavailable")
      }
      toast.success(
        result.attached === 1
          ? "Google Drive file added"
          : `${result.attached} Google Drive files added`
      )
      await refresh()
    },
    [refresh]
  )

  const openPicker = useCallback(async () => {
    const fileIds = await pickGoogleDriveFiles(true)
    if (fileIds.length) await attachSelectedFiles(fileIds)
  }, [attachSelectedFiles])

  const connectOrPick = useCallback(async () => {
    if (!enabled || pending) return
    setPending(true)
    try {
      if (connected) {
        await openPicker()
        return
      }
      const response = await fetch("/api/integrations/google-drive/connect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          returnPath: inWorkspace ? "/workspace/documents" : "/organization/documents",
        }),
      })
      const result = await readDriveResponse(response)
      if (!response.ok || !result?.authorizationUrl) {
        throw new Error(result?.code ?? "provider_unavailable")
      }
      window.location.assign(result.authorizationUrl)
    } catch (error) {
      toast.error(
        error instanceof GoogleDrivePickerError
          ? error.message
          : driveErrorMessage(
              error instanceof Error ? error.message : undefined
            )
      )
    } finally {
      setPending(false)
    }
  }, [connected, enabled, inWorkspace, openPicker, pending])

  const detachDocument = useCallback(
    async (documentId: string, options: DocumentActionOptions = {}) => {
      const response = await fetch(
        `/api/integrations/google-drive/documents/${encodeURIComponent(documentId)}`,
        { method: "DELETE" }
      )
      const result = await readDriveResponse(response)
      if (!response.ok) {
        toast.error(driveErrorMessage(result?.code))
        if (options.throwOnError)
          throw new Error(driveErrorMessage(result?.code))
        return
      }
      setDocuments((current) =>
        current.filter((document) => document.id !== documentId)
      )
      toast.success("Google Drive file removed")
    },
    []
  )

  return {
    connected,
    connectOrPick,
    detachDocument,
    documents,
    loading,
    pending,
    refresh,
  }
}
