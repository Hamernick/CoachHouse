import { resolveActiveOrganization } from "@/lib/organization/active-org"
import { resolveOrganizationDocumentAccess } from "@/lib/organization/document-access"
import type { NextRequest } from "next/server"
import { handleNotesGet, handleNotesPost } from "@/features/workspace-particles"
import { applyWorkspaceParticleBatchAction } from "@/app/(dashboard)/my-organization/_lib/workspace-particle-actions"

export function GET(request: NextRequest) {
  return handleNotesGet(request, { resolveActiveOrganization, resolveOrganizationDocumentAccess })
}
export function POST(request: NextRequest) {
  return handleNotesPost(request, applyWorkspaceParticleBatchAction, resolveActiveOrganization)
}
