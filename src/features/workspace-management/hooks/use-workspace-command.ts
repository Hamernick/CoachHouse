"use client"

import { useRef, useState } from "react"
import { saveWorkspaceCommand } from "../server/actions"
import type { WorkspaceCommand } from "../lib"

export function useWorkspaceCommand() {
  const saving = useRef(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function save(command: WorkspaceCommand) {
    if (saving.current) return null
    saving.current = true
    setPending(true)
    setError(null)
    try {
      const result = await saveWorkspaceCommand(command)
      if ("error" in result) {
        setError(result.error ?? "Unable to save workspace.")
        return null
      }
      return result
    } catch {
      setError("Unable to confirm the save. Retry to confirm your workspace.")
      return null
    } finally {
      saving.current = false
      setPending(false)
    }
  }
  return { pending, error, save }
}
