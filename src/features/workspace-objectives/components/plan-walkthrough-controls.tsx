"use client"

import { ParticleButton as Button } from "@/components/ui/particle-ui"


import type { PlanningControls } from "../hooks/use-particle-plans"

export function PlanWalkthroughControls({ walkthrough }: { walkthrough: PlanningControls["walkthrough"] }) {
  const { current, index, total, unavailable } = walkthrough
  const particle = current?.particle
  return <div className="mx-2 mb-2 rounded-xl border bg-muted/40 p-2" role="region" aria-label="Plan walkthrough"
    onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); event.preventDefault(); walkthrough.exit() } }}>
    <div aria-live="polite" aria-atomic="true" className="min-w-0 px-1 text-sm">
      <p className="font-medium break-words">{unavailable ? "Plan changed. Restart the walkthrough." : particle?.title ?? "Item unavailable"}</p>
      {!unavailable && <p className="text-xs text-muted-foreground">{index + 1} of {total} · {walkthrough.reference?.proposalId ? "Proposed plan" : "Plan walkthrough"}</p>}
      {current?.condition && <p className="text-xs text-muted-foreground">If {current.condition} · {current.branch === "waiting" ? "Needs decision" : current.branch === "inactive" ? "Alternative" : "Selected path"}</p>}
    </div>
    <div className="mt-1 flex items-center gap-1">
      <Button color="secondary" variant="ghost" size="md" className="min-h-9 rounded-lg [@media(pointer:coarse)]:min-h-11" disabled={unavailable || index <= 0} onClick={() => walkthrough.step(-1)}>Back</Button>
      <Button color="secondary" variant="ghost" size="md" className="min-h-9 rounded-lg [@media(pointer:coarse)]:min-h-11" disabled={unavailable || index < 0 || index >= total - 1} onClick={() => walkthrough.step(1)}>Next</Button>
      <Button color="secondary" variant="ghost" size="md" className="ml-auto min-h-9 rounded-lg [@media(pointer:coarse)]:min-h-11" onClick={() => walkthrough.exit()}>Exit</Button>
    </div>
  </div>
}
