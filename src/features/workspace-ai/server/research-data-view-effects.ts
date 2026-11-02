import "server-only"
import { createProjectDataViewCommandSchema, dataViewCreateReceiptSchema } from "@/features/workspace-data-views"
import { readProjectDataViewCreation, runDataViewCommand } from "@/features/workspace-data-views/server"
import { researchViewBinding, type ResearchSourceEffect } from "../lib/research-data-view"
import type { ResearchResult } from "../research-types"

export function researchDataViewCommands(result: ResearchResult) {
  return result.items.filter(item => item.kind === "data_view").map(item => {
    const binding = researchViewBinding(result.outputBindings, item.key)
    return { key: item.key, command: createProjectDataViewCommandSchema.parse({ action: "create_view", organizationId: result.target.organizationId,
      viewId: binding.viewId, requestId: binding.requestId, name: item.title, source: item.dataView }) }
  })
}

/** Read-only inspection proves the exact source operation, not merely that an
 * actor with access can find a view with the same public UUID. */
export async function inspectResearchDataViewEffects(result: ResearchResult): Promise<ResearchSourceEffect[]> {
  return Promise.all(researchDataViewCommands(result).map(async ({ key, command }) => {
    const reply = await readProjectDataViewCreation(command)
    const base = { key, kind: "data_view" as const, viewId: command.viewId, name: null }
    if (!reply.ok) return { ...base, status: reply.code === "denied" ? "denied" as const : reply.code === "conflict" ? "conflict" as const : "uncertain" as const,
      message: reply.code === "denied" ? "Current source access could not be verified. Creation status is unavailable." : "Creation could not be confirmed. Retry the same saved draft." }
    if (!reply.data.receipt) return { ...base, status: "not_created" as const, message: "No creation receipt for this exact request. The plan is unchanged." }
    if (!reply.data.view) return { ...base, status: "denied" as const, message: "Creation is confirmed, but the saved view is no longer available. It will not be recreated." }
    return { ...base, name: reply.data.view.name, status: "created" as const, message: "Saved view creation confirmed. Plan application is separate." }
  }))
}

/** Called only after explicit Apply and a verified durable attempted draft.
 * Completed effects are read, never executed again; failures remain per source. */
export async function applyResearchDataViewEffects(result: ResearchResult): Promise<ResearchSourceEffect[]> {
  const commands = researchDataViewCommands(result)
  const effects = await inspectResearchDataViewEffects(result)
  for (const [index, entry] of commands.entries()) {
    if (effects[index].status !== "not_created") continue
    const reply = await runDataViewCommand(entry.command)
    if (!reply.ok) {
      effects[index] = { ...effects[index], status: reply.code === "denied" ? "denied" : reply.code === "conflict" ? "conflict" : "uncertain", message: reply.error }
      continue
    }
    const receipt = dataViewCreateReceiptSchema.safeParse(reply.data)
    if (!receipt.success || receipt.data.viewId !== entry.command.viewId) {
      effects[index] = { ...effects[index], status: "uncertain", message: "The response did not confirm this view. Check its saved receipt before retrying." }
      continue
    }
    effects[index] = { ...effects[index], name: entry.command.name, status: "created", message: "Saved view created. Plan application is separate." }
  }
  return effects
}
