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
    const { bytes, contentType } = await getGoogleDriveDocumentThumbnail({
      documentId,
      orgId: organization.orgId,
    })
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "content-type": contentType,
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
        "content-security-policy": "default-src 'none'; sandbox",
        "x-request-id": requestId,
      },
    })
  } catch (error) {
    return googleDriveFailure(error, requestId, "document_preview")
  }
}
