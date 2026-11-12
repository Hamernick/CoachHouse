"use client"

import { profileDocumentLibrarySchema } from "@/lib/organization/document-library-schema"
import { documentLibraryUrl, useDocumentLibraryRead, type DocumentLibraryScope } from "./use-document-library-read"

async function readProfileLibrary(signal: AbortSignal, scope: DocumentLibraryScope) {
  const response = await fetch(documentLibraryUrl("/api/account/organization-document-library", scope), { cache: "no-store", signal })
  if (!response.ok) throw new Error("Documents unavailable.")
  const data = profileDocumentLibrarySchema.parse(await response.json())
  if (data.userId !== scope.userId || data.organizationId !== scope.organizationId) throw new Error("Document scope changed.")
  return data
}

export function useProfileDocumentLibrary(scope: DocumentLibraryScope, refreshKey: string) {
  return useDocumentLibraryRead(scope, readProfileLibrary, refreshKey)
}
export type ProfileDocumentLibrary = ReturnType<typeof useProfileDocumentLibrary>
