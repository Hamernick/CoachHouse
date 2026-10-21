import { NextResponse, type NextRequest } from "next/server"
import {
  completeGoogleDriveConnection,
  GoogleDriveError,
  requireGoogleDriveContext,
} from "@/features/google-drive"
import { logger } from "@/lib/logger"
import { googleDriveRequestId } from "../route-support"

export async function GET(request: NextRequest) {
  const requestId = googleDriveRequestId()
  const response = new NextResponse()
  const destination = new URL("/workspace?drawer=tools", request.url)
  try {
    if (request.nextUrl.searchParams.get("error")) {
      throw new GoogleDriveError("authorization_denied", 400)
    }
    const state = request.nextUrl.searchParams.get("state")
    const code = request.nextUrl.searchParams.get("code")
    if (!state || !code) throw new GoogleDriveError("invalid_state", 400)
    const { user, organization } = await requireGoogleDriveContext(
      request,
      response,
      true
    )
    const returnPath = await completeGoogleDriveConnection({
      userId: user.id,
      orgId: organization.orgId,
      state,
      code,
    })
    // Retain the already-allowlisted OAuth intent path in storage; return a
    // workspace-originated connection to its Documents window on the canvas.
    const returnUrl = new URL(
      returnPath === "/workspace/documents" ? "/workspace?drawer=documents" : returnPath,
      destination.origin
    )
    destination.pathname = returnUrl.pathname
    destination.search = returnUrl.search
    destination.searchParams.set("googleDrive", "connected")
    logger.info("google_drive_result", {
      capability: "callback",
      outcome: "success",
      requestId,
      status: 302,
    })
  } catch (error) {
    const code =
      error instanceof GoogleDriveError ? error.code : "provider_unavailable"
    destination.searchParams.set("googleDrive", code)
    logger.warn("google_drive_result", {
      capability: "callback",
      outcome: code,
      requestId,
      status: 302,
    })
  }
  return NextResponse.redirect(destination, {
    headers: { "cache-control": "no-store", "x-request-id": requestId },
  })
}
