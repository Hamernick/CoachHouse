import {
  downloadGoogleDriveDocument,
  downloadGoogleDriveThumbnail,
} from "./file-content"
import "server-only"

import { createHash, randomBytes } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import type { Database } from "@/lib/supabase"
import {
  canReuseGoogleDriveRefreshToken,
  normalizeGoogleDriveFileIds,
  normalizeGoogleDriveOAuthCallbackInput,
  normalizeGoogleDriveReturnPath,
} from "../lib"
import type {
  GoogleDriveConnectionSummary,
  GoogleDriveDocument,
} from "../types"
import { GoogleDriveError } from "../types"
import {
  getGoogleDriveConfig,
  getGoogleDrivePickerConfig,
  GOOGLE_DRIVE_SCOPES,
} from "./config"
import {
  exchangeGoogleDriveCode,
  getGoogleDriveFile,
  refreshGoogleDriveAccessToken,
} from "./google-api"
import {
  decryptGoogleDriveSecret,
  encryptGoogleDriveSecret,
} from "./token-crypto"

type AdminClient = SupabaseClient<Database>
type ConnectionRow =
  Database["public"]["Tables"]["google_drive_connections"]["Row"]

const INTENT_TTL_MS = 10 * 60 * 1000

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex")
}

function base64Url(bytes: number) {
  return randomBytes(bytes).toString("base64url")
}

function intentAad(userId: string, orgId: string) {
  return `google-drive:oauth-intent:${userId}:${orgId}`
}

function connectionAad(userId: string) {
  return `google-drive:connection:${userId}`
}

export async function startGoogleDriveConnection(input: {
  userId: string
  orgId: string
  returnPath?: unknown
}) {
  const config = getGoogleDriveConfig()
  const state = base64Url(32)
  const verifier = base64Url(64)
  const challenge = createHash("sha256").update(verifier).digest("base64url")
  const encrypted = encryptGoogleDriveSecret(
    verifier,
    intentAad(input.userId, input.orgId)
  )
  const returnPath = normalizeGoogleDriveReturnPath(input.returnPath)
  const admin = createSupabaseAdminClient()
  const { error: cleanupError } = await admin
    .from("google_drive_oauth_intents")
    .delete()
    .eq("user_id", input.userId)
  if (cleanupError) throw new GoogleDriveError("provider_unavailable", 503)
  const { error } = await admin.from("google_drive_oauth_intents").insert({
    user_id: input.userId,
    org_id: input.orgId,
    state_sha256: sha256(state),
    pkce_verifier_ciphertext: encrypted.ciphertext,
    pkce_verifier_iv: encrypted.iv,
    pkce_verifier_auth_tag: encrypted.authTag,
    key_version: encrypted.keyVersion,
    return_path: returnPath,
    expires_at: new Date(Date.now() + INTENT_TTL_MS).toISOString(),
  })
  if (error) throw new GoogleDriveError("provider_unavailable", 503)

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth")
  url.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: GOOGLE_DRIVE_SCOPES.join(" "),
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent select_account",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  }).toString()
  return url.toString()
}

