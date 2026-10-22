"use server"

import { z } from "zod"
import { readAiAccount, readAiRun, cancelAiRun } from "@/features/ai-credits"
import { loadAiDocument, requireAiActor } from "./document-context"
import { workspaceAiConfig } from "./config"
import { aiRunProposal } from "../lib"
import type { AiDocumentTarget } from "../types"

export async function quoteWorkspaceAi(target: AiDocumentTarget) {
  const config = workspaceAiConfig()
  const actor = await loadAiDocument(target)
  const account = await readAiAccount(actor.organizationId,actor.userId)
  if (!account.enabled) throw new Error("AI assistance is not enabled for this organization.")
  return { maximumCredits: config.maxCredits, tariffVersion: config.tariff.version, account }
}
export async function readWorkspaceAiProposal(id: string,target: AiDocumentTarget) {
  z.uuid().parse(id)
  const actor = await requireAiActor(target)
  const run = await readAiRun(id,actor.organizationId,actor.userId)
  if (!run) throw new Error("This AI request is unavailable.")
  return aiRunProposal(run)
}
export async function cancelWorkspaceAi(id: string,target: AiDocumentTarget) {
  z.uuid().parse(id)
  const actor = await requireAiActor(target)
  return cancelAiRun(id,actor.organizationId,actor.userId)
}
