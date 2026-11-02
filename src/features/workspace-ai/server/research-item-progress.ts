import "server-only"
import type { ResponseTextDeltaEvent } from "openai/resources/responses/responses"
import type { ResearchSource } from "../research-types"
import { createResearchItemParser, researchItemPreviewSchema, type ResearchItemPreview } from "../lib/research-item-preview"
import { assertResearchOutputAvailability } from "./research-output-config"

/** Optional, bounded presentation. Source checks cover every observed input,
 * not just the citations the model chose to put on this item. */
export function createResearchItemProgress(input: {
  publish: (item: ResearchItemPreview | null) => void
  revalidate: () => Promise<boolean>
  isCanceled: () => Promise<boolean>
  evidence: (ids: readonly string[]) => ResearchSource[]
}) {
  const parse = createResearchItemParser()
  let part: string | undefined, sequence = -1, disabled = false, shown = false
  const clear = () => {
    if (shown) {
      shown = false
      try { input.publish(null) } catch { disabled = true }
    }
  }
  return {
    clear,
    async push(event: ResponseTextDeltaEvent) {
      if (disabled) return
      try {
        const identity = JSON.stringify([event.item_id, event.output_index, event.content_index])
        if ((part && part !== identity) || event.sequence_number <= sequence) throw new Error("Changed output part.")
        part = identity; sequence = event.sequence_number
        const parsed = parse(event.delta)
        if (parsed.invalid) throw new Error("Invalid preview frame.")
        if (!parsed.items.length) return
        assertResearchOutputAvailability(parsed.items)
        const sources = input.evidence(parsed.items.flatMap(item => [...item.evidenceIds, ...(item.referenceId ? [item.referenceId] : [])]))
        for (const item of parsed.items) {
          if (item.evidenceIds.some(id => !sources.some(source => source.id === id)) ||
            (item.kind === "reference" ? !sources.some(source => source.kind === "workspace" && source.id === item.referenceId) : item.referenceId !== null))
            throw new Error("Unavailable preview evidence.")
        }
        if (!await input.revalidate() || await input.isCanceled()) throw new Error("Preview access changed.")
        for (const item of parsed.items) { shown = true; input.publish(researchItemPreviewSchema.parse({ key: item.key, title: item.title, kind: item.kind, description: item.description,
          ...(item.form ? { form: item.form } : {}) })) }
      } catch {
        disabled = true; clear()
        // Presentation failure cannot discard measured usage or create a retry.
      }
    },
  }
}
