import type { ResearchResult } from "../research-types"

/** Model-reported omissions are advisory, never evidence of exhaustive coverage. */
export function ResearchOutputCoverage({ result }: { result: ResearchResult }) {
  const missing = [...new Set(result.unfulfilled ?? [])]
  return <section aria-label="Output scope" className="space-y-1 text-xs text-muted-foreground">
    <p>{result.items.some(item => item.kind === "data_view") ? "Saving creates each declared projects view separately, then adds the plan. Earlier saved views remain if a later step fails. No records are copied or created." : result.items.some(item => item.kind === "form") ? "Plan proposal with private form drafts. Forms are not published and accept no responses." : "Plan proposal only. Forms, data tables and external actions are not created here."}</p>
    {result.items.some(item => item.kind === "data_view") && result.items.some(item => item.kind === "form") && <p>Forms remain private drafts; they are not published and accept no responses.</p>}
    {missing.length > 0 && <>
      <p className="font-medium text-foreground">Not produced — identified by AI</p>
      <ul aria-label="Unfulfilled outputs" className="list-disc space-y-1 break-words pl-4">{missing.map(item => <li key={item}>{item}</li>)}</ul>
    </>}
  </section>
}
