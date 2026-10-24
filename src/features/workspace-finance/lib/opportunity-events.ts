export const OPPORTUNITY_CHANGED = "workspace-opportunity-changed"
export function notifyOpportunityChanged(id: string) {
  window.dispatchEvent(new CustomEvent(OPPORTUNITY_CHANGED, { detail: id }))
}
