import { ResearchEmbeddingDisclosure } from "./research-embedding-disclosure"
import type { z } from "zod"
import type { researchSnapshotSchema } from "../lib/research-snapshot"

export type ResearchRunReceiptValue = Pick<z.infer<typeof researchSnapshotSchema>, "id" | "status" | "credits" | "processing">

export function ResearchRunReceipt({ run, hidden = false }: { run: ResearchRunReceiptValue | null; hidden?: boolean }) {
  if (!run || hidden) return null
  const settled = ["succeeded", "failed", "canceled"].includes(run.status) && run.credits !== null
  return <section aria-label="Research run receipt" className="space-y-1 break-words text-xs text-muted-foreground">
    <details>
      <summary className="cursor-pointer rounded-sm py-1 focus-visible:outline-2 focus-visible:outline-ring">{settled ? `${run.credits!.toLocaleString()} credits charged.` : "Credit charge not yet confirmed."}</summary>
      <div className="space-y-1 pt-1">
        {run.processing && <p>Maximum approved: {run.processing.maximumCredits.toLocaleString()} credits.</p>}
        <p>{run.processing ? `${run.processing.provider} · ${run.processing.model}` : "Saved provider and model details unavailable."}</p>
        {run.processing?.embedding && <ResearchEmbeddingDisclosure embedding={run.processing.embedding} />}
        {run.processing?.embeddingUnavailable && <p>Saved document processing details unavailable.</p>}
      </div>
    </details>
  </section>
}
