"use client"
import { useCallback, type Dispatch, type SetStateAction, type RefObject } from "react"
import { notifyNotesChanged } from "@/lib/modules/notes-events"
import type { ParticleBatch, ParticleCommit, ParticleGraph, ParticleResult } from "../types"
import type { createParticleHistory } from "../lib/particle-history"

export type ResearchTransport = (input: { runId: string; objectiveId: string; organizationId: string }) => Promise<ParticleResult<ParticleCommit>>
export function useParticleResearch({ researchTransport, canEdit, workspaceId, current: currentRef, inFlight: inFlightRef, retryBatch: retryBatchRef, history, setPending, setError, setSaved, setResult }: {
  researchTransport?: ResearchTransport
  canEdit: boolean
  workspaceId: string
  current: RefObject<ParticleResult<ParticleGraph>>
  inFlight: RefObject<boolean>
  retryBatch: RefObject<ParticleBatch | null>
  history: ReturnType<typeof createParticleHistory>
  setPending: Dispatch<SetStateAction<boolean>>
  setError: Dispatch<SetStateAction<string | null>>
  setSaved: Dispatch<SetStateAction<boolean>>
  setResult: Dispatch<SetStateAction<ParticleResult<ParticleGraph>>>
}) {
  return useCallback(async (runId: string, objectiveId: string) => {
    if (!researchTransport || !canEdit || !currentRef.current.ok || inFlightRef.current || retryBatchRef.current) return null
    inFlightRef.current = true
    setPending(true)
    setError(null)
    setSaved(false)
    try {
      const committed = await researchTransport({ runId, objectiveId, organizationId: workspaceId })
      if (!committed.ok) { setError(committed.error); return null }
      if (committed.value.graph.workspaceId !== workspaceId) throw new Error("Workspace changed.")
      // Proposal history is durable: review/reject it rather than deleting it via undo.
      history.observe(committed.value.graph)
      currentRef.current = { ok: true, value: committed.value.graph }
      setResult(currentRef.current)
      setSaved(true)
      notifyNotesChanged()
      return committed.value
    } catch {
      setError("Save interrupted. Add the saved proposal again to confirm; it will not be duplicated.")
      return null
    } finally {
      inFlightRef.current = false
      setPending(false)
    }
  }, [researchTransport, canEdit, workspaceId, history, currentRef, inFlightRef, retryBatchRef, setError, setPending, setResult, setSaved])

}
