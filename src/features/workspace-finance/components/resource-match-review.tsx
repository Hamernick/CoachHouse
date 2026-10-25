"use client"
import { useId, useRef, useState } from "react"
import { LoaderCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { fundingReviewInputSchema, type FundingReviewInput, type ResourceOpportunityMatch } from "../matching-types"
import { parseOpportunityCost } from "../lib/opportunity-costs"
import { WorkspaceOpportunityTimeline } from "./workspace-opportunity-timeline"

type Props = { match: ResourceOpportunityMatch; pending: boolean; onSave: (need: FundingReviewInput) => Promise<{ error?: string }> }
const textAmount = (cents: number | null) => cents === null ? "" : (cents / 100).toFixed(2)
function values(match: ResourceOpportunityMatch) {
  const need = match.need
  return { requested: textAmount(need.requestedCents), gap: textAmount(need.eligibleUnfundedCost.state === "known" ? need.eligibleUnfundedCost.cents : null),
    share: textAmount(need.matchingFunds.state === "known" ? need.matchingFunds.cents : null), currency: need.currency,
    start: need.period?.startsOn ?? "", end: need.period?.endsOn ?? "", applicant: need.applicantTypeCode ?? "unknown",
    eligibility: need.eligibilityReview, costs: need.restrictedCosts, overlap: need.overlap }
}
export function ResourceMatchReview({ match, pending, onSave }: Props) {
  const id = useId(), trigger = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false), [draft, setDraft] = useState(() => values(match)), [error, setError] = useState<string | null>(null)
  const disabled = pending || match.stale || !match.assessment.active
  function update<K extends keyof typeof draft>(key: K, value: typeof draft[K]) { setDraft(current => ({ ...current, [key]: value })); setError(null) }
  function close() { setOpen(false); trigger.current?.focus() }
  async function save() {
    const requested = parseOpportunityCost(draft.requested.trim()), gap = parseOpportunityCost(draft.gap.trim()), share = parseOpportunityCost(draft.share.trim())
    if ([requested, gap, share].some(value => value === undefined)) { setError("Enter valid amounts with up to two decimal places."); return }
    if (Boolean(draft.start) !== Boolean(draft.end)) { setError("Choose both period dates, or clear both."); return }
    const result = fundingReviewInputSchema.safeParse({ resourceId: match.need.resourceId, resourceRevision: match.need.resourceRevision,
      requestedCents: requested, currency: draft.currency.trim().toUpperCase(), period: draft.start ? { startsOn: draft.start, endsOn: draft.end } : null,
      eligibleUnfundedCost: gap === null ? { state: "unknown" } : { state: "known", cents: gap }, matchingFunds: share === null ? { state: "unknown" } : { state: "known", cents: share },
      applicantTypeCode: draft.applicant === "unknown" ? null : draft.applicant, eligibilityReview: draft.eligibility, restrictedCosts: draft.costs, overlap: draft.overlap })
    if (!result.success) { setError("Check the currency and funding period; the end must follow the start."); return }
    const saved = await onSave(result.data)
    if (saved.error) setError(saved.error); else close()
  }
  const amountRow = (name: "requested" | "gap" | "share", label: string) => <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-2">
    <Label htmlFor={`${id}-${name}`} className="text-xs font-normal">{label}</Label>
    <Input id={`${id}-${name}`} value={draft[name]} onChange={event => update(name, event.target.value)} inputMode="decimal" placeholder="Unknown" className="min-w-0 rounded-lg px-2" />
  </div>
  const choice = <K extends "eligibility" | "costs" | "overlap">(name: K, label: string, options: [typeof draft[K], string][]) => <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-2">
    <Label htmlFor={`${id}-${name}`} className="text-xs font-normal">{label}</Label>
    <Select value={draft[name]} onValueChange={value => update(name, value as typeof draft[K])} disabled={disabled}><SelectTrigger id={`${id}-${name}`} className="w-full min-w-0 rounded-lg"><SelectValue /></SelectTrigger><SelectContent>{options.map(([value, text]) => <SelectItem key={value} value={value}>{text}</SelectItem>)}</SelectContent></Select>
  </div>
  return <Collapsible open={open} onOpenChange={value => { if (pending) return; if (value) { setDraft(values(match)); setError(null) } setOpen(value) }}>
    <CollapsibleTrigger asChild><Button ref={trigger} type="button" variant="ghost" disabled={pending || (!open && disabled)} className="mt-1 min-h-11 rounded-lg px-1 text-xs">{match.need.review ? "Edit funding review" : "Review funding & eligibility"}</Button></CollapsibleTrigger>
    <CollapsibleContent className="pt-2">
      <form aria-label={`Funding review for ${match.notice.title}`} onSubmit={event => { event.preventDefault(); void save() }}>
        <fieldset disabled={disabled} className="min-w-0 space-y-3">
          <p className="text-xs text-muted-foreground">Your review stays private. Confirmations are your assessment, not an award or independent verification.</p>
          <details className="text-xs"><summary className="cursor-pointer py-2">Published requirements</summary>
            <p className="whitespace-pre-wrap break-words py-2">{match.notice.eligibilityText || "Full requirements are not in the structured feed. Review the official notice and attachments."}</p>
            <a href={match.notice.originalUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center underline">Official notice and attachments</a>
          </details>
          {amountRow("requested", "Request")}{amountRow("gap", "Eligible unfunded cost")}
          {match.notice.costSharing !== false && amountRow("share", "Available match funds")}
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-2"><Label htmlFor={`${id}-currency`} className="text-xs font-normal">Budget currency</Label><Input id={`${id}-currency`} value={draft.currency} onChange={event => update("currency", event.target.value)} maxLength={3} className="min-w-0 rounded-lg px-2" /></div>
          <details className="text-xs"><summary className="cursor-pointer py-2">Funding period{draft.start && draft.end ? ` · ${draft.start} – ${draft.end}` : " · Unknown"}</summary>
            <WorkspaceOpportunityTimeline label="Period start" value={draft.start} onChange={value => update("start", value)} disabled={disabled} />
            <WorkspaceOpportunityTimeline label="Period end" value={draft.end} onChange={value => update("end", value)} disabled={disabled} />
          </details>
          <div className="space-y-1"><Label htmlFor={`${id}-applicant`} className="text-xs font-normal">Your applicant category</Label>
            <Select value={draft.applicant} onValueChange={value => update("applicant", value)} disabled={disabled}><SelectTrigger id={`${id}-applicant`} className="w-full min-w-0 rounded-lg"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unknown">Unknown</SelectItem>{match.notice.applicantTypes.map(item => <SelectItem key={item.id} value={item.id}>{item.description}</SelectItem>)}<SelectItem value="not-listed">Not listed in the notice</SelectItem></SelectContent></Select>
          </div>
          {choice("eligibility", "Full requirements", [["unknown", "Unknown"], ["confirmed", "Met"], ["not_met", "Not met"]])}
          {choice("costs", "Proposed costs", [["unknown", "Unknown"], ["confirmed", "Eligible"], ["excluded", "Excluded"]])}
          {choice("overlap", "Existing funding", [["unknown", "Unknown"], ["clear", "No overlap"], ["overlapping", "Overlapping"]])}
        </fieldset>
        {error && <p role="alert" className="mt-3 text-xs text-destructive">{error}</p>}
        <div className="mt-3 flex justify-end gap-2"><Button type="button" variant="ghost" disabled={pending} className="min-h-11 rounded-lg" onClick={close}>Cancel</Button><Button type="submit" disabled={disabled} className="min-h-11 rounded-lg">{pending && <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />}Save review</Button></div>
      </form>
    </CollapsibleContent>
  </Collapsible>
}
