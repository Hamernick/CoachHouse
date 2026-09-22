'use client'

import React, { useEffect, useMemo, useState, useTransition } from 'react'
import { format } from 'date-fns'
import {
  CalendarBlank,
  ChartBar,
  Folder,
  Microphone,
  Paperclip,
  Rows,
  Tag as TagIcon,
  UserCircle,
  X,
} from '@phosphor-icons/react/dist/ssr'

import type { ProjectTask, ProjectDetails, User } from '@/features/platform-admin-dashboard/upstream/lib/data/project-details'
import { Button } from '@/features/platform-admin-dashboard/upstream/components/ui/button'
import { Switch } from '@/features/platform-admin-dashboard/upstream/components/ui/switch'
import { GenericPicker, DatePicker } from '@/features/platform-admin-dashboard/upstream/components/project-wizard/steps/StepQuickCreate'
import { ProjectDescriptionEditor } from '@/features/platform-admin-dashboard/upstream/components/project-wizard/ProjectDescriptionEditor'
import { QuickCreateModalLayout } from '@/features/platform-admin-dashboard/upstream/components/QuickCreateModalLayout'
import { toast } from 'sonner'

export type CreateTaskContext = {
  projectId?: string
  workstreamId?: string
  workstreamName?: string
}

export type TaskQuickCreateProjectOption = {
  id: string
  label: string
}

export type TaskQuickCreateWorkstreamOption = {
  id: string
  label: string
}

type TaskQuickCreateModalProps = {
  open: boolean
  onClose: () => void
  context?: CreateTaskContext
  onTaskCreated?: (task: ProjectTask) => void
  editingTask?: ProjectTask
  onTaskUpdated?: (task: ProjectTask) => void
  projectOptions?: TaskQuickCreateProjectOption[]
  workstreamOptionsByProjectId?: Record<string, TaskQuickCreateWorkstreamOption[]>
  assigneeOptions?: AssigneeOption[]
  onSubmitTask?: (
    value: TaskQuickCreateSubmitValue,
  ) => Promise<{ ok: true; taskId?: string } | { error: string }>
}

type TaskStatusId = 'todo' | 'in-progress' | 'done'

type StatusOption = {
  id: TaskStatusId
  label: string
}

export type AssigneeOption = {
  id: string
  name: string
  avatarUrl?: string | null
}

type PriorityOption = {
  id: 'no-priority' | 'low' | 'medium' | 'high' | 'urgent'
  label: string
}

export type TagOption = {
  id: string
  label: string
}

export type TaskQuickCreateSubmitValue = {
  projectId: string
  workstreamId?: string
  workstreamName?: string
  title: string
  description?: string
  assigneeId?: string
  status: TaskStatusId
  startDate?: Date
  targetDate?: Date
  priorityId?: PriorityOption['id']
  tagLabel?: string
  tagId?: string
}

const STATUS_OPTIONS: StatusOption[] = [
  { id: 'todo', label: 'To do' },
  { id: 'in-progress', label: 'In progress' },
  { id: 'done', label: 'Done' },
]

const PRIORITY_OPTIONS: PriorityOption[] = [
  { id: 'no-priority', label: 'No priority' },
  { id: 'low', label: 'Low' },
  { id: 'medium', label: 'Medium' },
  { id: 'high', label: 'High' },
]

export const TAG_OPTIONS: TagOption[] = [
  { id: 'feature', label: 'Feature' },
  { id: 'bug', label: 'Bug' },
  { id: 'internal', label: 'Internal' },
]

function toUser(option: AssigneeOption | undefined): User | undefined {
  if (!option) return undefined
  return {
    id: option.id,
    name: option.name,
    avatarUrl: option.avatarUrl ?? undefined,
  }
}

function getWorkstreamsForProject(
  projectId: string | undefined,
  workstreamOptionsByProjectId?: Record<string, TaskQuickCreateWorkstreamOption[]>,
): { id: string; label: string }[] {
  if (!projectId) return []
  return workstreamOptionsByProjectId?.[projectId] ?? []
}

