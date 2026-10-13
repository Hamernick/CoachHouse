"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { saveRoadmapSectionAction } from "@/actions/roadmap"
import { pickGoogleDriveFiles } from "@/features/google-drive/client"
import type { RoadmapSection } from "@/lib/roadmap"
import { toast } from "@/lib/toast"

export type CoreDocumentScope = { userId: string; organizationId: string }
export type CoreDocumentSection = Pick<
  RoadmapSection,
  "id" | "title" | "slug" | "lastUpdated" | "status" | "driveSource"
> & { content?: string }

export function useCoreDocumentSource(
  scope: CoreDocumentScope | undefined,
  onSaved?: (section: RoadmapSection) => void
) {
  const router = useRouter()
  const busy = useRef(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function change(
    section: CoreDocumentSection,
    mode: "drive" | "remove" | "editor"
  ) {
    if (!scope || busy.current) return false
    busy.current = true
    setPending(true)
    setError(null)
    try {
      let driveFileId: string | null = null
      if (mode === "drive") {
        const connection = await fetch(
          "/api/integrations/google-drive/connection",
          { cache: "no-store" }
        )
        const payload = await connection.json()
        if (!connection.ok || !payload.connection?.connected) {
          throw new Error(
            "Connect Google Drive in Tools, then return to choose a document."
          )
        }
        const ids = await pickGoogleDriveFiles(false)
        if (!ids.length) return false
        driveFileId = ids[0]
      }
      const result = await saveRoadmapSectionAction({
        sectionId: section.id,
        expectedOrganizationId: scope.organizationId,
        expectedUserId: scope.userId,
        expectedLastUpdated: section.lastUpdated,
        driveFileId,
        ...(mode === "remove" && !section.driveSource
          ? { content: "", budgetRows: [], status: "not_started" as const }
          : {}),
      })
      if ("error" in result) throw new Error(result.error)
      onSaved?.(result.section)
      router.refresh()
      toast.success(
        mode === "drive"
          ? `${section.title} linked to Google Drive`
          : mode === "remove"
            ? `${section.title} cleared`
            : "Editor draft restored"
      )
      return true
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : "Unable to update document. Try again."
      setError(message)
      toast.error(message)
      return false
    } finally {
      busy.current = false
      setPending(false)
    }
  }
  return { change, pending, error }
}
