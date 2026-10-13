import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"

import { resolveDevtoolsAudience, resolveTesterMetadata } from "@/lib/devtools/audience"
import {
  collectStripeCheckoutPriceDiagnostics,
} from "@/lib/billing/stripe-checkout-diagnostics"
import {
  resolveStripePriceIdForPlan,
  resolveStripeRuntimeConfigForAudience,
  type StripeBillingPlanTier,
} from "@/lib/billing/stripe-runtime"
import { resolveActiveOrganization } from "@/lib/organization/active-org"
import { createSupabaseRouteHandlerClient } from "@/lib/supabase"
import { trackUserJourneyMilestone } from "@/lib/user-journey"

type CheckoutErrorCode =
  | "stripe_unavailable"
  | "operations_unavailable"
  | "missing_price"
  | "session_url_missing"
  | "checkout_failed"
  | "stripe_auth_error"
  | "price_not_found"
  | "stripe_invalid_request"
  | "stripe_permission_error"

function createDebugToken() {
  const random = Math.random().toString(36).slice(2, 8)
  return `${Date.now().toString(36)}-${random}`
}

function normalizeDetail(raw: string | null | undefined) {
  if (!raw) return null
  const value = raw.trim().toLowerCase()
  if (value.length === 0) return null
  if (!/^[a-z0-9_:-]{1,120}$/.test(value)) return null
  return value
}

function resolveCheckoutErrorCode(error: Stripe.errors.StripeError | null): CheckoutErrorCode {
  if (!error) return "checkout_failed"
  if (error.type === "StripeAuthenticationError") return "stripe_auth_error"
  if (error.type === "StripePermissionError") return "stripe_permission_error"
  if (error.type === "StripeInvalidRequestError") {
    if (error.code === "resource_missing" && (error.param ?? "").includes("line_items")) {
      return "price_not_found"
    }
    return "stripe_invalid_request"
  }
  return "checkout_failed"
}

function normalizeSource(raw: string | null) {
  const value = (raw ?? "").trim().toLowerCase()
  if (value.length === 0) return "billing"
  if (!/^[a-z0-9_-]{1,80}$/.test(value)) return "billing"
  return value
}

function getSafeInternalRedirect(raw: string | null) {
  if (!raw) return null
  const value = raw.trim()
  if (!value.startsWith("/")) return null
  if (value.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(value)) return null
  return value
}

function normalizeCheckoutContext(raw: string | null) {
  const value = (raw ?? "").trim().toLowerCase()
  if (value.length === 0) return null
  if (!/^[a-z0-9_-]{1,80}$/.test(value)) return null
  return value
}

function copySupabaseCookies(from: NextResponse, to: NextResponse) {
  for (const cookie of from.cookies.getAll()) {
    to.cookies.set(cookie)
  }
}

function buildInternalRedirectUrl({
  request,
  target,
  params,
}: {
  request: NextRequest
  target: string
  params?: Record<string, string | null | undefined>
}) {
  const url = new URL(target, request.url)
  for (const [key, value] of Object.entries(params ?? {})) {
    if (typeof value === "string" && value.length > 0) {
      url.searchParams.set(key, value)
    }
  }
  return url
}

function buildCheckoutRequestPath({
  planTier,
  source,
  redirectTarget,
  cancelTarget,
  checkoutContext,
}: {
  planTier: StripeBillingPlanTier
  source: string
  redirectTarget: string | null
  cancelTarget: string | null
  checkoutContext: string | null
}) {
  const params = new URLSearchParams({
    plan: planTier,
    source,
  })
  if (redirectTarget) {
    params.set("redirect", redirectTarget)
  }
  if (cancelTarget) {
    params.set("cancel", cancelTarget)
  }
  if (checkoutContext) {
    params.set("context", checkoutContext)
  }
  return `/api/stripe/checkout?${params.toString()}`
}

