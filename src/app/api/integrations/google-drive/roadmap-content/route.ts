import { NextResponse, type NextRequest } from "next/server"
import { readRoadmapGoogleDriveContent } from "@/features/google-drive"
import { googleDriveFailure, googleDriveJson, googleDriveRequestId } from "../route-support"

export async function GET(request: NextRequest) {
  const requestId = googleDriveRequestId()
  try {
    const document = await readRoadmapGoogleDriveContent(request, new NextResponse())
    const response = googleDriveJson({ ok: true, ...document }, 200, requestId, "roadmap_content")
    response.headers.set("cache-control", "private, no-store")
    return response
  } catch (error) {
    return googleDriveFailure(error, requestId, "roadmap_content")
  }
}