export function TaskQuickCreateModal({
  open,
  onClose,
  context,
  onTaskCreated,
  editingTask,
  onTaskUpdated,
  projectOptions: projectOptionsProp,
  workstreamOptionsByProjectId,
  assigneeOptions = [],
  onSubmitTask,
}: TaskQuickCreateModalProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState<string | undefined>(undefined)
  const [createMore, setCreateMore] = useState(false)
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false)
  const [isSubmitting, startSubmitTransition] = useTransition()

  const [projectId, setProjectId] = useState<string | undefined>(undefined)
  const [workstreamId, setWorkstreamId] = useState<string | undefined>(undefined)
  const [workstreamName, setWorkstreamName] = useState<string | undefined>(undefined)

  const [assignee, setAssignee] = useState<AssigneeOption | undefined>(assigneeOptions[0])
  const [status, setStatus] = useState<StatusOption>(STATUS_OPTIONS[0])
  const [startDate, setStartDate] = useState<Date | undefined>(new Date())
  const [targetDate, setTargetDate] = useState<Date | undefined>(undefined)
  const [priority, setPriority] = useState<PriorityOption | undefined>(PRIORITY_OPTIONS[0])
  const [selectedTag, setSelectedTag] = useState<TagOption | undefined>(undefined)

  useEffect(() => {
    if (!open) return

    if (editingTask) {
      setProjectId(editingTask.projectId)
      setWorkstreamId(editingTask.workstreamId)
      setWorkstreamName(editingTask.workstreamName)
      setTitle(editingTask.name)
      setDescription(editingTask.description)
      setCreateMore(false)
      setIsDescriptionExpanded(false)

      if (editingTask.assignee) {
        const assigneeOption = assigneeOptions.find(
          (option) =>
            option.id === editingTask.assignee?.id ||
            option.name === editingTask.assignee?.name,
        )
        setAssignee(assigneeOption ?? assigneeOptions[0])
      } else {
        setAssignee(assigneeOptions[0])
      }

      const statusOption = STATUS_OPTIONS.find((option) => option.id === editingTask.status)
      setStatus(statusOption ?? STATUS_OPTIONS[0])
      setStartDate(editingTask.startDate ?? new Date())
      setTargetDate(undefined)

      const priorityOption = editingTask.priority
        ? PRIORITY_OPTIONS.find((option) => option.id === editingTask.priority)
        : undefined
      setPriority(priorityOption ?? PRIORITY_OPTIONS[0])

      const tagOption = editingTask.tag
        ? TAG_OPTIONS.find((option) => option.label.toLowerCase() === editingTask.tag?.toLowerCase()) ?? { id: editingTask.tag, label: editingTask.tag }
        : undefined
      setSelectedTag(tagOption)

      return
    }

    const defaultProjectId = context?.projectId
    setProjectId(defaultProjectId)

    const workstreams = getWorkstreamsForProject(defaultProjectId, workstreamOptionsByProjectId)
    const initialWorkstream = workstreams.find((item) => item.id === context?.workstreamId)

    setWorkstreamId(initialWorkstream?.id)
    setWorkstreamName(context?.workstreamName ?? initialWorkstream?.label)

    setTitle('')
    setDescription(undefined)
    setCreateMore(false)
    setIsDescriptionExpanded(false)
    setAssignee(assigneeOptions[0])
    setStatus(STATUS_OPTIONS[0])
    setStartDate(new Date())
    setTargetDate(undefined)
    setPriority(PRIORITY_OPTIONS[0])
    setSelectedTag(undefined)
  }, [
    open,
    context?.projectId,
    context?.workstreamId,
    context?.workstreamName,
    editingTask,
    assigneeOptions,
    workstreamOptionsByProjectId,
  ])

  const projectOptions = useMemo(() => projectOptionsProp ?? [], [projectOptionsProp])

  const workstreamOptions = useMemo(
    () => getWorkstreamsForProject(projectId, workstreamOptionsByProjectId),
    [projectId, workstreamOptionsByProjectId],
  )

  useEffect(() => {
    if (!projectId) return

    if (!workstreamOptions.length) {
      setWorkstreamId(undefined)
      setWorkstreamName(undefined)
      return
    }

    const existing = workstreamOptions.find((item) => item.id === workstreamId)
    const fallback = workstreamOptions[0]
    const next = existing ?? fallback
    setWorkstreamId(next?.id)
    if (!workstreamName) {
      setWorkstreamName(next?.label)
    }
  }, [projectId, workstreamOptions, workstreamId, workstreamName])

  const handleSubmit = () => {
    const effectiveProjectId = projectId ?? editingTask?.projectId ?? projectOptions[0]?.id
    if (!effectiveProjectId) return

    const submitValue: TaskQuickCreateSubmitValue = {
      projectId: effectiveProjectId,
      workstreamId,
      workstreamName,
      title: title.trim() || 'Untitled task',
      description,
      assigneeId: assignee?.id,
      status: status.id,
      startDate,
      targetDate,
      priorityId: priority?.id,
      tagId: selectedTag?.id,
      tagLabel: selectedTag?.label,
    }

    if (onSubmitTask) {
      startSubmitTransition(async () => {
        const result = await onSubmitTask(submitValue)

        if ('error' in result) {
          toast.error(result.error)
          return
        }

        if (createMore && !editingTask) {
          setTitle('')
          setDescription(undefined)
          setStatus(STATUS_OPTIONS[0])
          setTargetDate(undefined)
          return
        }

        onClose()
      })
      return
    }

    if (editingTask) {
      const project = projectOptions.find((item) => item.id === effectiveProjectId)

      const updatedTask: ProjectTask = {
        ...editingTask,
        name: title.trim() || 'Untitled task',
        status: status.id,
        dueLabel: targetDate ? format(targetDate, 'dd/MM/yyyy') : editingTask.dueLabel,
        assignee: toUser(assignee),
        startDate,
        priority: priority?.id,
        tag: selectedTag?.label,
        description,
        projectId: effectiveProjectId ?? editingTask.projectId,
        projectName: project?.label ?? editingTask.projectName,
        workstreamId: workstreamId ?? editingTask.workstreamId,
        workstreamName: workstreamName ?? editingTask.workstreamName,
      }

      onTaskUpdated?.(updatedTask)
      toast.success('Task updated successfully')
      onClose()
      return
    }

    const project = projectOptions.find((item) => item.id === effectiveProjectId)
    if (!project) return

    const newTask: ProjectTask = {
      id: `${effectiveProjectId}-task-${Date.now()}`,
      name: title.trim() || 'Untitled task',
      status: status.id,
      dueLabel: targetDate ? format(targetDate, 'dd/MM/yyyy') : undefined,
      assignee: toUser(assignee),
      startDate,
      priority: priority?.id,
      tag: selectedTag?.label,
      description,
      projectId: effectiveProjectId,
      projectName: project.label,
      workstreamId: workstreamId ?? `${effectiveProjectId}-ws`,
      workstreamName: workstreamName ?? 'General',
    }

    onTaskCreated?.(newTask)

    if (createMore) {
      toast.success('Task created! Ready for another.')
      setTitle('')
      setDescription(undefined)
      setStatus(STATUS_OPTIONS[0])
      setTargetDate(undefined)
      return
    }

    toast.success('Task created successfully')
    onClose()
  }

  const projectLabel = projectOptions.find((item) => item.id === projectId)?.label

  return (
    <QuickCreateModalLayout
      open={open}
      onClose={onClose}
      isDescriptionExpanded={isDescriptionExpanded}
      onSubmitShortcut={handleSubmit}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <GenericPicker
            items={projectOptions}
            selectedId={projectId}
            onSelect={(item) => setProjectId(item.id)}
            placeholder="Choose project..."
            renderItem={(item) => (
              <div className="flex items-center justify-between w-full gap-2">
                <span>{item.label}</span>
              </div>
            )}
            trigger={
              <button
                className="bg-background flex gap-2 h-7 items-center px-2 py-1 rounded-lg border border-background hover:border-primary/50 transition-colors text-xs disabled:opacity-60"
              >
                <Folder className="size-4 text-muted-foreground" />
                <span className="truncate max-w-[160px] font-medium text-foreground">
                  {projectLabel ?? 'Choose project'}
                </span>
              </button>
            }
          />
          {workstreamOptions.length > 0 && (
            <>
              <div className="w-2 h-2 bg-muted-foreground/15 rounded-full" />
              <GenericPicker
                items={workstreamOptions}
                selectedId={workstreamId}
                onSelect={(item) => {
                  setWorkstreamId(item.id)
                  setWorkstreamName(item.label)
                }}
                placeholder="Choose workstream..."
                renderItem={(item) => (
                  <div className="flex items-center justify-between w-full gap-2">
                    <span>{item.label}</span>
                  </div>
                )}
                trigger={
                  <button
                    className="bg-background flex gap-2 h-7 items-center px-2 py-1 rounded-lg border border-background hover:border-primary/50 transition-colors text-xs disabled:opacity-60"
                  >
                    <Rows className="size-4 text-muted-foreground" />
                    <span className="truncate max-w-[160px] font-medium text-foreground">
                      {workstreamName ?? 'Choose workstream'}
                    </span>
                  </button>
                }
              />
            </>
          )}
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-8 w-8 rounded-full opacity-70 hover:opacity-100"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </Button>
      </div>

      <div className="flex flex-col gap-2 w-full shrink-0 mt-1">
        <div className="flex gap-1 h-10 items-center w-full">
          <input
            id="task-create-title"
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Task title"
            className="w-full font-normal leading-7 text-foreground placeholder:text-muted-foreground text-xl outline-none bg-transparent border-none p-0"
            autoComplete="off"
          />
        </div>
      </div>

      <ProjectDescriptionEditor
        value={description}
        onChange={setDescription}
        onExpandChange={setIsDescriptionExpanded}
        placeholder="Briefly describe the goal or details of this task..."
        showTemplates={false}
      />

      <div className="flex flex-wrap gap-2.5 items-start w-full shrink-0">
        <GenericPicker
          items={assigneeOptions}
          onSelect={setAssignee}
          selectedId={assignee?.id}
          placeholder="Assign owner..."
          renderItem={(item) => (
            <div className="flex items-center gap-2 w-full">
              {item.avatarUrl ? (
                <img
                  src={item.avatarUrl}
                  alt=""
                  className="size-5 rounded-full object-cover"
                />
              ) : (
                <div className="size-5 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                  {item.name.charAt(0)}
                </div>
              )}
              <span className="flex-1">{item.name}</span>
            </div>
          )}
          trigger={
            <button className="bg-muted flex gap-2 h-9 items-center px-3 py-2 rounded-lg border border-border hover:border-primary/50 transition-colors">
              {assignee?.avatarUrl ? (
                <img
                  src={assignee.avatarUrl}
                  alt=""
                  className="size-4 rounded-full object-cover"
                />
              ) : (
                <div className="size-4 rounded-full bg-background flex items-center justify-center text-[10px] font-medium">
                  {assignee?.name.charAt(0) ?? '?'}
                </div>
              )}
              <span className="font-medium text-foreground text-sm leading-5">
                {assignee?.name ?? 'Assignee'}
              </span>
            </button>
          }
        />

        <DatePicker
          date={startDate}
          onSelect={setStartDate}
          trigger={
            <button className="bg-muted flex gap-2 h-9 items-center px-3 py-2 rounded-lg border border-border hover:border-primary/50 transition-colors">
              <CalendarBlank className="size-4 text-muted-foreground" />
              <span className="font-medium text-foreground text-sm leading-5">
                {startDate ? `Start: ${format(startDate, 'dd/MM/yyyy')}` : 'Start date'}
              </span>
            </button>
          }
        />

        <GenericPicker
          items={STATUS_OPTIONS}
          onSelect={setStatus}
          selectedId={status.id}
          placeholder="Change status..."
          renderItem={(item) => (
            <div className="flex items-center gap-2 w-full">
              <span className="flex-1">{item.label}</span>
            </div>
          )}
          trigger={
            <button className="bg-background flex gap-2 h-9 items-center px-3 py-2 rounded-lg border border-border hover:bg-black/5 transition-colors">
              <UserCircle className="size-4 text-muted-foreground" />
              <span className="font-medium text-foreground text-sm leading-5">
                {status.label}
              </span>
            </button>
          }
        />

        <DatePicker
          date={targetDate}
          onSelect={setTargetDate}
          trigger={
            <button className="bg-background flex gap-2 h-9 items-center px-3 py-2 rounded-lg border border-border hover:bg-black/5 transition-colors">
              <CalendarBlank className="size-4 text-muted-foreground" />
              <span className="font-medium text-foreground text-sm leading-5">
                {targetDate ? format(targetDate, 'dd/MM/yyyy') : 'Target'}
              </span>
            </button>
          }
        />

        <GenericPicker
          items={PRIORITY_OPTIONS}
          onSelect={setPriority}
          selectedId={priority?.id}
          placeholder="Set priority..."
          renderItem={(item) => (
            <div className="flex items-center gap-2 w-full">
              <span className="flex-1">{item.label}</span>
            </div>
          )}
          trigger={
            <button className="bg-background flex gap-2 h-9 items-center px-3 py-2 rounded-lg border border-border hover:bg-black/5 transition-colors">
              <ChartBar className="size-4 text-muted-foreground" />
              <span className="font-medium text-foreground text-sm leading-5">
                {priority?.label ?? 'Priority'}
              </span>
            </button>
          }
        />

        <GenericPicker
          items={selectedTag && !TAG_OPTIONS.some((tag) => tag.id === selectedTag.id)
            ? [...TAG_OPTIONS, selectedTag]
            : TAG_OPTIONS}
          onSelect={setSelectedTag}
          selectedId={selectedTag?.id}
          placeholder="Search or create tag..."
          onCreate={(label) => setSelectedTag({ id: label, label })}
          renderItem={(item) => (
            <div className="flex items-center gap-2 w-full">
              <span className="flex-1">{item.label}</span>
            </div>
          )}
          trigger={
            <button className="bg-background flex gap-2 h-9 items-center px-3 py-2 rounded-lg border border-border hover:bg-black/5 transition-colors">
              <TagIcon className="size-4 text-muted-foreground" />
              <span className="font-medium text-foreground text-sm leading-5">
                {selectedTag?.label ?? 'Tag'}
              </span>
            </button>
          }
        />
      </div>

      <div className="flex items-center justify-between mt-auto w-full pt-4 shrink-0">
        <div className="flex items-center gap-1">
          <button className="flex items-center justify-center size-10 rounded-lg hover:bg-muted transition-colors">
            <Paperclip className="size-4 text-muted-foreground" />
          </button>
          <button className="flex items-center justify-center size-10 rounded-lg hover:bg-muted transition-colors">
            <Microphone className="size-4 text-muted-foreground" />
          </button>
        </div>

        <div className="flex items-center gap-4">
          {!editingTask && (
            <div className="flex items-center gap-2">
              <Switch
                checked={createMore}
                onCheckedChange={(value) => setCreateMore(Boolean(value))}
              />
              <span className="text-sm font-medium text-foreground">Create more</span>
            </div>
          )}

          <Button type="button" onClick={handleSubmit} className="h-10 px-4 rounded-xl">
            {isSubmitting ? (editingTask ? 'Saving...' : 'Creating...') : editingTask ? 'Save changes' : 'Create Task'}
          </Button>
        </div>
      </div>
    </QuickCreateModalLayout>
  )
}
