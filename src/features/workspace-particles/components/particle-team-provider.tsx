"use client"

import { useCallback, useEffect, useState, type ReactNode } from "react"
import { loadParticleAssigneesAction } from "../assignee-actions"
import type { ParticleAssignee } from "../lib/particle-assignees"
import { ParticleResponsibilityPeople, ParticleResponsibilityPeopleState } from "./particle-responsibility-fields"

export function ParticleTeamProvider({ workspaceId, children }: { workspaceId: string; children: ReactNode }) {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<{ workspaceId: string; people: ParticleAssignee[] | null; error: string | null }>()
  const retry = useCallback(() => setAttempt(value => value + 1), [])
  useEffect(() => {
    let alive = true
    void loadParticleAssigneesAction(workspaceId).then(people => {
      if (alive) setState({ workspaceId, people, error: null })
    }).catch(() => {
      if (alive) setState({ workspaceId, people: null, error: "Unable to load team." })
    })
    return () => { alive = false }
  }, [workspaceId, attempt])
  useEffect(() => {
    window.addEventListener("focus", retry)
    return () => window.removeEventListener("focus", retry)
  }, [retry])
  const current = state?.workspaceId === workspaceId ? state : undefined
  return <ParticleResponsibilityPeople value={current?.people ?? null}>
    <ParticleResponsibilityPeopleState value={{ error: current?.error ?? null, retry }}>{children}</ParticleResponsibilityPeopleState>
  </ParticleResponsibilityPeople>
}
