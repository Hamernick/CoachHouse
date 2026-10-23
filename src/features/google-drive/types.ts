export type GoogleDriveConnectionStatus =
  | "connected"
  | "revoked"
  | "error"
  | "disconnected"

export type GoogleDriveConnectionSummary = {
  connected: boolean
  googleEmail: string | null
  status: GoogleDriveConnectionStatus | "not_connected"
}

export type GoogleDriveDocument = {
  id: string
  name: string
  mimeType: string
  webViewLink: string
  modifiedAt: string | null
  status: "available" | "trashed" | "inaccessible" | "needs_reconnect"
}

export type GoogleDriveErrorCode =
  | "not_configured"
  | "unauthorized"
  | "forbidden"
  | "invalid"
  | "invalid_state"
  | "authorization_denied"
  | "scope_denied"
  | "missing_refresh_token"
  | "google_revoked"
  | "file_not_authorized"
  | "rate_limited"
  | "provider_unavailable"
  | "unsupported_preview"

export class GoogleDriveError extends Error {
  constructor(
    public readonly code: GoogleDriveErrorCode,
    public readonly status: number,
  ) {
    super(code)
    this.name = "GoogleDriveError"
  }
}
