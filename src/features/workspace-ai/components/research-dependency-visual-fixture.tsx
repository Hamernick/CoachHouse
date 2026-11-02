"use client"

import { useEffect, useState } from "react"
import { EventEncoder } from "@ag-ui/encoder"
import { ParticleButton } from "@/components/ui/particle-ui"
import { ResearchDraftEditor } from "./research-draft-editor"
import { IncomingResearchPresentation, ResearchPlanPresentation } from "./research-presentation"
import { applyResearchDraft, createResearchDraft } from "../lib/research-draft"
import { readResearchProgress } from "../lib/research-progress-client"
import { researchProgressWire, type ResearchProgress } from "../lib/research-progress"
import type { ResearchResult } from "../research-types"

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const result: ResearchResult = {
  runId: id(8), target: { organizationId: id(1), objectiveId: id(2), revision: 0 },
  title: "Community gathering", summary: "Synthetic dependency fixture", questions: [], sources: [], decisions: [], removeReferences: [],
  items: [
    { key: "invitation", title: "Invitation", kind: "note", description: "Hello neighbors,\nJoin our community gathering.", dependsOn: [], evidenceIds: [], referenceId: null },
    { key: "interest", title: "Interest form", kind: "form", description: "Private sample form", dependsOn: [], evidenceIds: [], referenceId: null,
      form: { questions: [{ id: id(10), label: "Your name", type: "text", required: true }] } },
  ],
}

/** Development visual route only. Uses real dependencies and components with
 * synthetic in-memory content; no auth, provider, source write or feature flag. */
export function ResearchDependencyVisualFixture() {
  const [draft, setDraft] = useState(() => createResearchDraft(result))
  const [phase, setPhase] = useState("Ready")
  const [incoming, setIncoming] = useState(0)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    const replay = async () => {
      const common = { version: 1 as const, streamId: id(9), runId: result.runId, requestId: result.runId,
        scope: { organizationId: id(1), canvasId: null, userId: id(3) }, target: result.target, emittedAt: "2026-11-02T00:00:00Z" }
      const events: ResearchProgress[] = [
        { ...common, sequence: 1, kind: "run.started", payload: {} },
        { ...common, sequence: 2, kind: "phase.changed", payload: { phase: "planning" } },
        { ...common, sequence: 3, kind: "run.terminal", payload: { status: "canceled" } },
      ]
      const encoder = new EventEncoder()
      const text = events.map(event => encoder.encode(researchProgressWire(event))).join("")
      await readResearchProgress(new Response(text, { headers: { "Content-Type": "text/event-stream" } }),
        { runId: result.runId, target: result.target, userId: id(3) }, setPhase, controller.signal)
      if (!controller.signal.aborted) setIncoming(value => value + 1)
    }
    const listener = () => { void replay() }
    window.addEventListener("particle-dependency-progress", listener)
    setReady(true)
    return () => { controller.abort(); window.removeEventListener("particle-dependency-progress", listener) }
  }, [])
  let edited: ResearchResult | undefined
  try { edited = applyResearchDraft(result, draft) } catch { /* Incomplete copy remains editable. */ }
  return <section data-progress-ready={ready} aria-label="Particle dependency qualification" className="particle-ui mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
    <header className="space-y-2">
      <h1 className="text-xl font-semibold">Particle dependency fixture</h1>
      <p className="text-sm text-muted-foreground">Synthetic local preview. Changes are temporary; no account or source is changed.</p>
    </header>
    <div aria-label="Typed artifact preview" className="min-w-0 rounded-2xl border border-border p-4">
      {edited ? <ResearchPlanPresentation result={edited} /> : <p role="status">Complete the draft to preview it.</p>}
    </div>
    <ResearchDraftEditor draft={draft} result={result} disabled={false} onChange={setDraft} />
    <ParticleButton className="min-h-11" color="secondary" variant="outline"
      onClick={() => window.dispatchEvent(new Event("particle-dependency-progress"))}>Replay</ParticleButton>
    <output className="block text-sm" aria-live="polite">Sample progress: {phase} · {incoming}</output>
    <IncomingResearchPresentation items={incoming ? [{ key: "sample", title: "Incoming sample", kind: "note", description: "Unconfirmed synthetic draft" }] : []} />
  </section>
}
