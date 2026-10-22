import type { RoadmapSection } from "@/lib/roadmap"
import type { RoadmapDraft } from "./types"
import { createDraft,isRoadmapDraftDirty } from "./helpers"

export function acknowledgeRoadmapDraftSave(current:RoadmapDraft,submitted:RoadmapDraft,saved:RoadmapSection,replayed=false) {
  const retained = { ...current,lastUpdated:saved.lastUpdated,
    ...(current.aiRunId === submitted.aiRunId ? {aiRunId:undefined,requiresPrivateSave:false} : {}) }
  // A retried lost response may acknowledge an earlier version of this draft.
  // Keep later typing and let the normal CAS autosave persist it next.
  if (current !== submitted || (replayed && isRoadmapDraftDirty(saved,retained))) return retained
  return createDraft(saved)
}
