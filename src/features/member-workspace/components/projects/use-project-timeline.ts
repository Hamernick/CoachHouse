"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import type { PlatformAdminDashboardLabProject } from "@/features/platform-admin-dashboard"
import type {
  ProjectTimelineActions,
  TimelineDateChange,
  TimelineTask,
} from "../../lib/project-timeline-types"
import { dateOnly } from "../../lib/project-timeline"
import type { TimelineEditor } from "./project-timeline-date-dialog"

type TaskLoad = { tasks: TimelineTask[]; loading?: boolean; error?: string }
export function useProjectTimeline(
  projects: PlatformAdminDashboardLabProject[],
  expanded: string[],
  actions?: ProjectTimelineActions,
  legacySave?: (
    id: string,
    start: string,
    end: string
  ) => Promise<{ ok: true; id: string } | { error: string }>
) {
  const router = useRouter()
  const [cache, setCache] = useState<Record<string, TaskLoad>>({})
  const [overrides, setOverrides] = useState<
    Record<string, { startDate: string; endDate: string }>
  >({})
  const [pending, setPending] = useState<Set<string>>(new Set())
  const [editor, setEditor] = useState<TimelineEditor | null>(null)
  const locks = useRef(new Set<string>()),
    generations = useRef<Record<string, number>>({})
  const writingTasks = useRef<Record<string, number>>({})
  const loadAction = actions?.load
  const load = useCallback(
    async (id: string) => {
      if (!loadAction || writingTasks.current[id]) return
      const generation = (generations.current[id] ?? 0) + 1
      generations.current[id] = generation
      setCache((current) => ({
        ...current,
        [id]: { tasks: current[id]?.tasks ?? [], loading: true },
      }))
      try {
        const result = await loadAction(id)
        if (generations.current[id] !== generation) return
        setCache((current) => ({
          ...current,
          [id]:
            "error" in result
              ? { tasks: [], error: result.error }
              : { tasks: result.tasks },
        }))
      } catch {
        if (generations.current[id] === generation)
          setCache((current) => ({
            ...current,
            [id]: { tasks: [], error: "Unable to load tasks. Try again." },
          }))
      }
    },
    [loadAction]
  )
  const expandedKey = expanded.join(",")
  useEffect(() => {
    for (const id of expandedKey.split(",").filter(Boolean)) void load(id)
  }, [expandedKey, load])
  useEffect(() => {
    setOverrides((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([id, value]) => {
          const project = projects.find((item) => item.id === id)
          return (
            project &&
            (dateOnly(project.startDate) !== value.startDate ||
              dateOnly(project.endDate) !== value.endDate)
          )
        })
      )
    )
  }, [projects])
  const begin = (key: string) => {
    if (locks.current.has(key)) return false
    locks.current.add(key)
    setPending(new Set(locks.current))
    return true
  }
  const finish = (key: string) => {
    locks.current.delete(key)
    setPending(new Set(locks.current))
  }
  const invalidateLoad = (id: string) => {
    generations.current[id] = (generations.current[id] ?? 0) + 1
  }
  const save = async (input: TimelineDateChange): Promise<string | null> => {
    const key = input.taskId ?? input.projectId
    if (!begin(key)) return "A change is already saving."
    if (input.taskId) {
      writingTasks.current[input.projectId] =
        (writingTasks.current[input.projectId] ?? 0) + 1
      invalidateLoad(input.projectId)
    }
    try {
      const result = actions
        ? await actions.dates(input)
        : !input.taskId && legacySave
          ? await legacySave(input.projectId, input.startDate, input.endDate)
          : { error: "Date editing is unavailable." }
      if ("error" in result) return result.error
      const saved = "startDate" in result ? result : input
      if (input.taskId)
        setCache((current) => ({
          ...current,
          [input.projectId]: {
            tasks: (current[input.projectId]?.tasks ?? []).map((task) =>
              task.id === input.taskId
                ? {
                    ...task,
                    startDate: saved.startDate,
                    endDate: saved.endDate,
                  }
                : task
            ),
          },
        }))
      else
        setOverrides((current) => ({
          ...current,
          [input.projectId]: {
            startDate: saved.startDate,
            endDate: saved.endDate,
          },
        }))
      setEditor(current => current?.projectId === input.projectId && current.taskId === input.taskId ? null : current)
      toast.success("Timeline dates updated")
      router.refresh()
      return null
    } catch {
      return "Unable to confirm the save. Refresh the timeline before trying again."
    } finally {
      if (input.taskId) {
        writingTasks.current[input.projectId] -= 1
        invalidateLoad(input.projectId)
      }
      finish(key)
    }
  }
  const drag = async (input: TimelineEditor) => {
    const error = await save(input)
    if (error) {
      toast.error(error)
      setEditor(current => current ?? { ...input, error })
    }
  }
  const toggleStatus = async (task: TimelineTask) => {
    if (!actions || !task.canEdit || !begin(task.id)) return
    writingTasks.current[task.projectId] =
      (writingTasks.current[task.projectId] ?? 0) + 1
    invalidateLoad(task.projectId)
    try {
      const result = await actions.status({
        projectId: task.projectId,
        taskId: task.id,
        expectedStatus: task.status,
        status: task.status === "done" ? "todo" : "done",
      })
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      setCache((current) => ({
        ...current,
        [task.projectId]: {
          tasks: (current[task.projectId]?.tasks ?? []).map((item) =>
            item.id === task.id ? { ...item, status: result.status } : item
          ),
        },
      }))
      router.refresh()
    } catch {
      toast.error("Unable to confirm the status change. Refresh the timeline.")
    } finally {
      writingTasks.current[task.projectId] -= 1
      invalidateLoad(task.projectId)
      finish(task.id)
    }
  }
  return {
    cache,
    overrides,
    pending,
    editor,
    setEditor,
    save,
    drag,
    toggleStatus,
    load,
    refresh: () => {
      router.refresh()
      for (const id of expanded) void load(id)
    },
  }
}
