import "server-only"
import type { ResponseOutputItem, ResponseOutputItemAddedEvent, ResponseTextDeltaEvent } from "openai/resources/responses/responses"

/** Commentary is not structured output. Older models omit message phases. */
export function researchAnswerText(output: ResponseOutputItem[]) {
  const messages = output.filter(item => item.type === "message")
  const phased = messages.some(item => item.phase != null)
  if (messages.some(item => item.phase != null && item.phase !== "commentary" && item.phase !== "final_answer"))
    throw new Error("Unknown answer phase.")
  const answers = phased ? messages.filter(item => item.phase === "final_answer") : messages
  if (answers.length !== 1 || (phased && messages.some(item => item.phase == null)) || answers[0].status !== "completed")
    throw new Error("Ambiguous or missing final answer.")
  return answers[0].content.flatMap(part => part.type === "output_text" ? [part.text] : []).join("")
}

/** Only route declared answer deltas to the existing bounded preview parser.
 * Legacy message declarations may omit phase; orphan deltas are ignored. */
export function createResearchAnswerPhaseGate() {
  const phases = new Map<string, "commentary" | "final_answer" | null>()
  let invalid = false, phased = false, answers = 0, legacy = 0
  const identity = (id: string, index: number) => JSON.stringify([id, index])
  return {
    observe(event: ResponseOutputItemAddedEvent) {
      if (event.item.type !== "message") return
      const key = identity(event.item.id, event.output_index), phase = event.item.phase ?? null
      if (phases.has(key) || (phase !== null && phase !== "commentary" && phase !== "final_answer")) {
        invalid = true
        return
      }
      phases.set(key, phase)
      if (phase !== null) phased = true
      if (phase === "final_answer") answers++
      if (phase === null) legacy++
      if (answers > 1 || legacy > 1 || (phased && legacy > 0)) invalid = true
    },
    get invalid() { return invalid },
    allows(event: ResponseTextDeltaEvent) {
      if (invalid) return false
      const key = identity(event.item_id, event.output_index)
      if (!phases.has(key)) return false
      const phase = phases.get(key)
      return phase === "final_answer" || (phase === null && !phased)
    },
  }
}
