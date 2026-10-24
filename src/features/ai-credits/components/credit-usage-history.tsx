"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { loadAiUsageHistory } from "../usage-actions"
import type { AiUsageHistory } from "../usage-types"

export function CreditUsageHistory({ organizationId, revision, documentContexts = [] }: {
  organizationId: string; revision: string; documentContexts?: Array<{ sectionId: string; open: () => void }>
}) {
  const [member, setMember] = useState("all")
  const [task, setTask] = useState("all")
  const [data, setData] = useState<AiUsageHistory | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  const generation = useRef(0)
  useEffect(() => {
    const current = ++generation.current
    setLoading(true); setError(null); setData(previous => previous ? { ...previous, rows: [], hasMore: false } : null)
    void loadAiUsageHistory({ organizationId, memberId: member === "all" ? null : member, task: task === "all" ? null : task as "document" | "plan" })
      .then(result => { if (generation.current === current) setData(result) })
      .catch(() => { if (generation.current === current) setError("Unable to load AI usage.") })
      .finally(() => { if (generation.current === current) setLoading(false) })
    return () => { generation.current = current + 1 }
  }, [organizationId, member, task, retry, revision])
  async function more() {
    if (!data || loading) return
    const last = data.rows.at(-1)
    if (!last) return
    const current = generation.current
    setLoading(true); setError(null)
    try {
      const next = await loadAiUsageHistory({ organizationId, memberId: member === "all" ? null : member,
        task: task === "all" ? null : task as "document" | "plan", before: { at: last.created_at, id: last.id } })
      if (generation.current === current) setData(previous => previous ? { ...next,
        rows: [...previous.rows, ...next.rows.filter(row => !previous.rows.some(prior => prior.id === row.id))] } : next)
    } catch { if (generation.current === current) setError("Unable to load more usage.") }
    finally { if (generation.current === current) setLoading(false) }
  }
  return <section aria-label="AI usage history" className="flex min-w-0 flex-col gap-2 border-t border-border/60 pt-3">
    <div className="flex items-center gap-2">
      <span className="mr-auto text-xs font-medium">History</span>
      {data?.canFilterMembers && data.members.length > 1 ? <Select value={member} onValueChange={setMember} disabled={loading}>
        <SelectTrigger aria-label="Usage member" className="h-8 min-w-0 max-w-40 rounded-full text-xs shadow-none"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="all">All members</SelectItem>{data.members.map(person => <SelectItem key={person.id} value={person.id}>{person.name}</SelectItem>)}</SelectContent>
      </Select> : null}
      <Select value={task} onValueChange={setTask} disabled={loading}>
        <SelectTrigger aria-label="Usage task" className="h-8 w-auto rounded-full text-xs shadow-none"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="all">All tasks</SelectItem><SelectItem value="document">Documents</SelectItem><SelectItem value="plan">Plans</SelectItem></SelectContent>
      </Select>
    </div>
    {data?.rows.length ? <ul className="flex max-h-64 flex-col gap-3 overflow-y-auto overscroll-contain" aria-label="AI usage records">
      {data.rows.map(row => {
        const context = row.sectionId ? documentContexts.find(item => item.sectionId === row.sectionId) : null
        const title = row.resourceTitle || (row.task === "plan" ? "Plan" : "Document")
        return <li key={row.id} className="flex min-w-0 items-start justify-between gap-3 text-xs">
          <div className="min-w-0 flex-1">
            {context ? <Button variant="link" aria-label={`Use ${title} as document context`} className="h-auto max-w-full justify-start p-0 text-xs" onClick={context.open}><span className="truncate">{title}</span></Button> : <p className="truncate font-medium">{title}</p>}
            <p className="truncate text-muted-foreground">{row.actorName} · {row.task === "plan" ? "Plan" : "Document"}</p>
            <p className="text-muted-foreground"><time dateTime={row.created_at}>{new Date(row.created_at).toLocaleString()}</time> · {row.status.replaceAll("_", " ")}</p>
          </div>
          <span className="shrink-0 tabular-nums">{row.charged_credits === null ? `${row.max_credits} reserved` : `${row.charged_credits} ${row.charged_credits === 1 ? "credit" : "credits"}`}</span>
        </li>
      })}
    </ul> : data && !loading ? <p className="text-xs text-muted-foreground">No usage yet.</p> : null}
    {loading ? <p role="status" className="text-xs text-muted-foreground">Loading usage…</p> : null}
    {error ? <div className="flex items-center justify-between gap-2 text-xs"><p role="alert">{error}</p><Button variant="ghost" size="sm" className="rounded-full" onClick={() => data?.rows.length ? void more() : setRetry(value => value + 1)}>Retry</Button></div> : null}
    {data?.hasMore && !error ? <Button variant="ghost" size="sm" className="self-center rounded-full" disabled={loading} onClick={() => void more()}>Show more</Button> : null}
  </section>
}
