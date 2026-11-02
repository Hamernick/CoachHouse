// Standalone synthetic browser fixture. No server, account, provider or source writer.
import { useEffect, useState } from "react"
import { createRoot } from "react-dom/client"
import { ResearchReview } from "@/features/workspace-ai/components/research-review"
import { ResearchDraftEditor } from "@/features/workspace-ai/components/research-draft-editor"
import { IncomingResearchPresentation } from "@/features/workspace-ai/components/research-presentation"
import { createResearchDraft, applyResearchDraft } from "@/features/workspace-ai/lib/research-draft"
import type { ResearchResult } from "@/features/workspace-ai/research-types"

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const result: ResearchResult = {
  runId: id(8), target: { organizationId: id(1), objectiveId: id(2), revision: 0 },
  title: "Event plan", summary: "Invitation draft", sources: [], questions: [], decisions: [], removeReferences: [],
  items: [{ key: "invite", title: "Invitation", kind: "note", description: "Hello neighbors,\nJoin us Friday.", dependsOn: [], evidenceIds: [], referenceId: null },
    { key: "signup", title: "Interest form", kind: "form", description: "Private draft", dependsOn: [], evidenceIds: [], referenceId: null,
      form: { questions: [{ id: id(10), label: "Your name", type: "text", required: true }] } }],
}
const startedAt = performance.now()
function Fixture() {
  const [draft, setDraft] = useState(() => createResearchDraft(result))
  const [count, setCount] = useState(1)
  useEffect(() => {
    Object.assign(window, { presentationFixture: {
      firstCommitMs: performance.now() - startedAt,
      append: () => setCount(value => value + 1),
    } })
  }, [])
  return <main>
    <ResearchReview result={applyResearchDraft(result, draft)} />
    <ResearchDraftEditor draft={draft} result={result} disabled={false} onChange={setDraft} />
    <IncomingResearchPresentation items={Array.from({ length: Math.min(count, 12) }, (_, index) => ({
      key: `incoming_${index}`, title: `Incoming ${index}`, kind: "note", description: "Unconfirmed draft",
    }))} />
  </main>
}
createRoot(document.getElementById("root")!).render(<Fixture />)
