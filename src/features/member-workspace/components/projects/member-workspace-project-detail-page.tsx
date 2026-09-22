"use client"

import type { CoachingAvatar } from "@/components/coaching/coaching-avatar-group"

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react"
import { usePathname, useRouter } from "next/navigation"
import { toast } from "sonner"
import { AnimatePresence, motion } from "motion/react"

import type {
  FiscalSponsorshipProjectWorkbenchAdminActionProps,
  FiscalSponsorshipProjectWorkbenchDocumentActionProps,
  FiscalSponsorshipProjectWorkflowSummary,
} from "@/features/fiscal-sponsorship"
import {
  Breadcrumbs,
  Separator,
  TaskQuickCreateModal,
  type ProjectDetails,
  type User,
} from "@/features/platform-admin-dashboard"
import styles from "./member-workspace-projects-surface-theme.module.css"
import { MemberWorkspaceProjectDetailHeader } from "./member-workspace-project-detail-header"
import type {
  MemberWorkspaceAdminOrganizationSummary,
  MemberWorkspaceCreateProjectFormInput,
  MemberWorkspaceCreateProjectNoteInput,
  MemberWorkspaceCreateProjectQuickLinkInput,
  MemberWorkspaceCreateTaskInput,
  MemberWorkspaceUpdateProjectNoteInput,
  MemberWorkspaceUpdateProjectQuickLinkInput,
  MemberWorkspacePersonOption,
} from "../../types"
import { MemberWorkspaceProjectRightMetaPanel } from "./member-workspace-project-right-meta-panel"
import {
  areMemberWorkspaceProjectDetailDraftsEqual,
  buildMemberWorkspaceProjectDetailDraft,
  buildMemberWorkspaceProjectUpdateInput,
  type MemberWorkspaceProjectDetailDraft,
} from "./member-workspace-project-detail-editing"
import { MemberWorkspaceProjectDetailTabs } from "./member-workspace-project-detail-tabs"
import { ProjectDetailTopBarActions } from "./member-workspace-project-detail-top-bar-actions"
import { useProjectAssetActions } from "./member-workspace-project-asset-actions"
import { useMemberWorkspaceProjectTaskCreate } from "./member-workspace-project-task-create"

type MemberWorkspaceProjectDetailPageProps = {
  assignedCoaches?: CoachingAvatar[] | null
  assignedCoachNames?: string[] | null
  adminBilling?: ReactNode
  project: ProjectDetails
  assigneeOptions: MemberWorkspacePersonOption[]
  currentUser: User
  fiscalSponsorshipWorkflowSummary?: FiscalSponsorshipProjectWorkflowSummary | null
  organizationSummary: MemberWorkspaceAdminOrganizationSummary
  canManageProject?: boolean
  canManageProjectAssets?: boolean
  canEditProjectDetails?: boolean
  createTaskAction?: (
    input: MemberWorkspaceCreateTaskInput
  ) => Promise<{ ok: true; taskId: string } | { error: string }>
  updateTaskAction?: (
    taskId: string,
    input: MemberWorkspaceCreateTaskInput
  ) => Promise<{ ok: true; taskId: string } | { error: string }>
  deleteTaskAction?: (
    taskId: string
  ) => Promise<
    { ok: true; taskId: string; projectId: string } | { error: string }
  >
  updateScheduleAction?: (id: string, startDate: string, endDate: string) => Promise<{ ok: true; id: string } | { error: string }>
  updateProjectAction?: (
    projectId: string,
    input: MemberWorkspaceCreateProjectFormInput
  ) => Promise<{ ok: true; id: string } | { error: string }>
  deleteProjectAction?: (
    projectId: string
  ) => Promise<{ ok: true; id: string } | { error: string }>
  updateTaskStatusAction?: (
    taskId: string,
    nextStatus: "todo" | "in-progress" | "done"
  ) => Promise<
    | { ok: true; taskId: string; status: "todo" | "in-progress" | "done" }
    | { error: string }
  >
  updateTaskOrderAction?: (
    projectId: string,
    orderedTaskIds: string[]
  ) => Promise<{ ok: true; projectId: string } | { error: string }>
  createNoteAction?: (
    input: MemberWorkspaceCreateProjectNoteInput
  ) => Promise<{ ok: true; noteId: string } | { error: string }>
  updateNoteAction?: (
    input: MemberWorkspaceUpdateProjectNoteInput
  ) => Promise<{ ok: true; noteId: string } | { error: string }>
  deleteNoteAction?: (input: {
    noteId: string
    projectId: string
  }) => Promise<{ ok: true } | { error: string }>
  createQuickLinkAction?: (
    input: MemberWorkspaceCreateProjectQuickLinkInput
  ) => Promise<{ ok: true; linkId: string } | { error: string }>
  updateQuickLinkAction?: (
    input: MemberWorkspaceUpdateProjectQuickLinkInput
  ) => Promise<{ ok: true; linkId: string } | { error: string }>
  deleteQuickLinkAction?: (input: {
    linkId: string
    projectId: string
  }) => Promise<{ ok: true } | { error: string }>
} & FiscalSponsorshipProjectWorkbenchAdminActionProps &
  FiscalSponsorshipProjectWorkbenchDocumentActionProps

