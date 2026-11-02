import { NextResponse, type NextRequest } from "next/server"
import {
  disconnectGoogleDrive,
  requireGoogleDriveContext,
} from "@/features/google-drive"
import {
  googleDriveFailure,
  googleDriveJson,
  googleDriveRequestId,
} from "../route-support"

export async function POST(request: NextRequest) {
  const requestId = googleDriveRequestId()
  try {
    const { user } = await requireGoogleDriveContext(
      request,
      new NextResponse(),
      true,
      "revoke"
    )
    await disconnectGoogleDrive({ userId: user.id })
    return googleDriveJson({ ok: true }, 200, requestId, "disconnect")
  } catch (error) {
    return googleDriveFailure(error, requestId, "disconnect")
  }
}