function buildErrorRedirect({
  request,
  supabaseResponse,
  returnTarget,
  planTier,
  source,
  code,
  detail,
  debugToken,
}: {
  request: NextRequest
  supabaseResponse: NextResponse
  returnTarget: string | null
  planTier: StripeBillingPlanTier
  source: string
  code: CheckoutErrorCode
  detail?: string | null
  debugToken?: string | null
}) {
  const destination = buildInternalRedirectUrl({
    request,
    target: returnTarget ?? "/organization",
  })
  destination.searchParams.set("paywall", "organization")
  destination.searchParams.set("plan", planTier)
  if (returnTarget) destination.searchParams.set("redirect", returnTarget)
  else destination.searchParams.set("source", source)
  destination.searchParams.set("checkout_error", code)
  if (detail) {
    destination.searchParams.set("checkout_detail", detail)
  }
  if (debugToken) {
    destination.searchParams.set("checkout_debug", debugToken)
  }

  const response = NextResponse.redirect(destination)
  copySupabaseCookies(supabaseResponse, response)
  return response
}

function buildLoginRedirect({
  request,
  supabaseResponse,
  source,
  planTier,
  redirectTarget,
  cancelTarget,
  checkoutContext,
}: {
  request: NextRequest
  supabaseResponse: NextResponse
  source: string
  planTier: StripeBillingPlanTier
  redirectTarget: string | null
  cancelTarget: string | null
  checkoutContext: string | null
}) {
  const nextPath = buildCheckoutRequestPath({
    planTier,
    source,
    redirectTarget,
    cancelTarget,
    checkoutContext,
  })
  const response = NextResponse.redirect(
    new URL(`/login?source=${encodeURIComponent(source)}&redirect=${encodeURIComponent(nextPath)}`, request.url),
  )
  copySupabaseCookies(supabaseResponse, response)
  return response
}

