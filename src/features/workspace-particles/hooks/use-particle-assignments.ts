"use client"

import { useCallback, useMemo, useRef } from "react"
import type { PlanningActor } from "../lib/particle-plan-authority"
import { membershipResponsibilityOperation, particleMembershipResponsibilities, type MembershipResponsibility } from "../lib/particle-membership-responsibility"
import type { ParticleResponsibility } from "../lib/particle-responsibility"
import type { ParticleSession } from "./use-particle-session"

export function useParticleAssignments(session: ParticleSession, actor: PlanningActor | undefined, canEdit: boolean, onDirtyChange: (id: string, dirty: boolean) => void) {
  const latest = useRef({ session, actor, canEdit })
  latest.current = { session, actor, canEdit }
  const memberships = useMemo(() => particleMembershipResponsibilities(session.graph, actor), [session.graph, actor])
  const saveMembership = useCallback(async (id: string, scope: MembershipResponsibility, value: ParticleResponsibility) => {
    const current = latest.current
    if (!current.canEdit || !current.session.editable) return false
    const operation = membershipResponsibilityOperation(current.session.getCurrentGraph(), id, scope, value, current.actor)
    return operation ? current.session.commit([operation]) : false
  }, [])
  const assignment = useMemo(() => ({ save: session.edit, onDirtyChange, saveMembership }), [session.edit, onDirtyChange, saveMembership])
  return { assignment, memberships }
}
