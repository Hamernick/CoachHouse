import "server-only"
import { providerResearchSchema, providerFormResearchSchema, providerDataViewResearchSchema, providerWorkingResearchSchema } from "../research-types"

/** Disabled until the form binding and selected presentation pass release gates. */
export function researchFormOutputsEnabled() {
  return process.env.WORKSPACE_AI_FORM_OUTPUTS === "1" && process.env.NEXT_PUBLIC_WORKSPACE_AI_PRESENTATION === "1"
}
export function researchDataViewOutputsEnabled() {
  return process.env.WORKSPACE_AI_DATA_VIEW_OUTPUTS === "1" && process.env.NEXT_PUBLIC_WORKSPACE_AI_PRESENTATION === "1"
}
export function researchProviderOutputSchema() {
  return researchDataViewOutputsEnabled() ? researchFormOutputsEnabled() ? providerWorkingResearchSchema : providerDataViewResearchSchema
    : researchFormOutputsEnabled() ? providerFormResearchSchema : providerResearchSchema
}

export function assertResearchOutputAvailability(items: readonly { kind: string }[]) {
  if (items.some(item => item.kind === "form") && !researchFormOutputsEnabled())
    throw new Error("AI form drafts are not enabled for this workspace.")
  if (items.some(item => item.kind === "data_view") && !researchDataViewOutputsEnabled())
    throw new Error("AI data views are not enabled for this workspace.")
}
