import { headers } from "next/headers"

import {
  buildOrganizationAccessRequestEmail,
  buildOrganizationAccessRequestEmailSubject,
  buildOrganizationInviteEmail,
  buildOrganizationInviteEmailSubject,
} from "@/features/organization-access/client"
import { sendResendEmail } from "@/lib/email/resend"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { type OrganizationMemberRole } from "./shared"

const INVITE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000

export async function resolveAppOrigin() {
  const requestHeaders = await headers()
  const explicitOrigin = requestHeaders.get("origin")?.trim()
  if (explicitOrigin) return explicitOrigin.replace(/\/$/, "")

  const forwardedHost = requestHeaders.get("x-forwarded-host")?.trim()
  if (forwardedHost) {
    const forwardedProto = requestHeaders.get("x-forwarded-proto")?.trim() || "https"
    return `${forwardedProto}://${forwardedHost}`.replace(/\/$/, "")
  }

  const host = requestHeaders.get("host")?.trim()
  if (host) {
    const proto = host.includes("localhost") ? "http" : "https"
    return `${proto}://${host}`.replace(/\/$/, "")
  }

  const configuredOrigin =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "http://localhost:3000"

  return configuredOrigin.replace(/\/$/, "")
}

export function expiresInSevenDays() {
  return new Date(Date.now() + INVITE_EXPIRY_MS).toISOString()
}

function formatInviteExpiryLabel(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

export function resolveDisplayName(value: string | null | undefined, fallback: string) {
  if (typeof value === "string" && value.trim().length > 0) return value.trim()
  return fallback
}

export async function archiveAccessRequestNotifications({
  adminClient,
  requestId,
  userId,
}: {
  adminClient: ReturnType<typeof createSupabaseAdminClient>
  requestId: string
  userId: string
}) {
  await adminClient
    .from("notifications")
    .update({ archived_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("type", "organization_access_request")
    .contains("metadata", { requestId })
}

export async function sendExistingUserAccessRequestEmail({
  to,
  siteUrl,
  organizationName,
  inviterName,
  role,
  reviewUrl,
  expiresAt,
}: {
  to: string
  siteUrl: string
  organizationName: string
  inviterName: string
  role: OrganizationMemberRole
  reviewUrl: string
  expiresAt: string
}) {
  return sendResendEmail({
    to,
    subject: buildOrganizationAccessRequestEmailSubject({
      organizationName,
    }),
    ...buildOrganizationAccessRequestEmail({
      siteUrl,
      organizationName,
      reviewUrl,
      inviterName,
      role,
      respondBy: formatInviteExpiryLabel(expiresAt),
    }),
    tags: [
      { name: "category", value: "organization-access-request" },
      { name: "organization", value: organizationName.slice(0, 64) },
    ],
  })
}

export async function sendExternalOrganizationInviteEmail({
  to,
  siteUrl,
  organizationName,
  inviterName,
  role,
  inviteUrl,
  expiresAt,
}: {
  to: string
  siteUrl: string
  organizationName: string
  inviterName: string
  role: OrganizationMemberRole
  inviteUrl: string
  expiresAt: string
}) {
  return sendResendEmail({
    to,
    subject: buildOrganizationInviteEmailSubject({
      organizationName,
      role: role === "owner" ? "admin" : role,
    }),
    ...buildOrganizationInviteEmail({
      siteUrl,
      organizationName,
      role: role === "owner" ? "admin" : role,
      joinUrl: inviteUrl,
      inviterName,
      respondBy: formatInviteExpiryLabel(expiresAt),
    }),
    tags: [
      { name: "category", value: "organization-invite" },
      { name: "organization", value: organizationName.slice(0, 64) },
    ],
  })
}
