"use client"

import dynamic from "next/dynamic"
import { WorkspaceAiComposer } from "@/features/workspace-ai/client"

import {
  ParticleComposer,
  ParticleLayoutActions,
  ParticleHistoryActions,
  ParticleLibrary,
  ParticleCreateActions,
  ParticleInspector,
  type useParticleFlow,
  type ParticleLibraryTool,
} from "@/features/workspace-particles/client"
import { useWorkspaceCanvasOverlayDrawerRequest } from "./workspace-canvas-overlay-drawer-container"
type Props = { session: ReturnType<typeof useParticleFlow>["controls"] }
const SharePanel = dynamic(() => import("@/features/workspace-sharing/client").then((module) => module.WorkspaceSharePanel), {
  ssr: false, loading: () => <div className="p-3 text-sm" role="status">Loading Share…</div>,
})

export function WorkspaceParticleInspectorSlot({ session }: Props) {
  if (session.selected && session.graph && session.inspectorView === "share") return <SharePanel
    key={`${session.graph.workspaceId}:${session.selected.id}`}
    workspaceId={session.graph.workspaceId} particleId={session.selected.id}
    initialParticleIds={session.shareParticleIds}
    onDirtyChange={session.setDirty}
    onBack={() => { session.setDirty(false); session.select(session.selected?.id ?? null, { view: "details" }) }}
  />
  return session.selected ? (
    <ParticleInspector
      key={session.selected.id}
      particle={session.selected}
      editable={session.editable}
      pending={session.pending}
      onSave={session.edit}
      onClose={() => { session.closeGuard.request() }}
      onDirtyChange={session.setDirty}
      calendarEntryRequest={session.calendarEntryRequest}
      connections={session.graph?.connections}
      activities={session.graph?.particles.filter(
        (particle) => particle.type === "activity"
      )}
    />
  ) : null
}

export function WorkspaceParticleComposerSlot({ session }: Props) {
  const request = useWorkspaceCanvasOverlayDrawerRequest()
  return (
    <WorkspaceAiComposer>{assistant => <ParticleComposer
      assistant={assistant}
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
    />}</WorkspaceAiComposer>
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
