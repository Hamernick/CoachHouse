import "server-only"

import type { NextRequest, NextResponse } from "next/server"
import { resolveRoadmapSections } from "@/lib/roadmap"
import { resolveCoreDocumentSource } from "@/lib/roadmap/core-document-source"
import { filterAiDocumentCopies } from "@/lib/organization/document-ai-copies"
import { requireGoogleDriveContext } from "./context"
import { getGoogleDriveFileContent } from "./service"
import { GoogleDriveError } from "../types"

export async function readRoadmapGoogleDriveContent(
  request: NextRequest,
  response: NextResponse
) {
  const { supabase, user, organization, recheck } = await requireGoogleDriveContext(request, response)
  const query = request.nextUrl.searchParams
  if (query.get("organizationId") !== organization.orgId || query.get("userId") !== user.id)
    throw new GoogleDriveError("forbidden", 403)
  const readSource = async () => {
    const { data, error } = await supabase.from("organizations").select("profile")
      .eq("user_id", organization.orgId).abortSignal(AbortSignal.timeout(10000)).maybeSingle()
    if (error) throw new GoogleDriveError("provider_unavailable", 503)
    const profile = data?.profile
    const section = resolveRoadmapSections(
      profile && typeof profile === "object" && !Array.isArray(profile) ? profile : {}
    ).find(candidate => candidate.id === query.get("sectionId"))
    if (!section?.driveSource || resolveCoreDocumentSource(section) !== "google_drive"
      || section.driveSource.fileId !== query.get("fileId")
      || (section.lastUpdated ?? "") !== (query.get("revision") ?? ""))
      throw new GoogleDriveError("file_not_authorized", 403)
    if (!(await filterAiDocumentCopies([section], organization.orgId, user.id)).length)
      throw new GoogleDriveError("file_not_authorized", 403)
    return section.driveSource.fileId
  }
  const fileId = await readSource()
  const content = await getGoogleDriveFileContent({ userId: user.id, fileId })
  await recheck()
  // A provider read can outlast a source replacement or access reduction.
  // Re-read canonical binding and known copy authority before releasing bytes.
  await readSource()
  return content
}
