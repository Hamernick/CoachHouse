// Synthetic generation and private draft/plan transport; actual source commands
// and receipt recovery are bridged to an explicitly disposable local SQL DB.
import { useState } from "react"
import { createRoot } from "react-dom/client"
import { Button } from "@/components/ui/button"
import { ResearchDraftEditor } from "@/features/workspace-ai/components/research-draft-editor"
import { ResearchPlanPresentation } from "@/features/workspace-ai/components/research-presentation"
import { ResearchSourceEffects } from "@/features/workspace-ai/components/research-source-effects"
import { createResearchDraft, applyResearchDraft } from "@/features/workspace-ai/lib/research-draft"
import { prepareReviewedResearchSources } from "@/features/workspace-ai/lib/research-source-application"
import { applyResearchDataViewEffects, inspectResearchDataViewEffects } from "@/features/workspace-ai/server/research-data-view-effects"
import type { ResearchSourceEffect } from "@/features/workspace-ai/lib/research-data-view"
import type { ResearchResult } from "@/features/workspace-ai/research-types"
const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const result: ResearchResult = { runId: id(2500), target: { organizationId: id(1), objectiveId: id(2501), revision: 0 }, title: "Project review", summary: "Default saved view", questions: [], sources: [], decisions: [], items: [
  { key: "projects", kind: "data_view", title: "Projects", description: "Existing source", dataView: { kind: "projects" }, referenceId: null, evidenceIds: [], dependsOn: [] },
], outputBindings: [{ kind: "data_view", itemKey: "projects", viewId: id(2502), requestId: id(2503) }] }
const key = "synthetic-source-draft"
function Fixture() {
  const [draft, setDraft] = useState(() => JSON.parse(sessionStorage.getItem(key) ?? "null") ?? createResearchDraft(result))
  const [attempted, setAttempted] = useState(() => sessionStorage.getItem(key) !== null)
  const [effects, setEffects] = useState<ResearchSourceEffect[]>([]), [error, setError] = useState<string | null>(null)
  const [plan, setPlan] = useState<"pending" | "applied" | "unconfirmed">("pending")
  const edited = applyResearchDraft(result, draft)
  async function apply() {
    const ready = await prepareReviewedResearchSources({ result, draft, isCurrent: () => true,
      saveDraft: async value => { sessionStorage.setItem(key, JSON.stringify(value)); setAttempted(true); return true },
      applySources: async () => { const next = await applyResearchDataViewEffects(edited); setEffects(next); return next.every(effect => effect.status === "created") },
    })
    if (ready.ready) { setPlan("unconfirmed"); setError("Synthetic plan transaction failed. Source effects remain.") }
  }
  async function check() { setEffects(await inspectResearchDataViewEffects(edited)) }
  return <main>
    <p>Synthetic generation, private draft and failed plan; real disposable source SQL.</p>
    <ResearchPlanPresentation result={edited} />
    <ResearchDraftEditor result={result} draft={draft} onChange={setDraft} disabled={attempted} />
    <Button onClick={() => { void apply() }}>Apply reviewed output</Button>
    <ResearchSourceEffects available organizationId={id(1)} effects={effects} error={error} pending={false} plan={plan} onCheck={() => { void check() }} />
  </main>
}
createRoot(document.getElementById("root")!).render(<Fixture />)
