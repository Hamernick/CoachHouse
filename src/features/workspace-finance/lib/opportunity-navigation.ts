export const OPEN_OPPORTUNITY = "coach-house:open-opportunity"
export function opportunityId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}
export function openOpportunityReport(id: string, orgId: string) {
  const event = new CustomEvent(OPEN_OPPORTUNITY, { detail: { id, orgId }, cancelable: true })
  window.dispatchEvent(event)
  return event.defaultPrevented
}
