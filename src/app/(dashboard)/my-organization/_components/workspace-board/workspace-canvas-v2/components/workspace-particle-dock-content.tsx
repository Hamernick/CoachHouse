"use client"

import dynamic from "next/dynamic"
import { WorkspaceAiComposer, WorkspaceNewPlan } from "@/features/workspace-ai/client"

import {
  ParticleComposer,
  particlePlanOutcomeReferences,
  ParticleLayoutActions,
  ParticleHistoryActions,
  ParticleLibrary,
  ParticleCreateActions,
  ParticleInspector,
  ParticleFocusedPreview,
  type useParticleFlow,
  type ParticleLibraryTool,
} from "@/features/workspace-particles/client"
import { useWorkspaceCanvasOverlayDrawerRequest } from "./workspace-canvas-overlay-drawer-container"
type Props = { session: ReturnType<typeof useParticleFlow>["controls"] }
const SharePanel = dynamic(() => import("@/features/workspace-sharing/client").then((module) => module.WorkspaceSharePanel), {
  ssr: false, loading: () => <div className="p-3 text-sm" role="status">Loading Share…</div>,
})

export function WorkspaceParticleInspectorSlot({ session, workspaceCanvasId }: Props & { workspaceCanvasId?: string }) {
  if (session.selected && session.graph && session.inspectorView === "share") return <SharePanel
    key={`${session.graph.workspaceId}:${workspaceCanvasId ?? "default"}:${session.selected.id}`}
    canvasId={workspaceCanvasId ?? null} workspaceId={session.graph.workspaceId} particleId={session.selected.id}
    initialParticleIds={session.shareParticleIds}
    onDirtyChange={session.setDirty}
    onBack={() => { session.setDirty(false); session.select(session.selected?.id ?? null, { view: "details" }) }}
  />
  if (session.selected && session.inspectorView === "preview") return <ParticleFocusedPreview
    key={session.selected.id} particle={session.selected} particles={session.graph?.particles} editable={session.editable}
    onOpen={calendarEntryId => session.select(session.selected!.id, { view: "details", calendarEntryId })}
    onClose={() => { session.closeGuard.request() }}
  />
  return session.selected ? (
    <ParticleInspector
      canEditObjectiveProgress={Boolean(session.planningAccess?.isOrganizationOwner && !session.planningAccess.error)}
      responsibilityOnCanvas={!session.selected.canvasHidden}
      key={session.selected.id}
      particle={session.selected}
      editable={session.editable}
      pending={session.pending}
      onSave={session.edit}
      onClose={() => { session.closeGuard.request() }}
      onDirtyChange={session.setDirty}
      calendarEntryRequest={session.calendarEntryRequest}
      connections={session.graph?.connections}
      decisionLinks={particlePlanOutcomeReferences(session.graph)}
      activities={session.graph?.particles.filter(
        (particle) => particle.type === "activity"
      )}
    />
  ) : null
}

export function WorkspaceParticleComposerSlot({ session,sourceScope,organizationName,workspaceCanvasId }: Props & {workspaceCanvasId?:string;sourceScope:{userId:string;organizationId:string};organizationName?:string}) {
  const request = useWorkspaceCanvasOverlayDrawerRequest()
  return (
    <>
    <WorkspaceNewPlan
      enabled={process.env.NEXT_PUBLIC_WORKSPACE_AI_ENABLED === "true" && Boolean(session.graph) && session.canEdit}
      {...sourceScope} canvasId={workspaceCanvasId ?? null} revision={session.graph?.revision ?? 0}
      disabled={!session.editable || session.pending || Boolean(session.error)} onProposal={async (result, draft) => {
        if (result.target.mode !== "new_objective") return false
        const graph = session.getCurrentGraph()
        if (!graph) return false
        const previous = new Set(graph.particles.map(item => item.id))
        const saved = await session.applyResearch(result.runId, result.target, draft)
        const added = saved?.graph.particles.filter(item => !previous.has(item.id)).map(item => item.id) ?? []
        if (saved && added.length) session.layout.queueAfterSave(saved.graph, added)
        return Boolean(saved)
      }}>{planner => <WorkspaceAiComposer sourceScope={sourceScope} organizationName={organizationName}>{assistant => <ParticleComposer
      assistant={assistant}
      planner={planner}
      disabled={!session.editable}
      pending={session.pending}
      error={session.error}
      saved={session.saved}
      onCreate={session.create}
      onBrowse={(query, open = true) => {
        session.setLibraryQuery(query)
        if (open) request?.({ tab: "particles" })
      }}
      onRetry={() => void session.retry()}
    />}</WorkspaceAiComposer>}</WorkspaceNewPlan>
    </>
  )
}

export function WorkspaceParticleCreateSlot({ session }: Props) {
  return (
    <>
      <ParticleCreateActions
        disabled={!session.editable}
        onCreate={session.create}
      />
      <ParticleLayoutActions
        disabled={!session.editable}
        layout={session.layout}
      />
      <ParticleHistoryActions
        disabled={!session.editable}
        history={session.history}
      />
    </>
  )
}

export function WorkspaceParticleLibrarySlot({
  session,
  canEdit,
  tools,
}: Props & {
  canEdit: boolean
  tools?: ParticleLibraryTool[]
}) {
  return (
    <ParticleLibrary
      images={session.images}
      workspaceId={session.graph?.workspaceId}
      externalQuery={session.libraryQuery}
      onAddPreset={(particle) =>
        session.create(particle.type, particle.title, particle)
      }
      connectedParticleIds={session.graph ? [...session.graph.connections.flatMap(edge => [edge.source, edge.target]), ...(session.graph.rootId ? [session.graph.rootId] : [])] : []}
      particles={session.graph?.particles ?? null}
      tools={tools}
      onPlace={(id, visible) => void session.setPlacement(id, visible)}
      editable={session.editable}
      canEdit={canEdit}
      pending={session.pending}
      error={session.error}
      onCreate={session.create}
      onRetry={() => void session.retry()}
    />
  )
}
