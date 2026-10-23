"use client"
import { useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { InputGroup, InputGroupInput, InputGroupAddon } from "@/components/ui/input-group"
import type { ObjectiveScope } from "../island-types"
import { useParticlePlans, type PlanningControls, type ObjectiveParticle } from "../hooks/use-particle-plans"
import { ObjectivesIslandSurface } from "./objectives-island-surface"
import { ParticleObjectiveCard } from "./particle-objective-card"

export function ParticleObjectivesIsland({ scope, controls }: { scope: ObjectiveScope; controls: PlanningControls }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const actions = useParticlePlans(scope, controls)
  const objectives = (controls.graph?.particles ?? []).filter((item): item is ObjectiveParticle => item.type === "objective")
  return <ObjectivesIslandSurface open={open} onOpenChange={setOpen} count={objectives.filter(item => item.status !== "done").length}>
    <div aria-busy={controls.pending} className="flex min-w-0 flex-col gap-1">
      {(controls.error || actions.accessError) && <p role="alert" className="px-2 py-1 text-xs text-destructive">{controls.error || actions.accessError}{controls.error && <Button variant="link" size="sm" onClick={() => void controls.retry()}>Retry</Button>}</p>}
      {objectives.map(objective => <ParticleObjectiveCard key={objective.id} objective={objective} controls={controls} actions={actions} userId={scope.userId} />)}
      {!objectives.length && <p className="px-2 py-3 text-sm text-muted-foreground">Add an objective to start your plan.</p>}
      {controls.canEdit && !controls.error && <form onSubmit={async event => { event.preventDefault(); if (title.trim() && await actions.createObjective(title.trim())) setTitle("") }}>
        <InputGroup className="rounded-full bg-muted/30 p-1 shadow-none"><InputGroupInput aria-label="New objective" placeholder="What do you want to accomplish?" value={title} maxLength={240} required onChange={event => setTitle(event.target.value)} className="h-9 min-w-0 rounded-full border-0 bg-transparent shadow-none dark:bg-transparent focus-visible:ring-0" />
          <InputGroupAddon><Button size="icon" variant="ghost" type="submit" className="size-9 rounded-full" aria-label="Add objective" disabled={controls.pending}><Plus aria-hidden /></Button></InputGroupAddon>
        </InputGroup>
      </form>}
    </div>
  </ObjectivesIslandSurface>
}
