"use client"
import { useState } from "react"
import { ParticleButton as Button } from "@/components/ui/particle-ui"
import { WorkspaceDataViewsPanel } from "@/features/workspace-data-views"
import type { ResearchSourceEffect } from "../lib/research-data-view"

export function ResearchSourceEffects({ available, organizationId, effects, error, pending, plan, onCheck }: {
  available: boolean;
  organizationId: string; effects: ResearchSourceEffect[]; error: string | null; pending: boolean;
  plan: "pending" | "applied" | "unconfirmed"; onCheck: () => void;
}) {
  const [opened, setOpened] = useState<string | null>(null)
  if (!available) return null
  const view = effects.find(effect => effect.viewId === opened && effect.status === "created")
  return <section aria-label="Saved output status" className="space-y-2 border-t pt-3 text-xs">
    <Button color="secondary" type="button" variant="outline" size="2xl" disabled={pending} onClick={onCheck}>{pending ? "Checking saved outputs…" : "Check saved outputs"}</Button>
    {error && <p role="alert" className="text-destructive">{error}</p>}
    {effects.length > 0 && <>
      <ul aria-label="Source effect results" className="space-y-2">{effects.map((effect, index) => <li key={effect.key} className="space-y-1">
        <p><strong>{effect.name ?? `Data view ${index + 1}`}</strong> · {effect.message}</p>
        {effect.status === "created" && <Button color="secondary" type="button" variant="ghost" size="2xl" onClick={() => setOpened(effect.viewId)}>Open saved view</Button>}
      </li>)}</ul>
      <p role="status">{plan === "applied" ? "Plan application confirmed." : plan === "unconfirmed" ? "Plan application is unconfirmed. Earlier saved views remain; retry the same draft after checking status." : "Plan not yet confirmed. Source creation and plan application are separate."}</p>
    </>}
    {view && <div className="space-y-2 rounded-xl border p-3"><Button color="secondary" type="button" variant="ghost" size="2xl" onClick={() => setOpened(null)}>Close saved view</Button>
      <WorkspaceDataViewsPanel organizationId={organizationId} viewId={view.viewId} editable={false} />
    </div>}
  </section>
}
