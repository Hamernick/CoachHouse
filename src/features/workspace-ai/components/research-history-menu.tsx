"use client"
import { useEffect, useRef, useState } from "react"
import { ParticleButton as Button, ParticleMenu as Menu } from "@/components/ui/particle-ui"
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
  return <Menu onOpen={() => void load()} onClose={() => { version.current++ }}>
    <Menu.Trigger><Button color="secondary" type="button" variant="ghost" size="2xl" disabled={disabled}>Previous research</Button></Menu.Trigger>
    <Menu.Content align="start" minWidth={224} maxHeight={256}><div className="particle-ui particle-ui-menu">
      {loading && <Menu.Item disabled>Loading research…</Menu.Item>}
      {error && <Menu.Item onSelect={event => { event.preventDefault(); void load() }}>Could not load. Try again</Menu.Item>}
      {!loading && !error && !runs.length && <Menu.Item disabled>No previous research</Menu.Item>}
      {!loading && !error && runs.map(run => <Menu.Item key={run.id} className="flex min-h-11 justify-between gap-4" onSelect={() => onResume(run.id)}>
        <time dateTime={run.created_at}>{new Date(run.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit" })}</time>
        <span className="text-xs text-muted-foreground">{labels[run.status]}</span>
      </Menu.Item>)}
    </div></Menu.Content>
  </Menu>
}
