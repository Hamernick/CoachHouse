"use client"

import { useCallback, useMemo, useState } from "react"
import { useRouter } from "next/navigation"

import {
  TAG_OPTIONS,
  type CreateTaskContext,
  type ProjectDetails,
  type TaskQuickCreateSubmitValue,
} from "@/features/platform-admin-dashboard"

import type { MemberWorkspaceCreateTaskInput } from "../../types"

export function useMemberWorkspaceProjectTaskCreate({
  canManageProject,
  createTaskAction,
  isEditing,
  project,
  setActiveTab,
}: {
  canManageProject: boolean
  createTaskAction?: (
    input: MemberWorkspaceCreateTaskInput
  ) => Promise<{ ok: true; taskId: string } | { error: string }>
  isEditing: boolean
  project: ProjectDetails
  setActiveTab: (value: string) => void
}) {
  const router = useRouter()
  const [isTaskCreateOpen, setIsTaskCreateOpen] = useState(false)
  const [taskCreateContext, setTaskCreateContext] = useState<
    CreateTaskContext | undefined
  >()
  const [pendingInlineTaskContext, setPendingInlineTaskContext] = useState<
    CreateTaskContext | undefined
  >()

  const taskProjectOptions = useMemo(
    () => [{ id: project.id, label: project.name }],
    [project.id, project.name]
  )
  const workstreamOptionsByProjectId = useMemo(
    () => ({
      [project.id]: project.workstreams.map((workstream) => ({
        id: workstream.id,
        label: workstream.name,
      })),
    }),
    [project.id, project.workstreams]
  )
  const openTaskCreate = useCallback(
    (context?: CreateTaskContext) => {
      if (!canManageProject) return

      if (isEditing) {
        setActiveTab("tasks")
        setPendingInlineTaskContext({
          projectId: project.id,
          ...context,
        })
        return
      }

      setTaskCreateContext({
        projectId: project.id,
        ...context,
      })
      setIsTaskCreateOpen(true)
    },
    [canManageProject, isEditing, project.id, setActiveTab]
  )
  const closeTaskCreate = useCallback(() => {
    setIsTaskCreateOpen(false)
    setTaskCreateContext(undefined)
  }, [])
  const clearPendingInlineTaskContext = useCallback(() => {
    setPendingInlineTaskContext(undefined)
  }, [])
  const handleTaskSubmit = useCallback(
    async (value: TaskQuickCreateSubmitValue) => {
      if (!createTaskAction) {
        return { error: "Task creation is unavailable." }
      }

      const tagLabel = value.tagLabel?.trim() || TAG_OPTIONS.find(
        (option) => option.id === value.tagId
      )?.label
      const startDate =
        value.startDate?.toISOString().slice(0, 10) ??
        new Date().toISOString().slice(0, 10)
      const endDate = value.targetDate?.toISOString().slice(0, 10) ?? startDate
      const result = await createTaskAction({
        projectId: value.projectId,
        title: value.title,
        description: value.description,
        status: value.status,
        startDate,
        endDate,
        priority: value.priorityId,
        tagLabel,
        workstreamName: value.workstreamName,
        assigneeUserId: value.assigneeId,
      })

      if ("error" in result) return result

      router.refresh()
      return result
    },
    [createTaskAction, router]
  )

  return {
    clearPendingInlineTaskContext,
    closeTaskCreate,
    handleTaskSubmit,
    isTaskCreateOpen,
    openTaskCreate,
    pendingInlineTaskContext,
    taskCreateContext,
    taskProjectOptions,
    workstreamOptionsByProjectId,
  }
}
