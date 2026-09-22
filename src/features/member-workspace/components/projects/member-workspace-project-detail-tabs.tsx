"use client"

import { OrganizationDocumentsPanel } from "./organization-documents-panel"

import type { ReactNode } from "react"

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
  TabsList,
  TabsTrigger,
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
import {
  MemberWorkspaceProjectFiscalDocuments,
  getMemberWorkspaceProjectFiscalDocumentAssetIds,
} from "./member-workspace-project-fiscal-documents"
import { MemberWorkspaceProjectOverviewDocument } from "./member-workspace-project-overview-document"
import { MemberWorkspaceProjectOverviewEditor } from "./member-workspace-project-overview-editor"
import { MemberWorkspaceProjectTasksEditor } from "./member-workspace-project-tasks-editor"
import { MemberWorkspaceProjectActivityTimeline } from "./member-workspace-project-activity-timeline"

function ProjectDetailTabsList() {
  return (
    <div className="-mx-1 overflow-x-auto pb-2">
      <TabsList className="inline-flex w-max min-w-full gap-2 px-1 sm:w-full sm:gap-6">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="fiscal-sponsorship">Fiscal Sponsorship</TabsTrigger>
        <TabsTrigger value="activity">Activity</TabsTrigger>
        <TabsTrigger value="workstream">Workstream</TabsTrigger>
        <TabsTrigger value="tasks">Tasks</TabsTrigger>
        <TabsTrigger value="notes">Notes</TabsTrigger>
        <TabsTrigger value="assets">Assets &amp; Files</TabsTrigger>
      </TabsList>
    </div>
  )
}

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
    nextStatus: "todo" | "in-progress" | "done"
  ) => Promise<
    | { ok: true; taskId: string; status: "todo" | "in-progress" | "done" }
    | { error: string }
  >
} & FiscalSponsorshipProjectWorkbenchAdminActionProps &
  FiscalSponsorshipProjectWorkbenchDocumentActionProps

export function MemberWorkspaceProjectDetailTabs({
  activeTab,
  assigneeOptions,
  createNoteAction,
  createTaskAction,
  currentUser,
  canConnectFiscalDocuments = false,
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
  const fiscalDocumentAssetIds =
    getMemberWorkspaceProjectFiscalDocumentAssetIds(
      fiscalSponsorshipWorkflowSummary
    )
  const generalProjectFiles = project.files.filter(
    (file) => !fiscalDocumentAssetIds.has(file.id)
  )
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

  return (
    <Tabs value={activeTab} onValueChange={onActiveTabChange}>
      <ProjectDetailTabsList />

      <TabsContent value="overview" className="lg:mt-2">
        <ProjectDetailOverviewContent
          draft={draft}
          isEditing={isEditing}
          project={project}
          onChangeDraftField={onChangeDraftField}
        />
      </TabsContent>

      <TabsContent value="fiscal-sponsorship">
        {resolvedFiscalSponsorshipWorkbench}
      </TabsContent>

      <TabsContent value="activity">
        <MemberWorkspaceProjectActivityTimeline
          organizationSummary={organizationSummary}
          project={project}
        />
      </TabsContent>

      <TabsContent value="workstream">
        <TimelineGantt
          activity={project.activity}
          programs={organizationSummary.programs}
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
        <div className="space-y-8">
          {generalProjectFiles.length ? (
            <section aria-label="Project files" className="space-y-2">
              <h3 className="text-sm font-medium">Project files</h3>
              <ul className="divide-border divide-y">
                {generalProjectFiles.map((file) => (
                  <li key={file.id} className="py-2">
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm underline underline-offset-4"
                    >
                      {file.name}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          <OrganizationDocumentsPanel
            key={organizationSummary.orgId}
            organizationId={organizationSummary.orgId}
          />
          <MemberWorkspaceProjectFiscalDocuments
            workflowSummary={fiscalSponsorshipWorkflowSummary}
          />
        </div>
      </TabsContent>
    </Tabs>
  )
}
