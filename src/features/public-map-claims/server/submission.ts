import { shouldShowPublicMapResourceRow } from "@/lib/public-map/resource-item-visibility"
import { env } from "@/lib/env"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

import { parsePublicMapClaimInput } from "../lib"
import type { PublicMapClaimSubmitResult } from "../types"
import {
  hashPublicMapClaimRisk,
  readPublicMapClaimRiskIdentity,
} from "./security"

type SubmitRpcResult = {
  claimId?: unknown
  retryAfterSeconds?: unknown
  status?: unknown
}

async function resolveClaimableListing(targetId: string) {
  const admin = createSupabaseAdminClient()
  const { data, error } = await admin
    .from("resource_map_public_items")
    .select("organization_id, organization_name, platform_org_id, source_label, title, source_url")
    .eq("organization_id", targetId)
    .is("platform_org_id", null)
    .not("source_label", "is", null)
    .limit(80)

  if (error) return null
  const listing = data?.find((row) => row.organization_name && row.source_label &&
    !row.platform_org_id && shouldShowPublicMapResourceRow(row))
  if (!listing) return null
  return { id: listing.organization_id, name: listing.organization_name }
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

async function deliverClaim(claimId: string) {
  const ownerId = env.PUBLIC_MAP_CLAIM_OWNER_USER_ID
  const admin = createSupabaseAdminClient()

  if (!ownerId) {
    await admin
      .from("public_map_claim_requests")
      .update({
        delivery_error: "Claim delivery is not configured.",
        delivery_status: "failed",
      })
      .eq("id", claimId)
    return
  }

  const { data, error } = await admin.rpc("deliver_public_map_claim_request", {
    p_claim_id: claimId,
    p_owner_id: ownerId,
    p_project_id: null,
  })
  const result = asRecord(data)
  if (!error && result?.ok === true) return

  const code = typeof result?.code === "string" ? result.code : null
  await admin
    .from("public_map_claim_requests")
    .update({
      delivery_error: code
        ? `Claim delivery failed: ${code}.`
        : "Claim delivery failed.",
      delivery_status: "failed",
    })
    .eq("id", claimId)
}

export async function submitPublicMapClaimRequest({
  request,
  value,
}: {
  request: Request
  value: unknown
}): Promise<PublicMapClaimSubmitResult & { retryAfterSeconds?: number }> {
  const parsed = parsePublicMapClaimInput(value)
  if (!parsed.success || parsed.data.website) {
    return { code: "invalid", ok: false }
  }

  const listing = await resolveClaimableListing(parsed.data.targetId)
  if (!listing) return { code: "invalid", ok: false }

  const input = { ...parsed.data, listingName: listing.name }
  const riskKey = hashPublicMapClaimRisk(
    `risk:${readPublicMapClaimRiskIdentity(request)}`
  )
  const emailTargetKey = hashPublicMapClaimRisk(
    `email-target:${input.claimantEmail.toLowerCase()}:${input.targetKind}:${listing.id}`
  )
  if (!riskKey || !emailTargetKey) {
    return { code: "unavailable", ok: false }
  }

  const admin = createSupabaseAdminClient()
  const { data, error } = await admin.rpc("submit_public_map_claim_request", {
    p_target_kind: input.targetKind,
    p_target_id: listing.id,
    p_listing_name: input.listingName,
    p_claimant_name: input.claimantName,
    p_claimant_email: input.claimantEmail,
    p_message: input.message || null,
    p_submission_key: input.submissionKey,
    p_risk_key: riskKey,
    p_email_target_key: emailTargetKey,
  })
  if (error) return { code: "unavailable", ok: false }

  const result = asRecord(data) as SubmitRpcResult | null
  if (result?.status === "rate_limited") {
    return {
      code: "rate_limited",
      ok: false,
      retryAfterSeconds:
        typeof result.retryAfterSeconds === "number"
          ? result.retryAfterSeconds
          : 3600,
    }
  }
  if (result?.status !== "recorded" || typeof result.claimId !== "string") {
    return { code: "unavailable", ok: false }
  }

  await deliverClaim(result.claimId)
  return { claimId: result.claimId, ok: true }
}

export async function retryPublicMapClaimDelivery(claimId: string) {
  await deliverClaim(claimId)
}
