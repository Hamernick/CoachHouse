// Synthetic saved evidence only; actual source popovers, no source calls.
import { createRoot } from "react-dom/client"
import { ResearchSources } from "@/features/workspace-ai/components/research-sources"
import type { ResearchSource } from "@/features/workspace-ai/research-types"
const base: ResearchSource = { id: "person:known", title: "Jordan", href: "/workspace", revision: "1", checkedAt: "2026-11-02T00:00:00.000Z", kind: "workspace",
  evidence: { version: 1, coverage: "complete", scope: "record", checkedAt: "2026-11-02T00:00:00.000Z", readAt: "2026-11-02T00:00:00.000Z", characters: 80, contactFields: ["email", "details.organization"] } }
const legacy: ResearchSource = { ...base, id: "person:legacy", title: "Legacy contact", evidence: { ...base.evidence!, contactFields: undefined } }
createRoot(document.getElementById("root")!).render(<main><ResearchSources sources={[base, legacy]} /></main>)
