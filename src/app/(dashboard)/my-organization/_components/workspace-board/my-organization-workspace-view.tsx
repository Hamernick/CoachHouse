"use client"

import { WorkspaceManagementBridge } from "@/features/workspace-management/client"
import { WorkspaceBoardCanvas } from "./workspace-board-canvas"
import type { WorkspaceFinanceInput } from "@/features/workspace-finance"
import type {
  WorkspaceCardId,
  WorkspaceOrganizationEditorData,
  WorkspaceSeedData,
} from "./workspace-board-types"

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
  return (
    <div className="-m-[var(--shell-content-pad)] flex min-h-[calc(100%_+_var(--shell-content-pad)_+_var(--shell-content-pad))] min-w-0 flex-1 flex-col">
      <WorkspaceManagementBridge orgId={seed.orgId} currentId={seed.boardState.workspaceCanvasId ?? null} canEdit={seed.canEdit || Boolean(seed.isPlatformAdmin)} workspaces={seed.workspaceCatalog ?? []} />
      {seed.workspaceCatalog?.length === 0 ? (
        <div className="m-1 min-h-0 flex-1 rounded-3xl border border-border/70 bg-muted/20" aria-label="Empty workspace area" />
      ) : <WorkspaceBoardCanvas
        key={`${seed.orgId}:${seed.boardState.workspaceCanvasId ?? "main"}`}
        initialFocusCardId={initialFocusCardId}
        seed={seed}
        onInitialOnboardingSubmit={onInitialOnboardingSubmit}
        organizationEditorData={organizationEditorData}
        financeInput={financeInput}
      />}
    </div>
  )
}
