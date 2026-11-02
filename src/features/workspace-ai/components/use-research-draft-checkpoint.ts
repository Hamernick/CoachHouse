import { useEffect, useEffectEvent, useRef, useState } from "react"
import { accessWorkspaceResearchDraft } from "../research-draft-actions"
import { validateResearchRecoveryDraft } from "../lib/research-draft"
import { researchDraftWriteSchema, researchDraftCheckpointSchema, type ResearchDraftCheckpoint, type ResearchDraftWrite } from "../lib/research-draft-checkpoint"
import type { ResearchResult, ResearchTarget } from "../research-types"

type Draft = NonNullable<ResearchDraftCheckpoint["draft"]>
const empty: ResearchDraftCheckpoint = { revision: 0, draft: null, attempted: false }

export function useResearchDraftCheckpoint(result: ResearchResult | null, target: ResearchTarget,
  onRestore: (draft: Draft, attempted: boolean) => void) {
  const base = result ? JSON.stringify(result) : null
  const [loaded, setLoaded] = useState<string | null>(null)
  const [checkpoint, setCheckpoint] = useState(empty)
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null)
  const [conflict, setConflict] = useState(false)
  const [retry, setRetry] = useState(0), [uncertain, setUncertain] = useState(false)
  const pending = useRef<ResearchDraftWrite | null>(null), working = useRef(false), epoch = useRef(0)
  const current = useRef(base); current.current = base
  const restore = useEffectEvent(onRestore)
  useEffect(() => {
    const version = ++epoch.current
    const cancel = () => { epoch.current = version + 1 }
    if (!result || loaded === base) { setBusy(false); if (pending.current) setUncertain(true); return cancel }
    setBusy(true); setError(null); setConflict(false); setUncertain(false); setCheckpoint(empty); pending.current = null
    void accessWorkspaceResearchDraft(result.runId, target).then(reply => {
      if (epoch.current !== version || current.current !== base) return
      if ("error" in reply) { setError(reply.error); return }
      const parsed = researchDraftCheckpointSchema.safeParse(reply.checkpoint)
      if (!parsed.success) { setError("Draft could not be verified. Retry."); return }
      if (parsed.data.draft) validateResearchRecoveryDraft(result, parsed.data.draft, parsed.data.attempted)
      setCheckpoint(parsed.data); setLoaded(base)
      if (parsed.data.draft) restore(parsed.data.draft, parsed.data.attempted)
    }).catch(() => {
      if (epoch.current === version) setError("Draft could not be loaded. Retry.")
    }).finally(() => { if (epoch.current === version) setBusy(false) })
    return cancel
    // Base includes the exact immutable run and target; transient source rechecks
    // withhold the UI without overwriting newer in-memory edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, retry])
  async function save(draft: Draft | null, attempted = false) {
    if (!result || loaded !== base || working.current || conflict) return false
    const desired = { draft, attempted }
    const operation = pending.current ?? researchDraftWriteSchema.parse({ ...desired, revision: checkpoint.revision, editId: crypto.randomUUID() })
    pending.current = operation; working.current = true; setBusy(true); setError(null)
    const version = epoch.current
    try {
      const reply = await accessWorkspaceResearchDraft(result.runId, target, operation)
      if (epoch.current !== version || current.current !== base) return false
      if ("error" in reply) { setError(reply.error); if (reply.conflict) { setConflict(true); pending.current = null } else setUncertain(true); return false }
      const saved = researchDraftCheckpointSchema.parse(reply.checkpoint)
      if (saved.revision !== operation.revision + 1 || JSON.stringify(saved.draft) !== JSON.stringify(operation.draft) || saved.attempted !== operation.attempted)
        throw new Error("Invalid acknowledgement")
      pending.current = null; setUncertain(false); setCheckpoint(saved)
      return operation.attempted === attempted && JSON.stringify(operation.draft) === JSON.stringify(draft === null ? null : researchDraftWriteSchema.parse({ ...desired, revision: checkpoint.revision, editId: operation.editId }).draft)
    } catch {
      if (epoch.current === version) { setError("Draft save unconfirmed. Retry the same save."); setUncertain(true) }
      return false
    } finally { working.current = false; if (epoch.current === version) setBusy(false) }
  }
  return { ready: Boolean(base && loaded === base && !conflict), busy, error, uncertain, conflict, checkpoint, save,
    retry: () => { if (pending.current) void save(pending.current.draft, pending.current.attempted); else setRetry(value => value + 1) } }
}
