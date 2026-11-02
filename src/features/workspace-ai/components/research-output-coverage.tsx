import type { ResearchResult } from "../research-types"

/** Model-reported omissions are advisory, never evidence of exhaustive coverage. */
export function ResearchOutputCoverage({ result }: { result: ResearchResult }) {
  const missing = [...new Set(result.unfulfilled ?? [])]
  return <section aria-label="Output scope" className="space-y-1 text-xs text-muted-foreground">
    <p>Plan proposal only. Forms, data tables and external actions are not created here.</p>
    {missing.length > 0 && <>
      <p className="font-medium text-foreground">Not produced — identified by AI</p>
      <ul aria-label="Unfulfilled outputs" className="list-disc space-y-1 break-words pl-4">{missing.map(item => <li key={item}>{item}</li>)}</ul>
    </>}
  </section>
}
