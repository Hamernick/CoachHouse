"use client"

import { useState } from "react"
import { toast } from "sonner"

export function useParticleDrivePicker(
  enabled: boolean,
  refresh: () => Promise<void>,
  pickFiles: () => Promise<string[]>
) {
  const [pending, setPending] = useState(false)
  async function choose() {
    if (!enabled || pending) return
    setPending(true)
    try {
      const fileIds = await pickFiles()
      if (!fileIds.length) return
      const response = await fetch("/api/integrations/google-drive/documents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fileIds }),
      })
      if (!response.ok)
        throw new Error("Files could not be attached. Try again.")
      await refresh()
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Google Drive could not be opened."
      )
    } finally {
      setPending(false)
    }
  }
  return { pending, choose }
}