export async function completeGoogleDriveConnection(input: {
  userId: string
  orgId: string
  state: string
  code: string
}) {
  const callbackInput = normalizeGoogleDriveOAuthCallbackInput(
    input.state,
    input.code
  )
  if (!callbackInput) throw new GoogleDriveError("invalid_state", 400)

  const admin = createSupabaseAdminClient()
  const { data: intent, error: intentError } = await admin
    .from("google_drive_oauth_intents")
    .select("*")
    .eq("state_sha256", sha256(callbackInput.state))
    .eq("user_id", input.userId)
    .eq("org_id", input.orgId)
    .is("consumed_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle()
  if (intentError) throw new GoogleDriveError("provider_unavailable", 503)
  if (!intent) throw new GoogleDriveError("invalid_state", 400)

  const now = new Date().toISOString()
  const { data: consumed, error: consumeError } = await admin
    .from("google_drive_oauth_intents")
    .update({ consumed_at: now })
    .eq("id", intent.id)
    .is("consumed_at", null)
    .select("id")
    .maybeSingle()
  if (consumeError) throw new GoogleDriveError("provider_unavailable", 503)
  if (!consumed) throw new GoogleDriveError("invalid_state", 400)

  const verifier = decryptGoogleDriveSecret(
    {
      ciphertext: intent.pkce_verifier_ciphertext,
      iv: intent.pkce_verifier_iv,
      authTag: intent.pkce_verifier_auth_tag,
      keyVersion: intent.key_version,
    },
    intentAad(input.userId, input.orgId)
  )
  const { error: intentDeleteError } = await admin
    .from("google_drive_oauth_intents")
    .delete()
    .eq("id", intent.id)
  if (intentDeleteError) throw new GoogleDriveError("provider_unavailable", 503)
  const result = await exchangeGoogleDriveCode(callbackInput.code, verifier)
  const { data: existing, error: existingError } = await admin
    .from("google_drive_connections")
    .select("*")
    .eq("user_id", input.userId)
    .maybeSingle()
  if (existingError) throw new GoogleDriveError("provider_unavailable", 503)

  let refreshToken = result.tokens.refresh_token
  if (
    !refreshToken &&
    existing &&
    canReuseGoogleDriveRefreshToken(existing.google_subject, result.subject) &&
    existing.refresh_token_ciphertext &&
    existing.refresh_token_iv &&
    existing.refresh_token_auth_tag &&
    existing.key_version
  ) {
    refreshToken = decryptGoogleDriveSecret(
      {
        ciphertext: existing.refresh_token_ciphertext,
        iv: existing.refresh_token_iv,
        authTag: existing.refresh_token_auth_tag,
        keyVersion: existing.key_version,
      },
      connectionAad(input.userId)
    )
  }
  if (!refreshToken) throw new GoogleDriveError("missing_refresh_token", 409)
  const encrypted = encryptGoogleDriveSecret(
    refreshToken,
    connectionAad(input.userId)
  )
  const { error } = await admin.from("google_drive_connections").upsert(
    {
      user_id: input.userId,
      google_subject: result.subject,
      google_email: result.email,
      refresh_token_ciphertext: encrypted.ciphertext,
      refresh_token_iv: encrypted.iv,
      refresh_token_auth_tag: encrypted.authTag,
      key_version: encrypted.keyVersion,
      granted_scopes: result.scopes,
      status: "connected",
      last_verified_at: now,
      last_error_code: null,
      connected_at: now,
      disconnected_at: null,
    },
    { onConflict: "user_id" }
  )
  if (error) throw new GoogleDriveError("provider_unavailable", 503)
  return intent.return_path
}

async function getConnection(
  admin: AdminClient,
  userId: string
): Promise<ConnectionRow> {
  const { data, error } = await admin
    .from("google_drive_connections")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "connected")
    .maybeSingle()
  if (error) throw new GoogleDriveError("provider_unavailable", 503)
  if (!data) throw new GoogleDriveError("google_revoked", 409)
  return data
}

async function getAccessToken(admin: AdminClient, userId: string) {
  const connection = await getConnection(admin, userId)
  if (
    !connection.refresh_token_ciphertext ||
    !connection.refresh_token_iv ||
    !connection.refresh_token_auth_tag ||
    !connection.key_version
  ) {
    throw new GoogleDriveError("google_revoked", 409)
  }
  const refreshToken = decryptGoogleDriveSecret(
    {
      ciphertext: connection.refresh_token_ciphertext,
      iv: connection.refresh_token_iv,
      authTag: connection.refresh_token_auth_tag,
      keyVersion: connection.key_version,
    },
    connectionAad(userId)
  )
  try {
    const accessToken = await refreshGoogleDriveAccessToken(refreshToken)
    await admin
      .from("google_drive_connections")
      .update({
        last_verified_at: new Date().toISOString(),
        last_error_code: null,
      })
      .eq("id", connection.id)
    return { accessToken, connection }
  } catch (error) {
    if (error instanceof GoogleDriveError && error.code === "google_revoked") {
      await disconnectGoogleDrive({
        admin,
        userId,
        status: "revoked",
        revoke: false,
      })
    }
    throw error
  }
}

export async function getGoogleDriveConnection(
  userId: string
): Promise<GoogleDriveConnectionSummary> {
  const admin = createSupabaseAdminClient()
  const { data, error } = await admin
    .from("google_drive_connections")
    .select("google_email,status")
    .eq("user_id", userId)
    .maybeSingle()
  if (error) throw new GoogleDriveError("provider_unavailable", 503)
  if (!data)
    return { connected: false, googleEmail: null, status: "not_connected" }
  return {
    connected: data.status === "connected",
    googleEmail: data.status === "connected" ? data.google_email : null,
    status: data.status as GoogleDriveConnectionSummary["status"],
  }
}

export async function createGoogleDrivePickerToken(userId: string) {
  const pickerConfig = getGoogleDrivePickerConfig()
  const { accessToken } = await getAccessToken(
    createSupabaseAdminClient(),
    userId
  )
  return { accessToken, ...pickerConfig }
}

