import "server-only"
import { readAiRun } from "@/features/ai-credits"
import { aiRunProposal } from "../lib"
import type { AiDocumentTarget } from "../types"

export async function loadAiRevisionContext(id:string | undefined,target:AiDocumentTarget) {
  if (!id) return null
  const stored=await readAiRun(id,target.organizationId,target.userId)
  if (!stored) throw new Error("The draft to revise is unavailable.")
  const proposal=aiRunProposal(stored)
  if (proposal.status !== "succeeded" || proposal.application || proposal.target.sectionId !== target.sectionId ||
    proposal.target.revision !== target.revision || proposal.target.organizationId !== target.organizationId || proposal.target.userId !== target.userId)
    throw new Error("This draft no longer matches the selected document. Review the current document first.")
  return {id:proposal.id,content:proposal.content}
}
