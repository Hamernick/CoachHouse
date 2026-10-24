import type { ResearchResult } from "../research-types"

export type ResearchPlanContext = { title: string; members: { id: string; title: string }[] }

export function ResearchReview({ result, plan }: { result: ResearchResult; plan?: ResearchPlanContext }) {
  const removed = result.removeReferences ?? []
  const title = (reference: string) => plan?.members.find(member => `particle:${member.id}` === reference)?.title
    ?? result.sources.find(source => source.id === reference)?.title ?? "Existing item"
  const itemTitle = (key: string) => {
    const item = result.items.find(item => item.key === key)
    return item?.kind === "reference" && item.referenceId ? title(item.referenceId) : item?.title ?? key
  }
  return <div className="space-y-2">
    <p className="text-sm">{result.summary}</p>
    {plan && <p className="text-xs text-muted-foreground">Existing content and completion stay unchanged. Items not mentioned stay in {plan.title}.</p>}
    {result.questions.length > 0 && <ul className="list-disc space-y-1 pl-4 text-sm">{result.questions.map(question => <li key={question}>{question}</li>)}</ul>}
    <ul aria-label="Proposed plan items" className="space-y-2 text-sm">{result.items.map(item => <li key={item.key}>
      <span className="font-medium">{item.kind === "reference" && item.referenceId ? title(item.referenceId) : item.title}</span>
      {plan && <span className="ml-2 text-xs text-muted-foreground">{item.kind === "reference" && plan.members.some(member => `particle:${member.id}` === item.referenceId) ? "Existing" : "Add to plan"}</span>}
      {item.kind !== "reference" && <p className="text-xs text-muted-foreground">{item.description}</p>}
      {(plan || item.dependsOn.length > 0) && <p className="text-xs text-muted-foreground">{item.dependsOn.length ? `After: ${item.dependsOn.map(key => itemTitle(key)).join(", ")}` : "No unconditional prerequisites"}</p>}
      {result.decisions?.find(decision => decision.itemKey === item.key)?.outcomes.map(outcome => <p key={outcome.key} className="text-xs text-muted-foreground"><span className="font-medium">{outcome.label}</span>: {outcome.next.length ? outcome.next.map(key => itemTitle(key)).join(", ") : "No further action proposed"}</p>)}
    </li>)}</ul>
    {removed.length > 0 && <div className="space-y-1 text-xs text-muted-foreground"><p>Remove from plan; keep in workspace:</p><ul aria-label="Research membership removals">{removed.map(reference => <li key={reference}>{title(reference)}</li>)}</ul></div>}
    <ul className="flex flex-wrap gap-1">{result.sources.map(source => <li key={source.id}><a href={source.href} target={source.kind === "web" ? "_blank" : undefined} rel="noreferrer" className="inline-block max-w-60 truncate rounded-full bg-muted px-2 py-1 text-xs underline">{source.title}</a></li>)}</ul>
  </div>
}
