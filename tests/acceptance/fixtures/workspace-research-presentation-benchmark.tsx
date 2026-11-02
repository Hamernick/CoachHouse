// Deterministic local benchmark: fixed artifacts, shared app/SDK foundation, no model or source actions.
import "@/app/globals.css"
import { useEffect, useState } from "react"
import { createRoot } from "react-dom/client"
import { ResearchReview } from "@/features/workspace-ai/components/research-review"
import { ResearchDraftEditor } from "@/features/workspace-ai/components/research-draft-editor"
import { applyResearchDraft, createResearchDraft } from "@/features/workspace-ai/lib/research-draft"
import type { ResearchResult } from "@/features/workspace-ai/research-types"
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const item = (n: number) => ({ key: `note_${n}`, title: `Note ${n}`, description: `Draft ${n}: confirm the next action with the team.`, kind: "note" as const, referenceId: null, evidenceIds: [], dependsOn: [] })
const mixed = new URLSearchParams(location.search).get("mixed") === "1"
const result: ResearchResult = { runId: id(8), target: { organizationId: id(1), objectiveId: id(2), revision: 0 }, title: "Review plan", summary: "Fixed local artifact", sources: [], questions: [], decisions: [], removeReferences: [], unfulfilled: [],
  items: mixed ? [item(0), { ...item(1), kind: "form", form: { questions: [{ id: id(10), type: "text", label: "Your name", required: true }] } }, { ...item(2), kind: "data_view", dataView: { kind: "projects" } }] : Array.from({ length: 12 }, (_, index) => item(index)),
}
const started = performance.now()
type Metrics = { firstCommitMs: number; updates: number[]; update: () => void; ready: number }
const metrics: Metrics = { firstCommitMs: 0, updates: [], update: () => {}, ready: 0 }
Object.assign(window, { presentationBenchmark: metrics })
function Fixture() {
  const [draft, setDraft] = useState(() => createResearchDraft(result)), [progress, setProgress] = useState(0)
  useEffect(() => { metrics.firstCommitMs = performance.now() - started; metrics.update = () => { metrics.updates.push(performance.now()); setProgress(value => value + 1) } }, [])
  useEffect(() => { if (progress) metrics.updates[progress - 1] = performance.now() - metrics.updates[progress - 1]; metrics.ready = progress }, [progress])
  const incoming = { ...result, title: "Incoming plan", items: Array.from({ length: 12 }, (_, index) => ({ ...item(index), description: `Update ${progress}: ${item(index).description}` })) }
  return <main>
    <section aria-label="Reviewed artifact"><ResearchReview result={applyResearchDraft(result, draft)} /></section>
    <ResearchDraftEditor result={result} draft={draft} onChange={setDraft} disabled={false} />
    <section aria-label="Incoming artifact"><ResearchReview result={incoming} /></section>
  </main>
}
createRoot(document.getElementById("root")!).render(<Fixture />)
