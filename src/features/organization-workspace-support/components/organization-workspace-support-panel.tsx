"use client"

import { Cursor } from "@/components/cursor"
import { organizationWorkspaceSupportEnabled } from "@/lib/feature-flags"
import { useOrganizationWorkspaceSupportController } from "../hooks/use-organization-workspace-support-controller"

export function OrganizationWorkspaceSupportPanel({ organizationId, supportAccess = false }: { organizationId: string; supportAccess?: boolean }) {
  const { participants, sessionId, path } = useOrganizationWorkspaceSupportController(organizationId, supportAccess)
  if (!organizationWorkspaceSupportEnabled) return null
  const others = participants.filter((participant) => participant.session_id !== sessionId)
  return <>
    {others.filter((participant) => participant.path === path && participant.position).map((participant) => <Cursor
      key={participant.session_id} name={`${participant.name} · Support`} color="#2563eb"
      className="pointer-events-none fixed z-50"
      style={{ left: `${participant.position!.x * 100}vw`, top: `${participant.position!.y * 100}vh` }}
    />)}
  </>
}