function getProjectSourceProjectKind(source: ProjectDetails["source"]) {
  if (!source || typeof source !== "object" || !("projectKind" in source)) {
    return undefined
  }

  const value = (source as Record<string, unknown>).projectKind
  return value === "standard" || value === "organization_admin"
    ? value
    : undefined
}

function revealFiscalUpdateTarget(href: string) {
  window.history.pushState(null, "", href)
  window.requestAnimationFrame(() => {
    const target = document.getElementById(href.slice(1))
    if (!target) return

    if (href === "#fiscal-sponsorship-application-intake") {
      const trigger = target.querySelector<HTMLButtonElement>(
        'button[aria-expanded="false"]'
      )
      trigger?.click()
    }

    window.requestAnimationFrame(() => {
      target.scrollIntoView({ block: "nearest", inline: "nearest" })
    })
  })
}

function useMemberWorkspaceProjectDelete({
  deleteProjectAction,
  projectId,
  onDeleted,
}: {
  deleteProjectAction?: (
    projectId: string
  ) => Promise<{ ok: true; id: string } | { error: string }>
  projectId: string
  onDeleted: () => void
}) {
  const [deleteProjectOpen, setDeleteProjectOpen] = useState(false)
  const [isDeletingProject, startProjectDeleteTransition] = useTransition()

  const handleDeleteProject = useCallback(() => {
    if (!deleteProjectAction) {
      toast.error("Project deletion is unavailable.")
      return
    }

    startProjectDeleteTransition(async () => {
      const result = await deleteProjectAction(projectId)

      if ("error" in result) {
        toast.error(result.error)
        return
      }

      toast.success("Project deleted")
      setDeleteProjectOpen(false)
      onDeleted()
    })
  }, [deleteProjectAction, onDeleted, projectId])

  return {
    deleteProjectOpen,
    handleDeleteProject,
    isDeletingProject,
    setDeleteProjectOpen,
  }
}

