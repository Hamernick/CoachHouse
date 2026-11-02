import { NextResponse, type NextRequest } from "next/server"
import {
  createGoogleDrivePickerToken,
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
    const { user, recheck } = await requireGoogleDriveContext(
      request,
      new NextResponse(),
      true
    )
    const picker = await createGoogleDrivePickerToken(user.id)
    await recheck()
    return googleDriveJson(
      { ok: true, ...picker },
      200,
      requestId,
      "picker_token"
    )
  } catch (error) {
    return googleDriveFailure(error, requestId, "picker_token")
  }
}
