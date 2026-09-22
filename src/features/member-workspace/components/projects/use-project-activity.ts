"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { ProjectDetails } from "@/features/platform-admin-dashboard"
import { refreshOrganizationProjectActivity } from "../../project-workflow-actions"
import {
  createActivityRefresh,
  startVisibleActivityPolling,
} from "../../lib/project-activity-refresh"

export function useProjectActivity(orgId: string, project: ProjectDetails) {
  const [activity, setActivity] = useState(project.activity ?? [])
  const [state, setState] = useState(project.activityState ?? "ready")
  const [refreshing, setRefreshing] = useState(false)
  const current = useRef<ReturnType<typeof createActivityRefresh> | null>(null)
  const refresh = useCallback(async () => {
    await current.current?.refresh()
  }, [])
  useEffect(() => {
    setRefreshing(false)
    setActivity(project.activity ?? [])
    setState(project.activityState ?? "ready")
    const controller = createActivityRefresh({
      load: () =>
        refreshOrganizationProjectActivity({ orgId, projectId: project.id }),
      onPending: setRefreshing,
      onResult: (result) => {
        setState(result.state)
        if (result.state === "ready" || result.state === "forbidden")
          setActivity(result.items)
      },
    })
    current.current = controller
    const stop = startVisibleActivityPolling(controller.refresh)
    return () => {
      stop()
      controller.dispose()
      current.current = null
    }
  }, [orgId, project.id, project.activity, project.activityState])
  return { activity, state, refreshing, refresh }
}