export function MemberWorkspaceProjectDetailPage({
  adminBilling,
  assignedCoachNames,
  assignedCoaches,
  project,
  assigneeOptions,
  currentUser,
  fiscalSponsorshipWorkflowSummary,
  organizationSummary,
  canManageProject: canManageProjectProp,
  canManageProjectAssets: canManageProjectAssetsProp,
  canEditProjectDetails: canEditProjectDetailsProp,
  createTaskAction,
  updateTaskAction,
  deleteTaskAction,
  updateProjectAction,
  updateScheduleAction,
  deleteProjectAction,
  updateTaskStatusAction,
  updateTaskOrderAction,
  createNoteAction,
  updateNoteAction,
  deleteNoteAction,
  createQuickLinkAction,
  updateQuickLinkAction,
  deleteQuickLinkAction,
  connectFiscalSponsorshipDocumentAssetAction,
  generateFiscalSponsorshipAgreementAction,
  reviewFiscalSponsorshipApplicationAction,
  reviewFiscalSponsorshipDocumentAction,
  sendFiscalSponsorshipAgreementForSignatureAction,
}: MemberWorkspaceProjectDetailPageProps) {
  const canManageProject =
    canManageProjectProp ??
    Boolean(
      updateProjectAction ||
      createTaskAction ||
      createNoteAction ||
      createQuickLinkAction
    )
  const canEditProjectDetails =
    canEditProjectDetailsProp ?? Boolean(updateProjectAction)
  const canManageProjectAssets = canManageProjectAssetsProp ?? canManageProject
  const router = useRouter()
  const directoryHref = (usePathname() ?? "").startsWith("/projects") ? "/projects" : "/organizations"
  const [showMeta, setShowMeta] = useState(true)
  const [activeTab, setActiveTab] = useState("overview")
  const [isEditing, setIsEditing] = useState(false)
  const [isSavingProject, startProjectSaveTransition] = useTransition()
  const initialProjectDraft = useMemo(
    () => buildMemberWorkspaceProjectDetailDraft(project),
    [project]
  )
  const [projectDraft, setProjectDraft] =
    useState<MemberWorkspaceProjectDetailDraft>(initialProjectDraft)

  const breadcrumbs = useMemo(
    () => [
      { label: directoryHref === "/projects" ? "Projects" : "Organizations", href: directoryHref },
      { label: project.name },
    ],
    [directoryHref, project.name]
  )

  useEffect(() => {
    setProjectDraft(initialProjectDraft)
  }, [initialProjectDraft])

  const hasProjectChanges = useMemo(
    () =>
      !areMemberWorkspaceProjectDetailDraftsEqual(
        projectDraft,
        initialProjectDraft
      ),
    [projectDraft, initialProjectDraft]
  )

  const copyLink = useCallback(async () => {
    if (!navigator.clipboard) {
      toast.error("Clipboard not available")
      return
    }

    try {
      await navigator.clipboard.writeText(window.location.href)
      toast.success("Link copied")
    } catch {
      toast.error("Failed to copy link")
    }
  }, [])

  const handleNavigateFiscalUpdate = useCallback((href: string) => {
    if (!href.startsWith("#")) return

    setActiveTab("overview")
    revealFiscalUpdateTarget(href)
  }, [])

  const handleChangeProjectDraftField = useCallback(
    (field: keyof MemberWorkspaceProjectDetailDraft, value: string) => {
      setProjectDraft((currentDraft) => ({
        ...currentDraft,
        [field]: value,
      }))
    },
    []
  )

  const handleStartProjectEditing = useCallback(() => {
    if (!updateProjectAction) {
      return
    }

    setProjectDraft(initialProjectDraft)
    setIsEditing(true)
  }, [initialProjectDraft, updateProjectAction])

  const handleCancelProjectEditing = useCallback(() => {
    setProjectDraft(initialProjectDraft)
    setIsEditing(false)
  }, [initialProjectDraft])

  const handleSaveProject = useCallback(() => {
    if (!updateProjectAction) {
      toast.error("Project editing is unavailable.")
      return
    }

    if (!hasProjectChanges) {
      setIsEditing(false)
      return
    }

    startProjectSaveTransition(async () => {
      const result = await updateProjectAction(
        project.id,
        buildMemberWorkspaceProjectUpdateInput({
          project,
          draft: projectDraft,
        })
      )

      if ("error" in result) {
        toast.error(result.error)
        return
      }

      toast.success(directoryHref === "/projects" ? "Project updated" : "Organization updated")
      setIsEditing(false)
      router.refresh()
    })
  }, [directoryHref, hasProjectChanges, project, projectDraft, router, updateProjectAction])

  const canDeleteProject =
    Boolean(deleteProjectAction) &&
    getProjectSourceProjectKind(project.source) !== "organization_admin"
  const handleProjectDeleted = useCallback(() => {
    router.push(directoryHref)
    router.refresh()
  }, [directoryHref, router])
  const {
    deleteProjectOpen,
    handleDeleteProject,
    isDeletingProject,
    setDeleteProjectOpen,
  } = useMemberWorkspaceProjectDelete({
    deleteProjectAction,
    projectId: project.id,
    onDeleted: handleProjectDeleted,
  })

  const {
    handleCreateAsset,
    handleUploadNoteAssets,
    handleUpdateAsset,
    handleDeleteAsset,
  } = useProjectAssetActions({
    canManageProject: canManageProjectAssets,
    projectId: project.id,
  })
  const {
    clearPendingInlineTaskContext,
    closeTaskCreate,
    handleTaskSubmit,
    isTaskCreateOpen,
    openTaskCreate,
    pendingInlineTaskContext,
    taskCreateContext,
    taskProjectOptions,
    workstreamOptionsByProjectId,
  } = useMemberWorkspaceProjectTaskCreate({
    canManageProject,
    createTaskAction,
    isEditing,
    project,
    setActiveTab,
  })

  useEffect(() => {
    if (!isEditing) {
      clearPendingInlineTaskContext()
    }
  }, [clearPendingInlineTaskContext, isEditing])

  return (
    <div
      className={`${styles.surface} bg-background -mx-[var(--shell-content-pad)] -mt-[var(--shell-content-pad)] -mb-[var(--shell-content-pad)] flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden`}
    >
      <div className="border-border flex flex-wrap items-center justify-between gap-4 border-b px-4 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="hidden sm:block">
            <Breadcrumbs items={breadcrumbs} />
          </div>
        </div>

        <ProjectDetailTopBarActions
          canDeleteProject={canDeleteProject}
          deleteProjectName={project.name}
          hasProjectChanges={hasProjectChanges}
          isDeletingProject={isDeletingProject}
          isEditing={isEditing}
          isSavingProject={isSavingProject}
          deleteProjectOpen={deleteProjectOpen}
          showMeta={showMeta}
          onCancelProjectEditing={handleCancelProjectEditing}
          onCopyLink={copyLink}
          onDeleteProject={handleDeleteProject}
          onDeleteProjectOpenChange={setDeleteProjectOpen}
          onSaveProject={handleSaveProject}
          onToggleMeta={() => setShowMeta((value) => !value)}
        />
      </div>

      <div className="bg-background flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-auto">
          <div className="px-4">
            <div className="mx-auto w-full max-w-7xl">
              <div
                className={
                  "mt-0 grid grid-cols-1 gap-15 " +
                  (showMeta
                    ? "lg:grid-cols-[minmax(0,2fr)_minmax(0,384px)]"
                    : "lg:grid-cols-[minmax(0,1fr)_minmax(0,0px)]")
                }
              >
                <div className="space-y-6 pt-4 pb-8">
                  <MemberWorkspaceProjectDetailHeader
                    assignedCoachNames={assignedCoachNames}
                    assignedCoaches={assignedCoaches}
                    project={project}
                    assigneeOptions={assigneeOptions}
                    canEditProject={
                      canEditProjectDetails && Boolean(updateProjectAction)
                    }
                    isEditing={isEditing}
                    draft={projectDraft}
                    onChangeDraftField={handleChangeProjectDraftField}
                    onEditProject={handleStartProjectEditing}
                  />

                  <MemberWorkspaceProjectDetailTabs
                    activeTab={activeTab}
                    assigneeOptions={assigneeOptions}
                    canConnectFiscalDocuments={canEditProjectDetails}
                    connectFiscalSponsorshipDocumentAssetAction={
                      connectFiscalSponsorshipDocumentAssetAction
                    }
                    createNoteAction={createNoteAction}
                    createTaskAction={createTaskAction}
                    currentUser={currentUser}
                    deleteNoteAction={deleteNoteAction}
                    deleteTaskAction={deleteTaskAction}
                    draft={projectDraft}
                    fiscalSponsorshipWorkflowSummary={
                      fiscalSponsorshipWorkflowSummary
                    }
                    generateFiscalSponsorshipAgreementAction={
                      generateFiscalSponsorshipAgreementAction
                    }
                    isEditing={isEditing}
                    onActiveTabChange={setActiveTab}
                    onChangeDraftField={handleChangeProjectDraftField}
                    onCreateAsset={
                      canManageProjectAssets ? handleCreateAsset : undefined
                    }
                    onCreateTask={canManageProject ? openTaskCreate : undefined}
                    onDeleteNoteAsset={
                      canManageProject ? handleDeleteAsset : undefined
                    }
                    onDeleteAsset={
                      canManageProjectAssets ? handleDeleteAsset : undefined
                    }
                    onPendingInlineTaskContextHandled={
                      clearPendingInlineTaskContext
                    }
                    organizationSummary={organizationSummary}
                    onUploadNoteAssets={
                      canManageProject ? handleUploadNoteAssets : undefined
                    }
                    onUpdateAsset={
                      canManageProjectAssets ? handleUpdateAsset : undefined
                    }
                    pendingInlineTaskContext={pendingInlineTaskContext}
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
                    updateNoteAction={updateNoteAction}
                    updateTaskAction={updateTaskAction}
                    updateTaskOrderAction={updateTaskOrderAction}
                    updateTaskStatusAction={updateTaskStatusAction}
                  />
                </div>

                <AnimatePresence initial={false}>
                  {showMeta ? (
                    <motion.div
                      key="meta-panel"
                      initial={{ x: 80, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ x: 80, opacity: 0 }}
                      transition={{
                        type: "spring",
                        stiffness: 260,
                        damping: 26,
                      }}
                      className="lg:border-border pb-8 lg:border-l lg:pl-6"
                    >
                      <MemberWorkspaceProjectRightMetaPanel
                        updateScheduleAction={canEditProjectDetails ? updateScheduleAction : undefined}
                        adminBilling={adminBilling}
                        project={project}
                        organizationSummary={organizationSummary}
                        fiscalSponsorshipWorkflowSummary={
                          fiscalSponsorshipWorkflowSummary
                        }
                        onNavigateFiscalUpdate={handleNavigateFiscalUpdate}
                        createQuickLinkAction={
                          canManageProject ? createQuickLinkAction : undefined
                        }
                        updateQuickLinkAction={
                          canManageProject ? updateQuickLinkAction : undefined
                        }
                        deleteQuickLinkAction={
                          canManageProject ? deleteQuickLinkAction : undefined
                        }
                      />
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>

        <Separator className="mt-auto" />
      </div>

      <TaskQuickCreateModal
        open={isTaskCreateOpen}
        onClose={closeTaskCreate}
        context={taskCreateContext}
        projectOptions={taskProjectOptions}
        workstreamOptionsByProjectId={workstreamOptionsByProjectId}
        assigneeOptions={assigneeOptions}
        onSubmitTask={handleTaskSubmit}
      />
    </div>
  )
}
