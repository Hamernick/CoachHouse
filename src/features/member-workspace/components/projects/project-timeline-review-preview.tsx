"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { PlatformAdminDashboardLabProject } from "@/features/platform-admin-dashboard"
import type {
  ProjectTimelineActions,
  TimelineTask,
} from "../../lib/project-timeline-types"
import { MemberWorkspaceProjectTimelineView } from "./member-workspace-project-timeline-view"

type SampleProject = {
  id: string
  name: string
  startDate: string
  endDate: string
  canEditSchedule?: boolean
}
type Samples = { projects: SampleProject[]; tasks: TimelineTask[] }
const seed: Samples = {
  projects: [
    {
      id: "community",
      name: "Community program",
      startDate: "2026-10-20",
      endDate: "2026-10-26",
    },
    { id: "undated", name: "New outreach project", startDate: "", endDate: "" },
    {
      id: "partial",
      name: "Grant deadline",
      startDate: "",
      endDate: "2026-10-28",
    },
    {
      id: "readonly",
      name: "Shared review",
      startDate: "2026-10-23",
      endDate: "2026-10-24",
      canEditSchedule: false,
    },
  ],
  tasks: [
    {
      id: "venue",
      projectId: "community",
      name: "Confirm the venue",
      status: "todo",
      startDate: "2026-10-20",
      endDate: "2026-10-22",
      canEdit: true,
    },
    {
      id: "notes",
      projectId: "community",
      name: "Prepare welcome notes",
      status: "waiting",
      startDate: "",
      endDate: "",
      canEdit: true,
    },
    {
      id: "system",
      projectId: "community",
      name: "Shared review task",
      status: "todo",
      startDate: "2026-10-21",
      endDate: "",
      canEdit: false,
    },
  ],
}
// Gated sample-only review: no database client or production server actions.
export function ProjectTimelineReviewPreview() {
  const [samples, setSamples] = useState<Samples>(seed)
  const saved = useRef(samples)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("project-timeline-review")
      if (stored) saved.current = JSON.parse(stored)
    } catch {
      /* Ignore stale sample data. */
    }
    if (new URLSearchParams(location.search).has("many"))
      saved.current = {
        ...saved.current,
        projects: [
          ...saved.current.projects,
          ...Array.from({ length: 200 }, (_, index) => ({
            ...seed.projects[0],
            id: `sample-${index}`,
            name: `Sample project ${index}`,
          })),
        ],
      }
    setSamples(saved.current)
    setReady(true)
  }, [])
  const actions = useMemo<ProjectTimelineActions>(() => {
    const persist = (next: Samples) => {
      sessionStorage.setItem("project-timeline-review", JSON.stringify(next))
      saved.current = next
      setSamples(next)
    }
    return {
      load: async (projectId) => {
        if (new URLSearchParams(location.search).has("rejectLoad"))
          return { error: "Sample task load failed." }
        return {
          tasks: saved.current.tasks.filter(
            (task) => task.projectId === projectId
          ),
          canEdit: true,
        }
      },
      dates: async (input) => {
        if (new URLSearchParams(location.search).has("rejectSave"))
          return { error: "Sample conflict: refresh before saving again." }
        const key = input.taskId ? "tasks" : "projects",
          id = input.taskId ?? input.projectId
        const row = saved.current[key].find((item) => item.id === id)
        if (
          !row ||
          row.startDate !== input.expectedStartDate ||
          row.endDate !== input.expectedEndDate
        )
          return { error: "Sample dates changed." }
        persist({
          ...saved.current,
          [key]: saved.current[key].map((item) =>
            item.id === id
              ? { ...item, startDate: input.startDate, endDate: input.endDate }
              : item
          ),
        })
        return { ok: true, startDate: input.startDate, endDate: input.endDate }
      },
      status: async (input) => {
        persist({
          ...saved.current,
          tasks: saved.current.tasks.map((task) =>
            task.id === input.taskId ? { ...task, status: input.status } : task
          ),
        })
        return { ok: true, status: input.status }
      },
    }
  }, [])
  const projects: PlatformAdminDashboardLabProject[] = useMemo(
    () =>
      samples.projects.map((project) => ({
        ...project,
        startDate: project.startDate
          ? new Date(`${project.startDate}T00:00:00Z`)
          : null,
        endDate: project.endDate
          ? new Date(`${project.endDate}T00:00:00Z`)
          : null,
        taskCount: samples.tasks.filter((task) => task.projectId === project.id)
          .length,
        progress: 0,
        status: "active",
        priority: "medium",
        tags: [],
        members: [],
        tasks: [],
        client: "Sample organization",
      })),
    [samples]
  )
  if (!ready) return <p>Loading sample timeline…</p>
  return (
    <main className="bg-background text-foreground min-h-svh min-w-0">
      <p className="text-muted-foreground border-b p-3 text-xs">
        Timeline preview · sample data only
      </p>
      <MemberWorkspaceProjectTimelineView
        projects={projects}
        actions={actions}
      />
    </main>
  )
}
