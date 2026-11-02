import { ParticleInput } from "@/components/ui/particle-ui"
import { Checkbox } from "@/components/ui/checkbox"
import type { ResearchResult } from "../research-types"

type Decision = NonNullable<ResearchResult["decisions"]>[number]

export function ResearchBranchEditor({ decision, candidates, disabled, onChange }: {
  decision?: Decision; candidates: { key: string; title: string }[]; disabled: boolean; onChange: (decision: Decision) => void
}) {
  if (!decision) return null
  const edit = (key: string, update: Partial<Decision["outcomes"][number]>) =>
    onChange({ ...decision, outcomes: decision.outcomes.map(outcome => outcome.key === key ? { ...outcome, ...update } : outcome) })
  return <details className="text-xs">
    <summary className="min-h-11 cursor-pointer content-center rounded-lg px-2 focus-visible:outline-2 focus-visible:outline-ring">Branches ({decision.outcomes.length})</summary>
    <div className="space-y-3 px-2">
      {decision.outcomes.map((outcome, index) => <div key={outcome.key} className="space-y-1">
        <label className="block space-y-1">Outcome {index + 1}
          <ParticleInput size="2xl" value={outcome.label} required maxLength={240} disabled={disabled}
            onChange={event => edit(outcome.key, { label: event.target.value })} />
        </label>
        <div role="group" aria-label={`Next items for outcome ${index + 1}`}>
          <p className="py-1 text-muted-foreground">Continue to</p>
          {candidates.filter(candidate => candidate.key !== decision.itemKey).map(candidate => <label key={candidate.key} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-2 hover:bg-muted">
            <Checkbox checked={outcome.next.includes(candidate.key)} disabled={disabled}
              onCheckedChange={checked => edit(outcome.key, { next: checked === true ? [...outcome.next, candidate.key] : outcome.next.filter(key => key !== candidate.key) })} />
            <span className="min-w-0 break-words">{candidate.title || "Untitled item"}</span>
          </label>)}
          {!outcome.next.length && <p className="py-1 text-muted-foreground">This path ends here.</p>}
        </div>
      </div>)}
    </div>
  </details>
}
