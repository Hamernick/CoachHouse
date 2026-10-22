"use server"

import type { AiDocumentTarget } from "./types"
import { quoteWorkspaceAi, readWorkspaceAiProposal, cancelWorkspaceAi } from "./server/actions"

export async function quoteDocumentAssistance(target: AiDocumentTarget) { return quoteWorkspaceAi(target) }
export async function readDocumentAssistance(id: string,target: AiDocumentTarget) { return readWorkspaceAiProposal(id,target) }
export async function stopDocumentAssistance(id: string,target: AiDocumentTarget) { return cancelWorkspaceAi(id,target) }