export async function attachGoogleDriveDocuments(input: {
  userId: string
  orgId: string
  fileIds: unknown
}) {
  const fileIds = normalizeGoogleDriveFileIds(input.fileIds)
  if (!fileIds) throw new GoogleDriveError("invalid", 400)
  const admin = createSupabaseAdminClient()
  const { accessToken, connection } = await getAccessToken(admin, input.userId)
  const files = await Promise.all(
    fileIds.map((id) => getGoogleDriveFile(accessToken, id))
  )
  const now = new Date().toISOString()
  const { error } = await admin.from("organization_external_documents").upsert(
    files.map((file) => ({
      org_id: input.orgId,
      provider: "google_drive",
      provider_file_id: file.id,
      connection_id: connection.id,
      name: file.name,
      mime_type: file.mimeType,
      web_view_link: file.webViewLink,
      drive_id: file.driveId,
      modified_at: file.modifiedAt,
      status: file.status,
      attached_by: input.userId,
      last_verified_at: now,
    })),
    { onConflict: "org_id,provider,provider_file_id" }
  )
  if (error) throw new GoogleDriveError("provider_unavailable", 503)
  return files.length
}

export async function listGoogleDriveDocuments(
  supabase: SupabaseClient<Database>,
  orgId: string
): Promise<GoogleDriveDocument[]> {
  const { data, error } = await supabase
    .from("organization_external_documents")
    .select("id,name,mime_type,web_view_link,modified_at,status")
    .eq("org_id", orgId)
    .eq("provider", "google_drive")
    .order("name", { ascending: true })
  if (error) throw new GoogleDriveError("provider_unavailable", 503)
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    mimeType: row.mime_type,
    webViewLink: row.web_view_link,
    modifiedAt: row.modified_at,
    status: row.status as GoogleDriveDocument["status"],
  }))
}

export async function getGoogleDriveDocumentThumbnail(input: {
  documentId: string
  orgId: string
}) {
  if (!/^[0-9a-f-]{36}$/i.test(input.documentId))
    throw new GoogleDriveError("invalid", 400)
  const admin = createSupabaseAdminClient()
  const { data: document, error: documentError } = await admin
    .from("organization_external_documents")
    .select("provider_file_id,connection_id,status")
    .eq("id", input.documentId)
    .eq("org_id", input.orgId)
    .eq("provider", "google_drive")
    .maybeSingle()
  if (documentError) throw new GoogleDriveError("provider_unavailable", 503)
  if (!document || document.status !== "available" || !document.connection_id) {
    throw new GoogleDriveError("file_not_authorized", 403)
  }
  const { data: ownerConnection, error: connectionError } = await admin
    .from("google_drive_connections")
    .select("id,user_id,status")
    .eq("id", document.connection_id)
    .maybeSingle()
  if (connectionError) throw new GoogleDriveError("provider_unavailable", 503)
  if (!ownerConnection || ownerConnection.status !== "connected")
    throw new GoogleDriveError("google_revoked", 409)
  const { accessToken, connection } = await getAccessToken(
    admin,
    ownerConnection.user_id
  )
  if (connection.id !== document.connection_id)
    throw new GoogleDriveError("file_not_authorized", 403)
  return downloadGoogleDriveThumbnail(accessToken, document.provider_file_id)
}

export async function detachGoogleDriveDocument(
  documentId: string,
  orgId: string
) {
  if (!/^[0-9a-f-]{36}$/i.test(documentId))
    throw new GoogleDriveError("invalid", 400)
  const { error, count } = await createSupabaseAdminClient()
    .from("organization_external_documents")
    .delete({ count: "exact" })
    .eq("id", documentId)
    .eq("org_id", orgId)
  if (error || count !== 1) throw new GoogleDriveError("invalid", 404)
}

export async function disconnectGoogleDrive(input: {
  admin?: AdminClient
  userId: string
  status?: "disconnected" | "revoked"
  revoke?: boolean
}) {
  const admin = input.admin ?? createSupabaseAdminClient()
  const { data: connection, error: connectionError } = await admin
    .from("google_drive_connections")
    .select("*")
    .eq("user_id", input.userId)
    .maybeSingle()
  if (connectionError) throw new GoogleDriveError("provider_unavailable", 503)
  if (!connection) return
  // A feature disconnect clears its credentials. Google token revocation also
  // invalidates Calendar/login grants in the same project, so leave that to
  // the user's Google account-wide access controls.
  const { error } = await admin
    .from("google_drive_connections")
    .update({
      refresh_token_ciphertext: null,
      refresh_token_iv: null,
      refresh_token_auth_tag: null,
      key_version: null,
      status: input.status ?? "disconnected",
      disconnected_at: new Date().toISOString(),
    })
    .eq("id", connection.id)
  if (error) throw new GoogleDriveError("provider_unavailable", 503)
}

export async function importGoogleDriveFile(input: {
  userId: string
  fileId: unknown
}) {
  const ids = normalizeGoogleDriveFileIds([input.fileId])
  if (!ids) throw new GoogleDriveError("invalid", 400)
  const { accessToken } = await getAccessToken(
    createSupabaseAdminClient(),
    input.userId
  )
  return downloadGoogleDriveDocument(accessToken, ids[0])
}
