"use client"

import { useEffect, useMemo, useState } from "react"
import { objectivePlanningAccessAction } from "../actions"
import type { ObjectiveScope } from "../island-types"

type Access = { workspaceId: string; userId: string; isOrganizationOwner: boolean; error: string | null }
/** One actor lookup shared by the canvas and sidebar; stale scopes fail closed. */
export function useObjectivePlanningAccess(scope: ObjectiveScope, supplied?: Access) {
  const [access, setAccess] = useState<Access | undefined>()
  const { organizationId: workspaceId, userId } = scope
  useEffect(() => {
    if (supplied) return
    let alive = true
    void objectivePlanningAccessAction({ userId, organizationId: workspaceId })
      .then(value => { if (alive) setAccess({ workspaceId, userId, ...value, error: null }) })
      .catch(() => { if (alive) setAccess({ workspaceId, userId, isOrganizationOwner: false, error: "Unable to check proposal review access." }) })
    return () => { alive = false }
  }, [workspaceId, userId, supplied])
  const current = supplied ?? access
  const pending = useMemo(() => ({ workspaceId, userId, isOrganizationOwner: false, error: null }), [workspaceId, userId])
  return current?.workspaceId === workspaceId && current.userId === userId ? current : pending
}
