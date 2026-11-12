"use client"
import { visibleResearchNotice } from "../lib/research-recovery"
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
    <Button color="secondary" type="button" variant="ghost" size="md" disabled={pending} onClick={onCheck}>{pending ? "Checking saved outputs…" : "Check saved outputs"}</Button>
    {visibleResearchNotice(error) && <p role="alert" className="text-destructive">{visibleResearchNotice(error)}</p>}
    {effects.length > 0 && <>
      <ul aria-label="Source effect results" className="space-y-2">{effects.map((effect, index) => <li key={effect.key} className="space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <p className="min-w-0 break-words font-medium">{effect.name ?? `Data view ${index + 1}`}</p>
          {effect.status === "created" && <Button color="secondary" type="button" variant="ghost" size="md" onClick={() => setOpened(effect.viewId)}>Open saved view</Button>}
        </div>
        {effect.status !== "created" && visibleResearchNotice(effect.message) && <p className="text-muted-foreground">{visibleResearchNotice(effect.message)}</p>}
      </li>)}</ul>
      <p role="status">{plan === "applied" ? "Plan saved." : plan === "unconfirmed" ? "Plan save unconfirmed. Saved views are retained; check status before retrying." : "Plan save not confirmed. Saved views are retained."}</p>
    </>}
    {view && <div className="space-y-2 rounded-xl border p-3"><Button color="secondary" type="button" variant="ghost" size="md" onClick={() => setOpened(null)}>Close saved view</Button>
      <WorkspaceDataViewsPanel organizationId={organizationId} viewId={view.viewId} editable={false} />
    </div>}
  </section>
}
