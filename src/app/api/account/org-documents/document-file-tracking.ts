import type { createSupabaseRouteHandlerClient } from "@/lib/supabase/route"
import { createNotification } from "@/lib/notifications"
import { isLegacyDocumentPath } from "@/lib/organization/legacy-document-bindings"

type SupabaseClient = ReturnType<typeof createSupabaseRouteHandlerClient>

export function sanitizeTrackedDocumentFilename(name: string) {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-")
  return cleaned.length > 0 ? cleaned : "document.pdf"
}

export function isTrackedDocumentPath(
  path: string,
  orgId: string,
  documentKind: string
) {
  return isLegacyDocumentPath(path, orgId, documentKind)
}

export async function notifyTrackedDocumentUpload({
  supabase,
  userId,
  documentKind,
  filename,
}: {
  supabase: SupabaseClient
  userId: string
  documentKind: string
  filename: string
}) {
  const result = await createNotification(supabase, {
    userId,
    title: "Document uploaded",
    description: `${filename} added to your documents.`,
    href: "/organization/documents",
    tone: "success",
    type: "document_uploaded",
    actorId: userId,
    metadata: { kind: documentKind, filename },
  })
  if ("error" in result) {
    console.error("Failed to create document notification", result.error)
  }
}
