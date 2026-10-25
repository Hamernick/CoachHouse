"use client"
import { useEffect, useState } from "react"
import { getWorkspaceOpportunity } from "@/actions/workspace-opportunity-lifecycle"
import { OPPORTUNITY_CHANGED } from "../lib/opportunity-events"
import { OpportunityReportContent } from "./opportunity-report-content"
import { OpportunitySourcePill } from "./opportunity-source-pill"
import { sourceKey } from "../lib/opportunity-sources"
import { readOpportunityReport } from "../lib/opportunity-report"

export function WorkspaceOpportunityPreview({ organizationId, opportunityId }: { organizationId: string; opportunityId: string }) {
  const [result, setResult] = useState<Awaited<ReturnType<typeof getWorkspaceOpportunity>> | null>(null)
  useEffect(() => {
    let active = true, request = 0
    const load = async () => {
      const current = ++request
      try {
        const value = await getWorkspaceOpportunity({ organizationId, id: opportunityId })
        if (active && request === current) setResult(value)
      } catch { if (active && request === current) setResult({ error: "Opportunity couldn’t be loaded." }) }
    }
    const changed = (event: Event) => { if ((event as CustomEvent<string>).detail === opportunityId) void load() }
    void load(); window.addEventListener(OPPORTUNITY_CHANGED, changed)
    return () => { active = false; window.removeEventListener(OPPORTUNITY_CHANGED, changed) }
  }, [organizationId, opportunityId])
  if (!result) return <p role="status" className="text-sm text-muted-foreground">Loading opportunity…</p>
  if ("error" in result) return <p role="status" className="text-sm text-muted-foreground">{result.error}</p>
  return <div className="nodrag nopan nowheel max-h-96 space-y-4 overflow-y-auto text-sm">
    <OpportunityReportContent report={readOpportunityReport(result.opportunity.report)} options={result.options} organizationId={organizationId} />
    {!!result.opportunity.sources?.length && <div className="flex flex-wrap gap-1.5">{result.opportunity.sources.map(source => <OpportunitySourcePill key={sourceKey(source)} source={source} organizationId={organizationId} option={result.options.find(option => sourceKey(option.source) === sourceKey(source))} />)}</div>}
  </div>
}
