import { NextResponse, type NextRequest } from "next/server"

import {
  getGoogleDriveDocumentThumbnail,
  requireGoogleDriveContext,
} from "@/features/google-drive"
import {
  googleDriveFailure,
  googleDriveRequestId,
} from "../../../route-support"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const requestId = googleDriveRequestId()
  try {
    const { organization } = await requireGoogleDriveContext(
      request,
      new NextResponse()
    )
    const { documentId } = await params
    const preview = await getGoogleDriveDocumentThumbnail({
      documentId,
      orgId: organization.orgId,
    })
    return new NextResponse(new Uint8Array(preview.bytes), {
      status: 200,
      headers: {
        "cache-control": "private, max-age=300",
        "content-type": preview.contentType,
        "x-content-type-options": "nosniff",
        "x-request-id": requestId,
      },
    })
  } catch (error) {
    return googleDriveFailure(error, requestId, "document_preview")
  }
}
