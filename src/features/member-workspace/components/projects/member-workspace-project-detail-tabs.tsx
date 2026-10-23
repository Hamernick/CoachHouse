"use client"

import { OrganizationProgramsTab } from "./organization-programs-tab"
import type { OrgProgram } from "@/components/organization/org-profile-card/types"
import { ProjectAssetFolders } from "./project-asset-folders"

import { useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { ProjectDetailTabsList } from "./project-detail-tabs-list"
import { enableProjectFiscalSponsorshipAction } from "../../project-actions"
import { hasFiscalSponsorshipWork } from "../../lib/project-fiscal-sponsorship"

import type {
  FiscalSponsorshipProjectWorkbenchAdminActionProps,
  FiscalSponsorshipProjectWorkbenchDocumentActionProps,
  FiscalSponsorshipProjectWorkflowSummary,
} from "@/features/fiscal-sponsorship"
import {
  NotesTab,
  ProjectTasksTab,
  Tabs,
  TabsContent,
  TimelineGantt,
  type CreateTaskContext,
  type UploadedNoteAsset,
  type ProjectDetails,
  type User,
} from "@/features/platform-admin-dashboard"
import type {
  MemberWorkspaceAdminOrganizationSummary,
  MemberWorkspaceCreateProjectNoteInput,
  MemberWorkspaceCreateTaskInput,
  MemberWorkspacePersonOption,
  MemberWorkspaceUpdateProjectNoteInput,
} from "../../types"
import type { MemberWorkspaceProjectDetailDraft } from "./member-workspace-project-detail-editing"
import { MemberWorkspaceProjectFiscalWorkbench } from "./member-workspace-project-fiscal-workbench"
import { MemberWorkspaceProjectOverviewDocument } from "./member-workspace-project-overview-document"
import { MemberWorkspaceProjectOverviewEditor } from "./member-workspace-project-overview-editor"
import { MemberWorkspaceProjectTasksEditor } from "./member-workspace-project-tasks-editor"
import { MemberWorkspaceProjectActivityTimeline } from "./member-workspace-project-activity-timeline"

type ProjectDetailOverviewContentProps = {
  draft: MemberWorkspaceProjectDetailDraft
  isEditing: boolean
  project: ProjectDetails
  onChangeDraftField: (
    field: keyof MemberWorkspaceProjectDetailDraft,
    value: string
  ) => void
}

function ProjectDetailOverviewContent({
  draft,
  isEditing,
  project,
  onChangeDraftField,
}: ProjectDetailOverviewContentProps) {
  if (isEditing) {
    return (
      <div className="space-y-10">
        <MemberWorkspaceProjectOverviewEditor
          draft={draft}
          onChangeDraftField={onChangeDraftField}
        />
      </div>
    )
  }

  return (
    <div className="space-y-10">
      <MemberWorkspaceProjectOverviewDocument project={project} />
    </div>
  )
}

type MemberWorkspaceProjectDetailTabsProps = {
  actionScope?: "workspace" | "platform"
  showOrganizationPrograms?: boolean
  organizationPrograms?: OrgProgram[]
  activeTab: string
  assigneeOptions: MemberWorkspacePersonOption[]
  createNoteAction?: (
    input: MemberWorkspaceCreateProjectNoteInput
  ) => Promise<{ ok: true; noteId: string } | { error: string }>
  createTaskAction?: (
    input: MemberWorkspaceCreateTaskInput
  ) => Promise<{ ok: true; taskId: string } | { error: string }>
  currentUser: User
  canConnectFiscalDocuments?: boolean
  canAddProjectTabs?: boolean
  deleteNoteAction?: (input: {
    noteId: string
    projectId: string
  }) => Promise<{ ok: true } | { error: string }>
  deleteTaskAction?: (
    taskId: string
  ) => Promise<
    { ok: true; taskId: string; projectId: string } | { error: string }
  >
  draft: MemberWorkspaceProjectDetailDraft
  fiscalSponsorshipWorkflowSummary?: FiscalSponsorshipProjectWorkflowSummary | null
  fiscalSponsorshipWorkbench?: ReactNode
  isEditing: boolean
  onActiveTabChange: (value: string) => void
  onChangeDraftField: (
    field: keyof MemberWorkspaceProjectDetailDraft,
    value: string
  ) => void
  organizationSummary: MemberWorkspaceAdminOrganizationSummary
  onCreateAsset?: (input: {
    title?: string
    description?: string
    link?: string
    files: File[]
  }) => Promise<void>
  onCreateTask?: (context?: CreateTaskContext) => void
  onDeleteNoteAsset?: (assetId: string) => Promise<void>
  onDeleteAsset?: (assetId: string) => Promise<void>
  onPendingInlineTaskContextHandled: () => void
  onUploadNoteAssets?: (input: {
    title?: string
    description?: string
    files: File[]
  }) => Promise<UploadedNoteAsset[]>
  onUpdateAsset?: (
    assetId: string,
    input: {
      title?: string
      description?: string
      link?: string
      files: File[]
    }
  ) => Promise<void>
  pendingInlineTaskContext?: CreateTaskContext
  project: ProjectDetails
  updateNoteAction?: (
    input: MemberWorkspaceUpdateProjectNoteInput
  ) => Promise<{ ok: true; noteId: string } | { error: string }>
  updateTaskAction?: (
    taskId: string,
    input: MemberWorkspaceCreateTaskInput
  ) => Promise<{ ok: true; taskId: string } | { error: string }>
  updateTaskOrderAction?: (
    projectId: string,
    orderedTaskIds: string[]
  ) => Promise<{ ok: true; projectId: string } | { error: string }>
  updateTaskStatusAction?: (
    taskId: string,
    nextStatus: "todo" | "in-progress" | "waiting" | "done"
  ) => Promise<
    | { ok: true; taskId: string; status: "todo" | "in-progress" | "waiting" | "done" }
    | { error: string }
  >
} & FiscalSponsorshipProjectWorkbenchAdminActionProps &
  FiscalSponsorshipProjectWorkbenchDocumentActionProps

export function MemberWorkspaceProjectDetailTabs({
  actionScope = "workspace",
  organizationPrograms,
  showOrganizationPrograms = false,
  activeTab,
  assigneeOptions,
  createNoteAction,
  createTaskAction,
  currentUser,
  canConnectFiscalDocuments = false,
  canAddProjectTabs = false,
  connectFiscalSponsorshipDocumentAssetAction,
  deleteNoteAction,
  deleteTaskAction,
  draft,
  fiscalSponsorshipWorkflowSummary,
  fiscalSponsorshipWorkbench,
  generateFiscalSponsorshipAgreementAction,
  isEditing,
  onActiveTabChange,
  onChangeDraftField,
  organizationSummary,
  onCreateTask,
  onDeleteNoteAsset,
  onPendingInlineTaskContextHandled,
  onUploadNoteAssets,
  pendingInlineTaskContext,
  project,
  reviewFiscalSponsorshipApplicationAction,
  reviewFiscalSponsorshipDocumentAction,
  sendFiscalSponsorshipAgreementForSignatureAction,
  updateNoteAction,
  updateTaskAction,
  updateTaskOrderAction,
  updateTaskStatusAction,
}: MemberWorkspaceProjectDetailTabsProps) {
  const router = useRouter()
  const [addedProjectId, setAddedProjectId] = useState<string | null>(null)
  const [addingFiscal, setAddingFiscal] = useState(false)
  const [tabError, setTabError] = useState<string | null>(null)
  const fiscalEnabled = project.source?.fiscalSponsorshipEnabled === true ||
    addedProjectId === project.id || hasFiscalSponsorshipWork(fiscalSponsorshipWorkflowSummary)
  const addFiscal = async () => {
    if (addingFiscal || fiscalEnabled || !canAddProjectTabs) return
    setAddingFiscal(true)
    setTabError(null)
    try {
      const result = await enableProjectFiscalSponsorshipAction(project.id, actionScope)
      if ("error" in result) { setTabError(result.error ?? "Could not add Fiscal Sponsorship."); return }
      setAddedProjectId(project.id)
      onActiveTabChange("fiscal-sponsorship")
      router.refresh()
    } catch {
      setTabError("Could not add Fiscal Sponsorship. Try again.")
    } finally {
      setAddingFiscal(false)
    }
  }
  const resolvedFiscalSponsorshipWorkbench = fiscalSponsorshipWorkbench ?? (
    <MemberWorkspaceProjectFiscalWorkbench
      canConnectDocuments={canConnectFiscalDocuments}
      connectFiscalSponsorshipDocumentAssetAction={
        connectFiscalSponsorshipDocumentAssetAction
      }
      generateFiscalSponsorshipAgreementAction={
        generateFiscalSponsorshipAgreementAction
      }
      fiscalSponsorshipWorkflowSummary={fiscalSponsorshipWorkflowSummary}
      onOpenAssets={() => onActiveTabChange("assets")}
      organizationSummary={organizationSummary}
      project={project}
      reviewFiscalSponsorshipApplicationAction={
        reviewFiscalSponsorshipApplicationAction
      }
      reviewFiscalSponsorshipDocumentAction={
        reviewFiscalSponsorshipDocumentAction
      }
      sendFiscalSponsorshipAgreementForSignatureAction={
        sendFiscalSponsorshipAgreementForSignatureAction
      }
    />
  )

  const hasPrograms = showOrganizationPrograms && Boolean(organizationPrograms?.length)
  const visibleTab = (activeTab === "fiscal-sponsorship" && !fiscalEnabled) || (activeTab === "programs" && !hasPrograms) ? "overview" : activeTab

  return (
    <Tabs value={visibleTab} onValueChange={onActiveTabChange}>
      <ProjectDetailTabsList hasPrograms={hasPrograms} fiscalEnabled={fiscalEnabled} canAdd={canAddProjectTabs} adding={addingFiscal} onAddFiscal={() => void addFiscal()} />
      {tabError ? <p role="alert" className="text-destructive mt-2 text-sm">{tabError}</p> : null}

      {hasPrograms && organizationPrograms ? (
        <TabsContent value="programs">
          <OrganizationProgramsTab programs={organizationPrograms} organizationId={organizationSummary.orgId} organizationName={organizationSummary.name} />
        </TabsContent>
      ) : null}

      <TabsContent value="overview" className="lg:mt-2">
        <ProjectDetailOverviewContent
          draft={draft}
          isEditing={isEditing}
          project={project}
          onChangeDraftField={onChangeDraftField}
        />
      </TabsContent>

      {fiscalEnabled ? (
        <TabsContent value="fiscal-sponsorship">{resolvedFiscalSponsorshipWorkbench}</TabsContent>
      ) : null}

      <TabsContent value="activity">
        <MemberWorkspaceProjectActivityTimeline
          organizationSummary={organizationSummary}
          project={project}
        />
      </TabsContent>

      <TabsContent value="workstream">
        <TimelineGantt
          activity={project.activity}
          programs={showOrganizationPrograms ? organizationSummary.programs : undefined}
          tasks={project.timelineTasks}
          onCreateTask={
            onCreateTask
              ? () => onCreateTask({ projectId: project.id })
              : undefined
          }
        />
      </TabsContent>

      <TabsContent value="tasks">
        {isEditing ? (
          <MemberWorkspaceProjectTasksEditor
            project={project}
            assigneeOptions={assigneeOptions}
            createTaskAction={createTaskAction}
            updateTaskAction={updateTaskAction}
            deleteTaskAction={deleteTaskAction}
            updateTaskOrderAction={updateTaskOrderAction}
            pendingCreateContext={pendingInlineTaskContext}
            onPendingCreateContextHandled={onPendingInlineTaskContextHandled}
          />
        ) : (
          <ProjectTasksTab
            project={project}
            canReorder={false}
            onCreateTask={onCreateTask}
            onUpdateTaskStatus={updateTaskStatusAction}
            onReorderTasks={updateTaskOrderAction}
          />
        )}
      </TabsContent>

      <TabsContent value="notes">
        <NotesTab
          notes={project.notes || []}
          currentUser={currentUser}
          createNoteAction={createNoteAction}
          updateNoteAction={updateNoteAction}
          deleteNoteAction={deleteNoteAction}
          projectId={project.id}
          uploadNoteAssets={onUploadNoteAssets}
          deleteUploadedNoteAsset={onDeleteNoteAsset}
        />
      </TabsContent>

      <TabsContent value="assets">
        <ProjectAssetFolders actionScope={actionScope} key={project.id} projectId={project.id} workflowSummary={fiscalSponsorshipWorkflowSummary} />
      </TabsContent>
    </Tabs>
  )
}
