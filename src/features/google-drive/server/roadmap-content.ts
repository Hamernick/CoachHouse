import "server-only"

import type { NextRequest, NextResponse } from "next/server"
import { resolveRoadmapSections } from "@/lib/roadmap"
import { requireGoogleDriveContext } from "./context"
import { getGoogleDriveFileContent } from "./service"
import { GoogleDriveError } from "../types"

export async function readRoadmapGoogleDriveContent(
  request: NextRequest,
  response: NextResponse
) {
  const { supabase, user, organization } = await requireGoogleDriveContext(request, response)
  const query = request.nextUrl.searchParams
  if (query.get("organizationId") !== organization.orgId || query.get("userId") !== user.id)
    throw new GoogleDriveError("forbidden", 403)
  const { data, error } = await supabase
    .from("organizations")
    .select("profile")
    .eq("user_id", organization.orgId)
    .maybeSingle()
  if (error) throw new GoogleDriveError("provider_unavailable", 503)
  const profile = data?.profile
  const section = resolveRoadmapSections(
    profile && typeof profile === "object" && !Array.isArray(profile) ? profile : {}
  ).find(
    (candidate) => candidate.id === query.get("sectionId")
  )
  if (!section?.driveSource || section.driveSource.fileId !== query.get("fileId"))
    throw new GoogleDriveError("file_not_authorized", 403)
  return getGoogleDriveFileContent({ userId: user.id, fileId: section.driveSource.fileId })
}
