import "server-only"

import { OAuth2Client, type TokenPayload } from "google-auth-library"
import { normalizeGoogleDriveWebViewLink } from "../lib"
import { GoogleDriveError, type GoogleDriveErrorCode } from "../types"
import { getGoogleDriveConfig, GOOGLE_DRIVE_SCOPE } from "./config"

const TOKEN_URL = "https://oauth2.googleapis.com/token"
const GOOGLE_REQUEST_TIMEOUT_MS = 10_000
const GOOGLE_REVOKE_TIMEOUT_MS = 5_000

type TokenResponse = {
  access_token?: string
  refresh_token?: string
  id_token?: string
  scope?: string
}

async function googleRequest(
  url: string,
  init: RequestInit,
  errors: Partial<Record<400 | 403 | 404, GoogleDriveErrorCode>> = {},
) {
  let response: Response
  try {
    response = await fetch(url, {
      ...init,
      signal: init.signal ?? AbortSignal.timeout(GOOGLE_REQUEST_TIMEOUT_MS),
    })
  } catch {
    throw new GoogleDriveError("provider_unavailable", 503)
  }
  if (response.status === 401) throw new GoogleDriveError("google_revoked", 409)
  if (response.status === 400 && errors[400]) {
    const code = errors[400]
    throw new GoogleDriveError(code, code === "google_revoked" ? 409 : 400)
  }
  if (response.status === 403 && errors[403]) throw new GoogleDriveError(errors[403], 403)
  if (response.status === 404 && errors[404]) throw new GoogleDriveError(errors[404], 403)
  if (response.status === 403) throw new GoogleDriveError("google_revoked", 409)
  if (response.status === 429) throw new GoogleDriveError("rate_limited", 429)
  if (!response.ok) throw new GoogleDriveError("provider_unavailable", 503)
  return response
}

export async function exchangeGoogleDriveCode(code: string, verifier: string) {
  const config = getGoogleDriveConfig()
  const response = await googleRequest(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      code_verifier: verifier,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
    }),
  }, { 400: "authorization_denied" })
  const tokens = (await response.json()) as TokenResponse
  if (!tokens.access_token || !tokens.id_token) {
    throw new GoogleDriveError("authorization_denied", 400)
  }
  const scopes = (tokens.scope ?? "").split(" ").filter(Boolean)
  if (!scopes.includes(GOOGLE_DRIVE_SCOPE)) throw new GoogleDriveError("scope_denied", 400)

  let payload: TokenPayload | undefined
  try {
    const ticket = await new OAuth2Client(config.clientId).verifyIdToken({
      idToken: tokens.id_token,
      audience: config.clientId,
    })
    payload = ticket.getPayload()
  } catch {
    throw new GoogleDriveError("authorization_denied", 400)
  }
  if (!payload?.sub || !payload.email || payload.email_verified !== true) {
    throw new GoogleDriveError("authorization_denied", 400)
  }
  return { tokens, subject: payload.sub, email: payload.email, scopes }
}

export async function refreshGoogleDriveAccessToken(refreshToken: string) {
  const config = getGoogleDriveConfig()
  const response = await googleRequest(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "refresh_token",
    }),
  }, { 400: "google_revoked" })
  const tokens = (await response.json()) as TokenResponse
  if (!tokens.access_token) throw new GoogleDriveError("google_revoked", 409)
  return tokens.access_token
}

export async function revokeGoogleDriveToken(token: string) {
  try {
    await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
      signal: AbortSignal.timeout(GOOGLE_REVOKE_TIMEOUT_MS),
    })
  } catch {
    // Local token deletion remains authoritative when Google is unavailable.
  }
}

export async function getGoogleDriveFile(accessToken: string, fileId: string) {
  const fields =
    "id,name,mimeType,modifiedTime,webViewLink,thumbnailLink,driveId,trashed"
  const response = await googleRequest(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?supportsAllDrives=true&fields=${fields}`,
    { headers: { authorization: `Bearer ${accessToken}` } },
    { 403: "file_not_authorized", 404: "file_not_authorized" },
  )
  const file = (await response.json()) as Record<string, unknown>
  const webViewLink = normalizeGoogleDriveWebViewLink(file.webViewLink)
  let thumbnailLink: string | null = null
  if (typeof file.thumbnailLink === "string") {
    try {
      const url = new URL(file.thumbnailLink)
      if (
        url.protocol === "https:" &&
        (url.hostname === "googleusercontent.com" ||
          url.hostname.endsWith(".googleusercontent.com"))
      ) {
        thumbnailLink = url.toString()
      }
    } catch {
      thumbnailLink = null
    }
  }
  if (
    file.id !== fileId ||
    typeof file.name !== "string" || file.name.length < 1 || file.name.length > 1024 ||
    typeof file.mimeType !== "string" || file.mimeType.length < 1 || file.mimeType.length > 255 ||
    file.mimeType === "application/vnd.google-apps.folder" ||
    !webViewLink
  ) throw new GoogleDriveError("file_not_authorized", 403)

  return {
    id: fileId,
    name: file.name,
    mimeType: file.mimeType,
    webViewLink,
    thumbnailLink,
    driveId: typeof file.driveId === "string" ? file.driveId : null,
    modifiedAt: typeof file.modifiedTime === "string" ? file.modifiedTime : null,
    status: file.trashed === true ? "trashed" : "available",
  } as const
}
