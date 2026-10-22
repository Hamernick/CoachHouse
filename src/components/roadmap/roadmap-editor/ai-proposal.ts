import type { Dispatch, RefObject, SetStateAction } from "react"
import type { AiDocumentProposal } from "@/features/workspace-ai/client"
import type { RoadmapSection } from "@/lib/roadmap"
import type { RoadmapDraft } from "./types"
import { isRoadmapDraftDirty } from "./helpers"

export function applyRoadmapAiProposal({ proposal, sourceScope, canEdit, busy, sectionsRef, draftsRef, activeIdRef, setDrafts }: {
  proposal: AiDocumentProposal
  sourceScope?: { userId: string; organizationId: string }
  canEdit: boolean; busy: boolean
  sectionsRef: RefObject<RoadmapSection[]>
  draftsRef: RefObject<Record<string,RoadmapDraft>>
  activeIdRef: RefObject<string>
  setDrafts: Dispatch<SetStateAction<Record<string,RoadmapDraft>>>
}) {
  const target = proposal.target
  const section = sectionsRef.current.find(item => item.id === target.sectionId)
  const draft = section && draftsRef.current[section.id]
  if (!canEdit || busy || proposal.status !== "succeeded" || !section || !draft ||
    target.organizationId !== sourceScope?.organizationId || target.userId !== sourceScope?.userId ||
    activeIdRef.current !== section.id || section.driveSource || section.lastUpdated !== target.revision ||
    isRoadmapDraftDirty(section,draft) || draft.content !== proposal.original) return false
  const next = { ...draft, content: proposal.content, requiresPrivateSave: true }
  draftsRef.current = { ...draftsRef.current, [section.id]: next }
  setDrafts(draftsRef.current)
  return true
}
