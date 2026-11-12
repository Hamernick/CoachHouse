"use client"

import { useCallback, useMemo, useRef } from "react"
import type { PlanningActor } from "../lib/particle-plan-authority"
import { membershipResponsibilityOperation, particleMembershipResponsibilities, type MembershipResponsibility } from "../lib/particle-membership-responsibility"
import { EMPTY_RESPONSIBILITY, supportsParticleResponsibility, type ParticleResponsibility } from "../lib/particle-responsibility"
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
  const retry = useCallback(async (id: string, scope: MembershipResponsibility | undefined, value: ParticleResponsibility) => {
    const current = latest.current
    if (!current.canEdit || !await current.session.retry()) return false
    const graph = current.session.getCurrentGraph()
    const particle = graph?.particles.find(item => item.id === id)
    const saved = scope ? particleMembershipResponsibilities(graph, latest.current.actor).get(id)?.find(item => item.key === scope.key)?.value
      : particle && supportsParticleResponsibility(particle) ? particle.responsibility ?? EMPTY_RESPONSIBILITY : undefined
    return Boolean(saved && JSON.stringify(saved) === JSON.stringify(value))
  }, [])
  const assignment = useMemo(() => ({ save: session.edit, retry, onDirtyChange, saveMembership }), [session.edit, retry, onDirtyChange, saveMembership])
  return { assignment, memberships }
}
