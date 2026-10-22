"use client"
import { useId, useMemo, useState } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { ChevronDown, ListTodo, Plus, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import type { ObjectiveIslandTransport, ObjectiveScope } from "../island-types"
import { useObjectiveIsland } from "../hooks/use-objective-island"
import { ObjectiveIslandCard } from "./objective-island-card"

export function ObjectivesIsland({ scope, canEdit, transport }: {
  scope: ObjectiveScope; canEdit: boolean; transport: ObjectiveIslandTransport
}) {
  return <ObjectivesIslandSession key={`${scope.userId}:${scope.organizationId}`} scope={scope} canEdit={canEdit} transport={transport} />
}
function ObjectivesIslandSession({ scope: suppliedScope, canEdit, transport }: {
  scope: ObjectiveScope; canEdit: boolean; transport: ObjectiveIslandTransport
}) {
  const { userId, organizationId } = suppliedScope
  const scope = useMemo(() => ({ userId, organizationId }), [userId, organizationId])
  const state = useObjectiveIsland(scope, transport)
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const id = useId()
  const reduced = useReducedMotion()
  const objectives = state.data?.objectives.filter(objective => objective.status !== "archived") ?? []
  const remaining = objectives.filter(objective => objective.status !== "done").length
  const editable = canEdit && state.data?.loadedFrom === "normalized"
  return <motion.div layout transition={reduced ? { duration: 0 } : { duration: 0.18, ease: "easeOut" }}
    className={cn("nodrag nopan nowheel pointer-events-auto max-w-full overflow-hidden rounded-[22px] border border-border/70 bg-card/95 shadow-none backdrop-blur-xl", open ? "w-[400px]" : "w-fit")}
    onKeyDown={event => { if (event.key === "Escape" && !event.defaultPrevented) { event.preventDefault(); setOpen(false) } }}>
    <Collapsible open={open} onOpenChange={value => { setOpen(value); if (value) void state.refresh() }}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="h-[42px] w-full gap-2 rounded-full px-3 [@media(pointer:coarse)]:h-11" aria-label="Objectives">
          <ListTodo data-icon="inline-start" aria-hidden /><span>Objectives</span>
          {state.data && <span className="text-xs tabular-nums text-muted-foreground">{remaining}</span>}
          <ChevronDown data-icon="inline-end" className={cn("transition-transform motion-reduce:transition-none", open && "rotate-180")} aria-hidden />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent forceMount hidden={!open}>
        <div className="flex max-h-[min(65svh,600px)] flex-col gap-2 overflow-y-auto p-2 pt-0" aria-busy={state.pending}>
          {canEdit && state.data && state.data.loadedFrom !== "legacy_tracker" && <form className="flex items-end gap-1" onSubmit={async event => {
            event.preventDefault()
            if (title.trim() && await state.mutate(() => transport.create(scope, title))) setTitle("")
          }}>
            <Field className="min-w-0 flex-1"><FieldLabel className="sr-only" htmlFor={id}>New objective</FieldLabel>
              <Input id={id} placeholder="What do you want to accomplish?" value={title} onChange={event => setTitle(event.target.value)} maxLength={240} disabled={state.pending} className="h-11 rounded-full shadow-none" />
            </Field>
            <Button type="submit" variant="ghost" size="icon" className="size-11 rounded-full" disabled={state.pending || !title.trim()} aria-label="Add objective"><Plus aria-hidden /></Button>
          </form>}
          {state.error && <p role="alert" className="px-2 py-1 text-xs text-destructive">{state.error}</p>}
          {!state.data && state.pending && <Skeleton className="h-24 rounded-3xl" />}
          {state.data && !objectives.length && <p className="px-2 py-3 text-sm text-muted-foreground">No objectives yet.</p>}
          {objectives.map(objective => <ObjectiveIslandCard key={objective.id} objective={objective}
            steps={(state.data?.steps ?? []).filter(step => step.objectiveId === objective.id)} editable={editable} pending={state.pending}
            onEdit={input => state.mutate(() => transport.edit(scope, input))}
            onStep={(step, done) => { void state.mutate(() => transport.step(scope, { id: step.id, objectiveId: objective.id, expectedUpdatedAt: step.updatedAt, done })) }} />)}
          <Button type="button" variant="ghost" size="sm" className="self-end rounded-full" disabled={state.pending} onClick={() => void state.refresh()}><RefreshCw data-icon="inline-start" aria-hidden />Refresh</Button>
        </div>
      </CollapsibleContent>
    </Collapsible>
  </motion.div>
}
