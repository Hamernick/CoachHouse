"use client"

import { ParticleButton as Button } from "@/components/ui/particle-ui"
import { usePlanningComposer } from "@/components/workspace/planning-composer-context"
import { memo, useRef, useState } from "react"
import { useOpportunityCanvasActions } from "../hooks/use-opportunity-canvas-actions"

import { Plus } from "lucide-react"
import { ScrollFadeEffect } from "@/components/scroll-fade-effect"
import styles from "./planning-sidebar.module.css"
import {
  WorkspaceOpportunitiesFeed,
  type WorkspaceFinanceInput,
} from "@/features/workspace-finance"
import { InlineAddInput } from "@/components/ui/inline-add-input"
import type { ObjectiveScope } from "../island-types"
import {
  useParticlePlans,
  type PlanningControls,
} from "../hooks/use-particle-plans"
import { PlanningSidebarSurface, PlanningFeedSection } from "./planning-sidebar-surface"
import { ParticleObjectiveCard } from "./particle-objective-card"
import { PlanParticleList } from "./plan-particle-list"
import {
  orderedObjectives,
  reorderObjectiveOperations,
} from "../lib/particle-objective-order"

const RetainedOpportunitiesFeed = memo(WorkspaceOpportunitiesFeed)

export function ParticleObjectivesIsland({
  scope,
  controls,
  finance,
  embedded = false,
  columns = false,
}: {
  scope: ObjectiveScope
  controls: PlanningControls
  finance?: WorkspaceFinanceInput
  embedded?: boolean
  columns?: boolean
}) {
  const composer = usePlanningComposer()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const objectiveForm = useRef<HTMLFormElement>(null)
  const [opportunityAdd, setOpportunityAdd] = useState<HTMLDivElement | null>(null)
  const [opportunitiesOpen, setOpportunitiesOpen] = useState(false)
  const [matchingResourceId, setMatchingResourceId] = useState<string | null>(
    null
  )
  const [opportunityCount, setOpportunityCount] = useState(
    () => finance?.opportunities?.length ?? 0
  )
  const [opportunityHeader, setOpportunityHeader] = useState<HTMLDivElement | null>(null)
  const [opportunityFooter, setOpportunityFooter] =
    useState<HTMLDivElement | null>(null)
  const opportunityActions = useOpportunityCanvasActions(scope.organizationId, controls)
  const actions = useParticlePlans(scope, controls)
  const objectives = orderedObjectives(controls.graph?.particles ?? [])
  const selectedResource =
    controls.graph?.particles.find(
      (item) => item.id === controls.selectedId && item.type === "activity"
    ) ??
    controls.graph?.particles.find(
      (item) => item.id === matchingResourceId && item.type === "activity"
    )
  const sortingDisabled =
    !controls.canEdit || controls.pending || Boolean(controls.error)
  const move = (id: string, index: number) => {
    if (sortingDisabled) return
    const target = objectives[index]
    const graph = controls.getCurrentGraph()
    if (!target || !graph) return
    const operations = reorderObjectiveOperations(
      graph.particles,
      id,
      target.id
    )
    if (operations.length)
      void controls.commit(operations, { optimistic: true })
  }
  const openObjectives = (value: boolean) => { setOpen(value); if (value && !columns) setOpportunitiesOpen(false) }
  const openOpportunities = (value: boolean) => {
    setOpportunitiesOpen(value)
    if (value) { if (!columns) setOpen(false); setMatchingResourceId(selectedResource?.id ?? null) }
  }
  const feeds = (
    <>
      <PlanningFeedSection label="Objectives" count={objectives.length} open={open} onOpenChange={openObjectives}
        action={controls.canEdit && !controls.error && <Button color="secondary" uniform variant="ghost" size="lg" className={styles.addButton}
          aria-label="Create objective" disabled={controls.pending || composer?.pending} onClick={() => {
            if (composer) { openObjectives(true); composer.choose({ kind: "objective", maxLength: 240, submit: actions.createObjective }); return }
            openObjectives(true)
            requestAnimationFrame(() => objectiveForm.current?.querySelector("input")?.focus({ preventScroll: true }))
          }}><Plus aria-hidden /></Button>}>
        <div className={styles.panel}>
          <ScrollFadeEffect className={styles.scroller}>
            <div
              aria-busy={controls.pending}
              className="flex min-w-0 flex-col gap-1"
            >
              {(controls.error || actions.accessError) && (
                <p role="alert" className="text-destructive px-2 py-1 text-xs">
                  {controls.error || actions.accessError}
                  {controls.error && (
                    <Button color="secondary"
                      variant="ghost"
                      size="md"
                      onClick={() => void controls.retry()}
                    >
                      Retry
                    </Button>
                  )}
                </p>
              )}
              <PlanParticleList
                label="Objectives list"
                particles={objectives}
                disabled={sortingDisabled}
                onMove={move}
                className="flex min-w-0 flex-col gap-1"
              >
                {objectives.map((objective) => (
                  <ParticleObjectiveCard
                    key={objective.id}
                    objective={objective}
                    controls={controls}
                    actions={actions}
                    userId={scope.userId}
                  />
                ))}
              </PlanParticleList>
              {!objectives.length && (
                <p className="text-muted-foreground px-2 py-3 text-sm">
                  Add an objective to start your plan.
                </p>
              )}
            </div>
          </ScrollFadeEffect>
          {!composer && controls.canEdit && !controls.error && (
            <div className={styles.footer}>
              <form ref={objectiveForm}
                onSubmit={async (event) => {
                  event.preventDefault()
                  if (
                    title.trim() &&
                    (await actions.createObjective(title.trim()))
                  )
                    setTitle("")
                }}
              >
                <InlineAddInput
                  aria-label="New objective"
                  placeholder="Add an objective…"
                  value={title}
                  maxLength={240}
                  required
                  onChange={(event) => setTitle(event.target.value)}
                  actionLabel="Add objective"
                  actionDisabled={controls.pending}
                />
              </form>
            </div>
          )}
        </div>
      </PlanningFeedSection>
      <PlanningFeedSection label="Opportunities" count={opportunityCount} open={opportunitiesOpen} onOpenChange={openOpportunities}
        action={<div ref={setOpportunityAdd} className={styles.addTarget} />}>
        <div ref={setOpportunityHeader} className={styles.feedToolbar} />
          <ScrollFadeEffect className={styles.scroller}>
            <RetainedOpportunitiesFeed
              sidebar
              addTarget={opportunityAdd}
              onCreateStart={() => openOpportunities(true)}
              headerTarget={opportunityHeader}
              footerTarget={opportunityFooter}
              selectedResource={selectedResource}
              key={scope.organizationId}
              organizationId={scope.organizationId}
              opportunities={finance?.opportunities}
              state={finance?.opportunitiesState}
              canEdit={controls.canEdit}
              onCountChange={setOpportunityCount}
              onAddToWorkspace={opportunityActions.onAddToWorkspace}
              onOpenSource={opportunityActions.onOpenSource}
            />
          </ScrollFadeEffect>
        <div ref={setOpportunityFooter} className={styles.footer} />
      </PlanningFeedSection>
    </>
  )
  return embedded ? feeds : (
    <div className={`nodrag nopan nowheel ${styles.feedPositions}`}>
      <div className={styles.objectivesPosition}><PlanningSidebarSurface>{feeds}</PlanningSidebarSurface></div>
    </div>
  )
}
