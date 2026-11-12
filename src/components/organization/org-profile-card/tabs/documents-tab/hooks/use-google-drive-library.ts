"use client"

import { useCallback, useState } from "react"

import { z } from "zod"
import { documentLibraryUrl, useDocumentLibraryRead, type DocumentLibraryScope } from "./use-document-library-read"

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

const documentsSchema = z.object({ ok: z.literal(true), documents: z.array(z.object({
  id: z.string(), name: z.string(), mimeType: z.string(), webViewLink: z.string(), modifiedAt: z.string().nullable(),
  status: z.enum(["available", "trashed", "inaccessible", "needs_reconnect"]),
})) })
const connectionSchema = z.object({ ok: z.literal(true), connection: z.object({ connected: z.boolean() }) })
async function readLibrary(signal: AbortSignal, scope: DocumentLibraryScope) {
  const [connection, documents] = await Promise.all([
    fetch(documentLibraryUrl("/api/integrations/google-drive/connection", scope), { cache: "no-store", signal }),
    fetch(documentLibraryUrl("/api/integrations/google-drive/documents", scope), { cache: "no-store", signal }),
  ])
  if (!connection.ok || !documents.ok) throw new Error("Documents unavailable.")
  return { connected: connectionSchema.parse(await connection.json()).connection.connected, documents: documentsSchema.parse(await documents.json()).documents }
}

export function useGoogleDriveLibrary({
  enabled, scope, inWorkspace = false,
}: { enabled: boolean; scope: DocumentLibraryScope; inWorkspace?: boolean }) {
  const library = useDocumentLibraryRead(scope, readLibrary)
  const { refresh, captureUpdate } = library
  const documents = library.data?.documents ?? []
  const connected = library.data?.connected ?? false
  const [pending, setPending] = useState(false)
  const endpoint = documentLibraryUrl("/api/integrations/google-drive/documents", scope)
  const connectEndpoint = documentLibraryUrl("/api/integrations/google-drive/connect", scope)
  const { organizationId, userId } = scope
  const detachEndpoint = useCallback((id: string) => documentLibraryUrl(`/api/integrations/google-drive/documents/${encodeURIComponent(id)}`, { organizationId, userId }), [organizationId, userId])

  const attachSelectedFiles = useCallback(
    async (fileIds: string[]) => {
      const response = await fetch(endpoint, {
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
    [refresh, endpoint]
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
      const response = await fetch(connectEndpoint, {
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
  }, [connected, enabled, inWorkspace, openPicker, pending, connectEndpoint])

  const detachDocument = useCallback(
    async (documentId: string, options: DocumentActionOptions = {}) => {
      const update = captureUpdate()
      const response = await fetch(
        detachEndpoint(documentId),
        { method: "DELETE" }
      )
      const result = await readDriveResponse(response)
      if (!response.ok) {
        toast.error(driveErrorMessage(result?.code))
        if (options.throwOnError)
          throw new Error(driveErrorMessage(result?.code))
        return
      }
      update(current => ({ ...current, documents: current.documents.filter(document => document.id !== documentId) }))
      toast.success("Google Drive file removed")
    },
    [captureUpdate, detachEndpoint]
  )

  return {
    connected,
    connectOrPick,
    detachDocument,
    documents,
    loading: library.loading,
    error: library.error,
    pending,
    refresh,
  }
}