export async function GET(request: NextRequest) {
  const supabaseResponse = NextResponse.next()
  const supabase = createSupabaseRouteHandlerClient(request, supabaseResponse)

  const planParam = request.nextUrl.searchParams.get("plan")
  const planTier: StripeBillingPlanTier = planParam === "operations_support" ? "operations_support" : "organization"
  const planName = planTier === "operations_support" ? "Operations Support" : "Organization"
  const source = normalizeSource(request.nextUrl.searchParams.get("source"))
  const redirectTarget = getSafeInternalRedirect(request.nextUrl.searchParams.get("redirect"))
  const cancelTarget =
    getSafeInternalRedirect(request.nextUrl.searchParams.get("cancel")) ?? redirectTarget
  const checkoutContext = normalizeCheckoutContext(request.nextUrl.searchParams.get("context"))
  const debugToken = createDebugToken()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return buildLoginRedirect({
      request,
      supabaseResponse,
      source,
      planTier,
      redirectTarget,
      cancelTarget,
      checkoutContext,
    })
  }

  const fallbackIsTester = resolveTesterMetadata(user.user_metadata ?? null)
  const audience = await resolveDevtoolsAudience({
    supabase,
    userId: user.id,
    fallbackIsTester,
  })

  const stripeConfig = resolveStripeRuntimeConfigForAudience({ isTester: audience.isTester })
  if (!stripeConfig) {
    return buildErrorRedirect({
      request,
      supabaseResponse,
      returnTarget: cancelTarget ?? redirectTarget,
      planTier,
      source,
      code: "stripe_unavailable",
      debugToken,
    })
  }

  const priceId = resolveStripePriceIdForPlan({ config: stripeConfig, planTier })
  if (!priceId) {
    return buildErrorRedirect({
      request,
      supabaseResponse,
      returnTarget: cancelTarget ?? redirectTarget,
      planTier,
      source,
      code: planTier === "operations_support" ? "operations_unavailable" : "missing_price",
      debugToken,
    })
  }

  const userId = user.id
  let orgId: string
  try {
    const resolved = await resolveActiveOrganization(supabase, userId)
    orgId = resolved.orgId
  } catch {
    return buildErrorRedirect({ request, supabaseResponse, returnTarget: cancelTarget ?? redirectTarget,
      planTier, source, code: "checkout_failed", detail: "organization_unavailable", debugToken })
  }

  try {
    const successUrl = new URL("/pricing/success", request.nextUrl.origin)
    successUrl.searchParams.set("session_id", "{CHECKOUT_SESSION_ID}")
    if (redirectTarget) {
      successUrl.searchParams.set("redirect", redirectTarget)
    }
    if (checkoutContext) {
      successUrl.searchParams.set("context", checkoutContext)
    }

    const checkout = await stripeConfig.client.checkout.sessions.create({
      mode: "subscription",
      allow_promotion_codes: true,
      client_reference_id: userId,
      customer_email: user.email ?? undefined,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: {
        kind: "organization",
        user_id: userId,
        org_user_id: orgId,
        planName,
        plan_tier: planTier,
        stripe_mode: stripeConfig.mode,
        ...(checkoutContext ? { context: checkoutContext } : {}),
        ...(redirectTarget ? { redirect_after_success: redirectTarget } : {}),
      },
      subscription_data: {
        metadata: {
          kind: "organization",
          user_id: userId,
          org_user_id: orgId,
          planName,
          plan_tier: planTier,
          stripe_mode: stripeConfig.mode,
          ...(checkoutContext ? { context: checkoutContext } : {}),
          ...(redirectTarget ? { redirect_after_success: redirectTarget } : {}),
        },
      },
      success_url: successUrl.toString(),
      cancel_url: cancelTarget
        ? buildInternalRedirectUrl({
            request,
            target: cancelTarget,
            params: { cancelled: "true" },
          }).toString()
        : `${request.nextUrl.origin}/pricing?cancelled=true`,
    })

    if (!checkout.url) {
      return buildErrorRedirect({
        request,
        supabaseResponse,
        returnTarget: cancelTarget ?? redirectTarget,
        planTier,
        source,
        code: "session_url_missing",
        debugToken,
      })
    }

    await trackUserJourneyMilestone({
      userId,
      orgId,
      eventName: "checkout_started",
      journey: "paid_builder",
      source: "stripe_checkout_route",
      surface: "pricing_checkout",
      planTier,
      checkpoint: "checkout_started",
      metadata: {
        requestSource: source,
        checkoutContext,
        checkoutSessionId: checkout.id,
        stripeMode: stripeConfig.mode,
        stripeTarget: stripeConfig.target,
        hasRedirectTarget: Boolean(redirectTarget),
        hasCancelTarget: Boolean(cancelTarget),
      },
    })

    const response = NextResponse.redirect(checkout.url)
    copySupabaseCookies(supabaseResponse, response)
    return response
  } catch (error) {
    const stripeError = error as Stripe.errors.StripeError | null
    const resolvedCode = resolveCheckoutErrorCode(stripeError)
    const detail = normalizeDetail(stripeError?.code ?? stripeError?.type ?? null)
    const stripePriceDiagnostics =
      resolvedCode === "price_not_found"
        ? await collectStripeCheckoutPriceDiagnostics({
            priceId,
            selectedConfig: stripeConfig,
            preferTester: audience.isTester,
          })
        : null
    console.error("Unable to start Stripe checkout (route)", {
      message: error instanceof Error ? error.message : "unknown_error",
      planTier,
      source,
      userId,
      orgId,
      debugToken,
      fallbackIsTester,
      audienceIsTester: audience.isTester,
      stripeTarget: stripeConfig.target,
      stripeMode: stripeConfig.mode,
      selectedPriceId: priceId,
      stripeType: stripeError?.type ?? null,
      stripeCode: stripeError?.code ?? null,
      stripeParam: stripeError?.param ?? null,
      stripePriceDiagnostics,
    })

    return buildErrorRedirect({
      request,
      supabaseResponse,
      returnTarget: cancelTarget ?? redirectTarget,
      planTier,
      source,
      code: resolvedCode,
      detail,
      debugToken,
    })
  }
}
