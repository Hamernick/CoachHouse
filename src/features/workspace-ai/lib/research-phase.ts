import { z } from "zod"

export const researchPhaseSchema = z.enum(["planning", "searching", "reading", "validating", "repairing", "saving", "recovering"])
export type ResearchPhase = z.infer<typeof researchPhaseSchema>
export const researchPhaseLabels: Record<ResearchPhase, string> = {
  planning: "Developing the plan…", searching: "Finding workspace sources…",
  reading: "Reading workspace sources…", validating: "Checking the proposed plan…",
  repairing: "Refining the plan…",
  saving: "Saving research…", recovering: "Checking saved research…",
}
