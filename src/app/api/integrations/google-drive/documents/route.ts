import { NextResponse, type NextRequest } from "next/server"
import {
  attachGoogleDriveDocuments,
  listGoogleDriveDocuments,
  requireGoogleDriveContext,
} from "@/features/google-drive"
import {
  googleDriveFailure,
  googleDriveJson,
  googleDriveRequestId,
} from "../route-support"

export async function GET(request: NextRequest) {
  const requestId = googleDriveRequestId()
  try {
    const { supabase, organization, recheck } = await requireGoogleDriveContext(
      request,
      new NextResponse()
    )
    const documents = await listGoogleDriveDocuments(
      supabase,
      organization.orgId
    )
    await recheck()
    return googleDriveJson(
      { ok: true, documents },
      200,
      requestId,
      "documents_list"
    )
  } catch (error) {
    return googleDriveFailure(error, requestId, "documents_list")
  }
}

export async function POST(request: NextRequest) {
  const requestId = googleDriveRequestId()
  try {
    const { user, organization } = await requireGoogleDriveContext(
      request,
      new NextResponse(),
      true
    )
    const input = (await request.json().catch(() => null)) as {
      fileIds?: unknown
    } | null
    const attached = await attachGoogleDriveDocuments({
      userId: user.id,
      orgId: organization.orgId,
      fileIds: input?.fileIds,
    })
    return googleDriveJson(
      { ok: true, attached },
      200,
      requestId,
      "documents_attach"
    )
  } catch (error) {
    return googleDriveFailure(error, requestId, "documents_attach")
  }
}
