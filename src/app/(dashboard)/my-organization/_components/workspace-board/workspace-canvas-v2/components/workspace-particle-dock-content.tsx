"use client"

import {
  ParticleComposer,
  ParticleConnections,
  ParticleLayoutActions,
  ParticleLibrary,
  ParticleCreateActions,
  ParticleInspector,
  type useParticleFlow,
  type ParticleLibraryTool,
} from "@/features/workspace-particles/client"
import { useWorkspaceCanvasOverlayDrawerRequest } from "./workspace-canvas-overlay-drawer-container"
type Props = { session: ReturnType<typeof useParticleFlow> }

export function WorkspaceParticleInspectorSlot({ session }: Props) {
  return session.selected ? (
    <>
      <ParticleInspector
        key={session.selected.id}
        particle={session.selected}
        editable={session.editable}
        pending={session.pending}
        onSave={session.edit}
        onClose={() => session.select(null)}
        onDirtyChange={session.setDirty}
      />
      {session.graph ? (
        <ParticleConnections
          key={`connections:${session.selected.id}`}
          particle={session.selected}
          graph={session.graph}
          editable={session.editable}
          actions={session.connections}
          visibleToolIds={session.visibleToolIds}
        />
      ) : null}
    </>
  ) : null
}

export function WorkspaceParticleComposerSlot({ session }: Props) {
  const request = useWorkspaceCanvasOverlayDrawerRequest()
  return (
    <ParticleComposer
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
    />
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
    </>
  )
}

export function WorkspaceParticleLibrarySlot({
  session,
  canEdit,
  tools,
}: Props & { canEdit: boolean; tools?: ParticleLibraryTool[] }) {
  return (
    <ParticleLibrary
      workspaceId={session.graph?.workspaceId}
      externalQuery={session.libraryQuery}
      onQueryChange={session.setLibraryQuery}
      onAddPreset={(particle) =>
        session.create(particle.type, particle.title, particle)
      }
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
