import "server-only"

/** Disabled until the form binding and selected presentation pass release gates. */
export function researchFormOutputsEnabled() {
  return process.env.WORKSPACE_AI_FORM_OUTPUTS === "1" && process.env.NEXT_PUBLIC_WORKSPACE_AI_PRESENTATION === "1"
}

export function assertResearchOutputAvailability(items: readonly { kind: string }[]) {
  if (items.some(item => item.kind === "form") && !researchFormOutputsEnabled())
    throw new Error("AI form drafts are not enabled for this workspace.")
}
