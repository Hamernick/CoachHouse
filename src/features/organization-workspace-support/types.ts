import type { MemberWorkspaceAccessibleOrganization } from "@/features/member-workspace"

export type WorkspaceSupportParticipant = {
  session_id: string
  actor_id: string
  name: string
  role: string
  path: string
  position: { x: number; y: number } | null
  editing: boolean
}
export type WorkspaceSupportPresenceInput = {
  organizationId: string
  sessionId: string
  path: string
  position: { x: number; y: number } | null
  editing: boolean
}

export type WorkspaceSupportSearchRow = {
  org_id: string
  name: string
  image_url: string | null
  public_slug: string | null
  owner_name: string | null
  owner_email: string | null
  contact_name: string | null
  contact_email: string | null
  total_count: number | string
}

export type WorkspaceSupportSearchResult = {
  organizations: MemberWorkspaceAccessibleOrganization[]
  total: number
  hasMore: boolean
  error?: string
}

export type WorkspaceSupportPresenceResult = { participants: WorkspaceSupportParticipant[] } | {
  error: string
  code?: "organization_unavailable"
  retryable?: boolean
  requestId?: string
}
