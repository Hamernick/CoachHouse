"use client"
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { listWorkspaceResearch } from "../research-actions"
import { researchHistorySchema, type ResearchHistory, type ResearchTarget } from "../research-types"

const labels: Record<ResearchHistory[number]["status"], string> = {
  reserved: "Waiting", running: "Running", reconciling: "Recovering",
  succeeded: "Ready to review", failed: "Failed", canceled: "Stopped",
}

export function ResearchHistoryMenu({ target, disabled, onResume }: {
  target: ResearchTarget; disabled: boolean; onResume: (id: string) => void
}) {
  const [runs, setRuns] = useState<ResearchHistory>([]), [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const version = useRef(0)
  useEffect(() => () => { version.current++ }, [])
  const load = async () => {
    const request = ++version.current
    setRuns([]); setLoading(true); setError(false)
    try {
      const response = await listWorkspaceResearch(target)
      if (version.current !== request) return
      if ("error" in response) throw new Error()
      setRuns(researchHistorySchema.parse(response.runs))
    } catch { if (version.current === request) setError(true) }
    finally { if (version.current === request) setLoading(false) }
  }
  return <DropdownMenu onOpenChange={open => {
    if (open) void load()
    else version.current++
  }}>
    <DropdownMenuTrigger asChild><Button type="button" variant="ghost" size="sm" disabled={disabled}>Previous research</Button></DropdownMenuTrigger>
    <DropdownMenuContent align="start" className="max-h-64 min-w-56 overflow-y-auto">
      {loading && <DropdownMenuItem disabled>Loading research…</DropdownMenuItem>}
      {error && <DropdownMenuItem onSelect={event => { event.preventDefault(); void load() }}>Could not load. Try again</DropdownMenuItem>}
      {!loading && !error && !runs.length && <DropdownMenuItem disabled>No previous research</DropdownMenuItem>}
      {!loading && !error && runs.map(run => <DropdownMenuItem key={run.id} className="flex min-h-11 justify-between gap-4" onSelect={() => onResume(run.id)}>
        <time dateTime={run.created_at}>{new Date(run.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit" })}</time>
        <span className="text-xs text-muted-foreground">{labels[run.status]}</span>
      </DropdownMenuItem>)}
    </DropdownMenuContent>
  </DropdownMenu>
}
