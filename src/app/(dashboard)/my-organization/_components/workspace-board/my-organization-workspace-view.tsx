"use client"

import { useMemo } from "react"
import { readParticleGraph } from "@/features/workspace-particles"
import { particleSourceReferences } from "@/lib/workspace/canvas-source-references"
import dynamic from "next/dynamic"
import { WorkspacePageLoading } from "@/components/workspace/workspace-page-loading"
import { WorkspaceCanvasAccessBoundary, WorkspaceManagementBridge } from "@/features/workspace-management/client"
import type { WorkspaceFinanceInput } from "@/features/workspace-finance"
import type {
  WorkspaceCardId,
  WorkspaceOrganizationEditorData,
  WorkspaceSeedData,
} from "./workspace-board-types"

const WorkspaceBoardCanvas = dynamic(
  () => import("./workspace-board-canvas").then((module) => module.WorkspaceBoardCanvas),
  { ssr: false, loading: () => <WorkspacePageLoading embedded /> }
)

export function MyOrganizationWorkspaceView({
  initialFocusCardId,
  seed,
  onInitialOnboardingSubmit,
  organizationEditorData,
  financeInput,
}: {
  initialFocusCardId?: WorkspaceCardId | null
  seed: WorkspaceSeedData
  onInitialOnboardingSubmit: (form: FormData) => Promise<void>
  organizationEditorData: WorkspaceOrganizationEditorData
  financeInput: WorkspaceFinanceInput
}) {
  const initialSources = useMemo(() => {
    const graph = readParticleGraph(seed.boardState.particleGraph, seed.orgId)
    return graph.ok ? particleSourceReferences(graph.value) : undefined
  }, [seed.boardState.particleGraph, seed.orgId])
  return (
    <div className="-m-[var(--shell-content-pad)] flex min-h-[calc(100%_+_var(--shell-content-pad)_+_var(--shell-content-pad))] min-w-0 flex-1 flex-col">
      {seed.workspaceCatalog?.length === 0 ? (
        <><WorkspaceManagementBridge orgId={seed.orgId} currentId={null} canEdit={seed.canEdit || Boolean(seed.isPlatformAdmin)} workspaces={[]} />
        <div className="m-1 min-h-0 flex-1 rounded-3xl border border-border/70 bg-muted/20" aria-label="Empty workspace area" /></>
      ) : <WorkspaceCanvasAccessBoundary initialSources={initialSources} orgId={seed.orgId} canvasId={seed.boardState.workspaceCanvasId ?? null} viewerId={seed.viewerId} role={seed.role} canEdit={seed.canEdit}>
      <WorkspaceManagementBridge orgId={seed.orgId} currentId={seed.boardState.workspaceCanvasId ?? null} canEdit={seed.canEdit || Boolean(seed.isPlatformAdmin)} workspaces={seed.workspaceCatalog ?? []} />
      <WorkspaceBoardCanvas
        key={`${seed.orgId}:${seed.boardState.workspaceCanvasId ?? "main"}`}
        initialFocusCardId={initialFocusCardId}
        seed={seed}
        onInitialOnboardingSubmit={onInitialOnboardingSubmit}
        organizationEditorData={organizationEditorData}
        financeInput={financeInput}
      /></WorkspaceCanvasAccessBoundary>}
    </div>
  )
}
