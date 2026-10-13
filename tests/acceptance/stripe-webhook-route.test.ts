import { toStatus } from "@/app/api/stripe/webhook/_lib/metadata"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const {
  createSupabaseAdminClientMock,
  constructEventMock,
  subscriptionsCreateMock,
  subscriptionsRetrieveMock,
  subscriptionsUpdateMock,
  confirmCoachingBookingMock,
  loadCoachingBookingForConfirmationMock,
} = vi.hoisted(() => ({
  createSupabaseAdminClientMock: vi.fn(),
  constructEventMock: vi.fn(),
  subscriptionsCreateMock: vi.fn(),
  subscriptionsRetrieveMock: vi.fn(),
  subscriptionsUpdateMock: vi.fn(),
  confirmCoachingBookingMock: vi.fn(),
  loadCoachingBookingForConfirmationMock: vi.fn(),
}))

vi.mock("@/lib/supabase", async () => {
  const actual = await vi.importActual<typeof import("@/lib/supabase")>("@/lib/supabase")
  return {
    ...actual,
    createSupabaseAdminClient: createSupabaseAdminClientMock,
  }
})

vi.mock("@/lib/env", () => ({
  env: {
    STRIPE_SECRET_KEY: "sk_test_webhook",
    STRIPE_WEBHOOK_SECRET: "whsec_test_webhook",
    STRIPE_ORGANIZATION_PRICE_ID: "price_org",
    STRIPE_ACCELERATOR_WITH_COACHING_PRICE_ID: undefined,
    STRIPE_ACCELERATOR_WITHOUT_COACHING_PRICE_ID: undefined,
    STRIPE_ACCELERATOR_WITH_COACHING_MONTHLY_PRICE_ID: undefined,
    STRIPE_ACCELERATOR_WITHOUT_COACHING_MONTHLY_PRICE_ID: undefined,
    STRIPE_ACCELERATOR_PRICE_ID: undefined,
    STRIPE_ELECTIVE_RETENTION_AND_SECURITY_PRICE_ID: undefined,
    STRIPE_ELECTIVE_DUE_DILIGENCE_PRICE_ID: undefined,
    STRIPE_ELECTIVE_FINANCIAL_HANDBOOK_PRICE_ID: undefined,
    NEXT_PUBLIC_MEETING_FREE_URL: undefined,
    NEXT_PUBLIC_MEETING_DISCOUNTED_URL: undefined,
    NEXT_PUBLIC_MEETING_FULL_URL: undefined,
  },
}))

vi.mock("@/features/coaching-booking/server/booking-finalizer", () => ({
  confirmCoachingBooking: confirmCoachingBookingMock,
  loadCoachingBookingForConfirmation: loadCoachingBookingForConfirmationMock,
}))

class StripeMock {
  webhooks = {
    constructEvent: constructEventMock,
  }

  subscriptions = {
    create: subscriptionsCreateMock,
    retrieve: subscriptionsRetrieveMock,
    update: subscriptionsUpdateMock,
  }
}

vi.mock("stripe", () => ({
  default: StripeMock,
}))

function createAdminSupabaseStub(options?: {
  existingActiveSubscription?: boolean
  eventInsertError?: { code: string } | null
  existingEventProcessed?: boolean
  subscriptionsUpsertError?: { code?: string; message?: string } | null
  acceleratorPurchasesUpsertError?: { code?: string; message?: string } | null
  electivePurchasesUpsertError?: { code?: string; message?: string } | null
  stripeEventsUpdateError?: { code?: string; message?: string } | null
}) {
  const existingActiveSubscription = options?.existingActiveSubscription ?? false
  const eventInsertError = options?.eventInsertError ?? null
  const existingEventProcessed = options?.existingEventProcessed ?? false
  const subscriptionsUpsertError = options?.subscriptionsUpsertError ?? null
  const acceleratorPurchasesUpsertError =
    options?.acceleratorPurchasesUpsertError ?? null
  const electivePurchasesUpsertError = options?.electivePurchasesUpsertError ?? null
  const stripeEventsUpdateError = options?.stripeEventsUpdateError ?? null

  const stripeEventsInsert = vi.fn().mockResolvedValue({ error: eventInsertError })
  const stripeEventsSelectMaybeSingle = vi
    .fn()
    .mockResolvedValue({ data: { payload: { processed: existingEventProcessed } }, error: null })
  const stripeEventsUpdateEq = vi
    .fn()
    .mockResolvedValue({ error: stripeEventsUpdateError })
  const stripeEventsUpdate = vi.fn().mockReturnValue({
    eq: stripeEventsUpdateEq,
  })

  const subscriptionsUpsert = vi
    .fn()
    .mockResolvedValue({ error: subscriptionsUpsertError })
  const subscriptionsMaybeSingle = vi.fn().mockResolvedValue({
    data: existingActiveSubscription ? { id: "sub_existing", status: "active" } : null,
    error: null,
  })

  const subscriptionsTable = {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            maybeSingle: subscriptionsMaybeSingle,
          }),
        }),
      }),
    }),
    upsert: subscriptionsUpsert,
  }

  const acceleratorPurchasesUpsert = vi
    .fn()
    .mockResolvedValue({ error: acceleratorPurchasesUpsertError })
  const electivePurchasesUpsert = vi
    .fn()
    .mockResolvedValue({ error: electivePurchasesUpsertError })

  const from = vi.fn((table: string) => {
    if (table === "stripe_webhook_events") {
      return {
        insert: stripeEventsInsert,
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: stripeEventsSelectMaybeSingle,
          }),
        }),
        update: stripeEventsUpdate,
      }
    }
    if (table === "subscriptions") return subscriptionsTable
    if (table === "accelerator_purchases") return { upsert: acceleratorPurchasesUpsert }
    if (table === "elective_purchases") return { upsert: electivePurchasesUpsert }
    throw new Error(`Unexpected table: ${table}`)
  })

  return {
    admin: {
      auth: {
        admin: {
          getUserById: vi.fn().mockResolvedValue({
            data: { user: { email: "member@example.com" } },
            error: null,
          }),
        },
      },
      from,
      rpc: vi.fn().mockResolvedValue({ data: "credit-grant", error: null }),
    },
    calls: {
      subscriptionsCreate: subscriptionsCreateMock,
      subscriptionsRetrieve: subscriptionsRetrieveMock,
      subscriptionsUpdate: subscriptionsUpdateMock,
      subscriptionsUpsert,
      acceleratorPurchasesUpsert,
      electivePurchasesUpsert,
      stripeEventsUpdateEq,
    },
  }
}

async function runWebhook() {
  const { POST } = await import("@/app/api/stripe/webhook/route")
  const request = new NextRequest("http://localhost/api/stripe/webhook", {
    method: "POST",
    headers: { "stripe-signature": "sig_test" },
    body: "{}",
  })
  return POST(request)
}

describe("stripe webhook route acceptance", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    subscriptionsRetrieveMock.mockReset()
    loadCoachingBookingForConfirmationMock.mockReset()
    confirmCoachingBookingMock.mockReset()
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
    consoleWarnSpy.mockRestore()
  })

  it("returns 400 when stripe signature header is missing", async () => {
    const { admin } = createAdminSupabaseStub()
    createSupabaseAdminClientMock.mockReturnValue(admin)

    const { POST } = await import("@/app/api/stripe/webhook/route")
    const request = new NextRequest("http://localhost/api/stripe/webhook", {
      method: "POST",
      body: "{}",
    })
    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload).toMatchObject({ error: "Missing signature" })
    expect(constructEventMock).not.toHaveBeenCalled()
  })

  it("does not roll over to organization plan for early monthly cancellation", async () => {
    const { admin, calls } = createAdminSupabaseStub({ existingActiveSubscription: false })
    createSupabaseAdminClientMock.mockReturnValue(admin)

    constructEventMock.mockReturnValue({
      id: "evt_early_cancel",
      type: "customer.subscription.deleted",
      data: {
        object: {
          id: "sub_accel_early",
          status: "canceled",
          customer: "cus_early",
          metadata: {
            user_id: "user_early",
            kind: "accelerator",
            accelerator_billing: "monthly",
            accelerator_installment_limit: "10",
            accelerator_installments_paid: "3",
          },
        },
      },
    })

    const response = await runWebhook()

    expect(response.status).toBe(200)
    expect(calls.subscriptionsCreate).not.toHaveBeenCalled()
    expect(calls.subscriptionsUpsert).toHaveBeenCalled()
  })

  it("rolls over to organization plan when monthly installments are complete and canceled", async () => {
    const { admin, calls } = createAdminSupabaseStub({ existingActiveSubscription: false })
    createSupabaseAdminClientMock.mockReturnValue(admin)

    subscriptionsCreateMock.mockResolvedValue({
      id: "sub_org_rollover",
      status: "trialing",
      customer: "cus_done",
      current_period_end: 1_900_000_000,
      metadata: {
        user_id: "user_done",
        planName: "Organization",
        context: "accelerator_rollover",
      },
    })

    constructEventMock.mockReturnValue({
      id: "evt_complete_cancel",
      type: "customer.subscription.deleted",
      data: {
        object: {
          id: "sub_accel_done",
          status: "canceled",
          customer: "cus_done",
          metadata: {
            user_id: "user_done",
            kind: "accelerator",
            accelerator_billing: "monthly",
            accelerator_installment_limit: "10",
            accelerator_installments_paid: "10",
          },
        },
      },
    })

    const response = await runWebhook()

    expect(response.status).toBe(200)
    expect(calls.subscriptionsCreate).toHaveBeenCalledTimes(1)
    expect(calls.subscriptionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: "cus_done",
        items: [{ price: "price_org" }],
        metadata: expect.objectContaining({
          user_id: "user_done",
          context: "accelerator_rollover",
        }),
      }),
      expect.objectContaining({
        idempotencyKey: expect.stringContaining("accelerator_rollover_sub_accel_done"),
      }),
    )
  })

  it("hands coaching checkout metadata to the booking finalizer", async () => {
    const { admin, calls } = createAdminSupabaseStub()
    createSupabaseAdminClientMock.mockReturnValue(admin)
    loadCoachingBookingForConfirmationMock.mockResolvedValue({
      id: "booking-1",
      stripe_checkout_session_id: "cs_coaching",
      org_id: "org-1",
      user_id: "user-1",
      coach_id: "joel",
      status: "pending_payment",
      price_tier: "discounted",
      starts_at: "2026-06-01T15:00:00.000Z",
      ends_at: "2026-06-01T16:00:00.000Z",
      timezone: "America/New_York",
      google_event_id: null,
      google_meet_url: null,
    })
    confirmCoachingBookingMock.mockResolvedValue({ id: "booking-1" })

    constructEventMock.mockReturnValue({
      id: "evt_coaching_checkout",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_coaching",
          payment_status: "paid",
          mode: "payment",
          metadata: {
            kind: "coaching_booking",
            booking_id: "booking-1",
            user_id: "user-1",
            org_user_id: "org-1",
            price_tier: "discounted",
          },
          payment_intent: "pi_coaching",
          customer: "cus_coaching",
        },
      },
    })

    const response = await runWebhook()

    expect(response.status).toBe(200)
    expect(loadCoachingBookingForConfirmationMock).toHaveBeenCalledWith({
      admin,
      bookingId: "booking-1",
    })
    expect(confirmCoachingBookingMock).toHaveBeenCalledWith(
      expect.objectContaining({
        admin,
        attendeeEmail: "member@example.com",
        stripeCheckoutSessionId: "cs_coaching",
        stripePaymentIntentId: "pi_coaching",
        stripeCustomerId: "cus_coaching",
      }),
    )
    expect(calls.subscriptionsRetrieve).not.toHaveBeenCalled()
    expect(calls.subscriptionsUpsert).not.toHaveBeenCalled()
  })

  it("rolls over on customer.subscription.updated when status transitions to canceled after completed installments", async () => {
    const { admin, calls } = createAdminSupabaseStub({ existingActiveSubscription: false })
    createSupabaseAdminClientMock.mockReturnValue(admin)

    subscriptionsCreateMock.mockResolvedValue({
      id: "sub_org_rollover_updated",
      status: "trialing",
      customer: "cus_updated",
      current_period_end: 1_900_000_000,
      metadata: {
        user_id: "user_updated",
        planName: "Organization",
        context: "accelerator_rollover",
      },
    })

    constructEventMock.mockReturnValue({
      id: "evt_updated_canceled",
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_accel_updated",
          status: "canceled",
          customer: "cus_updated",
          metadata: {
            user_id: "user_updated",
            kind: "accelerator",
            accelerator_billing: "monthly",
            accelerator_installment_limit: "10",
            accelerator_installments_paid: "10",
          },
        },
      },
    })

    const response = await runWebhook()

    expect(response.status).toBe(200)
    expect(calls.subscriptionsCreate).toHaveBeenCalledTimes(1)
    expect(calls.subscriptionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: "cus_updated",
        metadata: expect.objectContaining({
          user_id: "user_updated",
          context: "accelerator_rollover",
        }),
      }),
      expect.objectContaining({
        idempotencyKey: expect.stringContaining("accelerator_rollover_sub_accel_updated"),
      }),
    )
  })

  it("does not roll over on customer.subscription.updated when status remains active", async () => {
    const { admin, calls } = createAdminSupabaseStub({ existingActiveSubscription: false })
    createSupabaseAdminClientMock.mockReturnValue(admin)

    constructEventMock.mockReturnValue({
      id: "evt_updated_active",
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_accel_active",
          status: "active",
          customer: "cus_active",
          items: { data: [{ current_period_end: 1_900_000_000 }] },
          cancel_at: 1_900_000_000,
          canceled_at: null,
          metadata: {
            user_id: "user_active",
            kind: "accelerator",
            accelerator_billing: "monthly",
            accelerator_installment_limit: "10",
            accelerator_installments_paid: "10",
          },
        },
      },
    })

    const response = await runWebhook()

    expect(response.status).toBe(200)
    expect(calls.subscriptionsCreate).not.toHaveBeenCalled()
    expect(calls.subscriptionsUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user_active",
        stripe_subscription_id: "sub_accel_active",
        status: "active",
        current_period_end: "2030-03-17T17:46:40.000Z",
        cancel_at: "2030-03-17T17:46:40.000Z",
        canceled_at: null,
      }),
      expect.objectContaining({ onConflict: "user_id,stripe_subscription_id" }),
    )
  })

  it("does not roll over on customer.subscription.updated with past_due status", async () => {
    const { admin, calls } = createAdminSupabaseStub({ existingActiveSubscription: false })
    createSupabaseAdminClientMock.mockReturnValue(admin)

    constructEventMock.mockReturnValue({
      id: "evt_updated_past_due",
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_accel_past_due",
          status: "past_due",
          customer: "cus_past_due",
          metadata: {
            user_id: "user_past_due",
            kind: "accelerator",
            accelerator_billing: "monthly",
            accelerator_installment_limit: "10",
            accelerator_installments_paid: "10",
          },
        },
      },
    })

    const response = await runWebhook()

    expect(response.status).toBe(200)
    expect(calls.subscriptionsCreate).not.toHaveBeenCalled()
    expect(calls.subscriptionsUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user_past_due",
        stripe_subscription_id: "sub_accel_past_due",
        status: "past_due",
      }),
      expect.objectContaining({ onConflict: "user_id,stripe_subscription_id" }),
    )
  })

  it("does not create duplicate organization subscription when one-time accelerator buyer already has active org plan", async () => {
    const { admin, calls } = createAdminSupabaseStub({ existingActiveSubscription: true })
    createSupabaseAdminClientMock.mockReturnValue(admin)

    constructEventMock.mockReturnValue({
      id: "evt_one_time_existing_org",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_accel_1",
          mode: "payment",
          client_reference_id: "user_existing",
          customer: "cus_existing",
          payment_intent: "pi_existing",
          metadata: {
            kind: "accelerator",
            accelerator_variant: "with_coaching",
            coaching_included: "true",
            accelerator_billing: "one_time",
          },
        },
      },
    })

    const response = await runWebhook()

    expect(response.status).toBe(200)
    expect(calls.acceleratorPurchasesUpsert).toHaveBeenCalledTimes(1)
    expect(calls.subscriptionsCreate).not.toHaveBeenCalled()
  })

  it("upserts subscription rows for checkout.session.completed in subscription mode", async () => {
    const { admin, calls } = createAdminSupabaseStub({ existingActiveSubscription: false })
    createSupabaseAdminClientMock.mockReturnValue(admin)
    subscriptionsRetrieveMock.mockResolvedValue({
      id: "sub_accelerator_monthly",
      customer: "cus_sub_mode",
      status: "active",
      current_period_end: 1_900_000_000,
      cancel_at: null,
      canceled_at: null,
      metadata: {
        kind: "accelerator",
        user_id: "user_sub_mode",
        planName: "Accelerator Pro",
        accelerator_billing: "monthly",
      },
    })

    constructEventMock.mockReturnValue({
      id: "evt_checkout_subscription_mode",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_subscription_mode",
          mode: "subscription",
          status: "complete",
          client_reference_id: "user_sub_mode",
          subscription: "sub_accelerator_monthly",
          customer: "cus_sub_mode",
          metadata: {
            kind: "accelerator",
            user_id: "user_sub_mode",
            planName: "Accelerator Pro",
            accelerator_billing: "monthly",
          },
        },
      },
    })

    const response = await runWebhook()

    expect(response.status).toBe(200)
    expect(calls.subscriptionsRetrieve).toHaveBeenCalledWith(
      "sub_accelerator_monthly",
    )
    expect(calls.subscriptionsUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user_sub_mode",
        stripe_subscription_id: "sub_accelerator_monthly",
        stripe_customer_id: "cus_sub_mode",
        status: "active",
        current_period_end: "2030-03-17T17:46:40.000Z",
        cancel_at: null,
        canceled_at: null,
        metadata: expect.objectContaining({
          kind: "accelerator",
          planName: "Accelerator Pro",
          accelerator_billing: "monthly",
        }),
      }),
      expect.objectContaining({ onConflict: "user_id,stripe_subscription_id" }),
    )
  })

  it("does not create organization subscription for one-time accelerator checkout when customer is missing", async () => {
    const { admin, calls } = createAdminSupabaseStub({ existingActiveSubscription: false })
    createSupabaseAdminClientMock.mockReturnValue(admin)

    constructEventMock.mockReturnValue({
      id: "evt_one_time_no_customer",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_one_time_no_customer",
          mode: "payment",
          client_reference_id: "user_no_customer",
          payment_intent: "pi_no_customer",
          metadata: {
            kind: "accelerator",
            accelerator_variant: "with_coaching",
            coaching_included: "true",
            accelerator_billing: "one_time",
          },
        },
      },
    })

    const response = await runWebhook()

    expect(response.status).toBe(200)
    expect(calls.acceleratorPurchasesUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user_no_customer",
        stripe_customer_id: null,
      }),
      expect.objectContaining({ onConflict: "stripe_checkout_session_id" }),
    )
    expect(calls.subscriptionsCreate).not.toHaveBeenCalled()
  })

  it("returns duplicate response and skips side effects for already-processed webhook events", async () => {
    const { admin, calls } = createAdminSupabaseStub({
      eventInsertError: { code: "23505" },
      existingEventProcessed: true,
    })
    createSupabaseAdminClientMock.mockReturnValue(admin)

    constructEventMock.mockReturnValue({
      id: "evt_duplicate",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_duplicate",
          mode: "payment",
          client_reference_id: "user_duplicate",
          customer: "cus_duplicate",
          payment_intent: "pi_duplicate",
          metadata: {
            kind: "accelerator",
            accelerator_variant: "with_coaching",
            coaching_included: "true",
            accelerator_billing: "one_time",
          },
        },
      },
    })

    const response = await runWebhook()
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toMatchObject({ duplicate: true, received: true })
    expect(calls.acceleratorPurchasesUpsert).not.toHaveBeenCalled()
    expect(calls.subscriptionsCreate).not.toHaveBeenCalled()
    expect(calls.subscriptionsUpsert).not.toHaveBeenCalled()
  })

  it("reprocesses duplicate event when previous attempt was unprocessed", async () => {
    const { admin, calls } = createAdminSupabaseStub({
      eventInsertError: { code: "23505" },
      existingEventProcessed: false,
    })
    createSupabaseAdminClientMock.mockReturnValue(admin)

    constructEventMock.mockReturnValue({
      id: "evt_retry_unprocessed",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_retry_unprocessed",
          mode: "payment",
          client_reference_id: "user_retry",
          customer: "cus_retry",
          payment_intent: "pi_retry",
          metadata: {
            kind: "accelerator",
            accelerator_variant: "with_coaching",
            coaching_included: "true",
            accelerator_billing: "one_time",
          },
        },
      },
    })

    const response = await runWebhook()
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toMatchObject({ received: true })
    expect(calls.acceleratorPurchasesUpsert).toHaveBeenCalledTimes(1)
  })

  it("returns 500 when webhook idempotency lock write fails with non-duplicate error", async () => {
    const { admin } = createAdminSupabaseStub({
      eventInsertError: { code: "XX000" },
    })
    createSupabaseAdminClientMock.mockReturnValue(admin)

    constructEventMock.mockReturnValue({
      id: "evt_lock_failure",
      type: "invoice.paid",
      data: {
        object: {
          id: "in_lock_failure",
          billing_reason: "subscription_cycle",
          subscription: "sub_lock_failure",
        },
      },
    })

    const response = await runWebhook()
    const payload = await response.json()

    expect(response.status).toBe(500)
    expect(payload).toMatchObject({ received: true, error: "processing_failed" })
  })

  it("returns 500 when a subscription upsert fails during webhook processing", async () => {
    const { admin, calls } = createAdminSupabaseStub({
      subscriptionsUpsertError: {
        code: "23514",
        message: "subscription upsert failed",
      },
    })
    createSupabaseAdminClientMock.mockReturnValue(admin)
    subscriptionsRetrieveMock.mockResolvedValue({
      id: "sub_accelerator_failure",
      customer: "cus_sub_mode_failure",
      status: "active",
      current_period_end: 1_900_000_000,
      cancel_at: null,
      canceled_at: null,
      metadata: {
        kind: "accelerator",
        user_id: "user_sub_mode_failure",
        planName: "Accelerator Pro",
        accelerator_billing: "monthly",
      },
    })

    constructEventMock.mockReturnValue({
      id: "evt_checkout_subscription_upsert_failure",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_subscription_upsert_failure",
          mode: "subscription",
          status: "complete",
          client_reference_id: "user_sub_mode_failure",
          subscription: "sub_accelerator_failure",
          customer: "cus_sub_mode_failure",
          metadata: {
            kind: "accelerator",
            user_id: "user_sub_mode_failure",
            planName: "Accelerator Pro",
            accelerator_billing: "monthly",
          },
        },
      },
    })

    const response = await runWebhook()
    const payload = await response.json()

    expect(response.status).toBe(500)
    expect(payload).toMatchObject({ received: true, error: "processing_failed" })
    expect(calls.subscriptionsUpsert).toHaveBeenCalledTimes(1)
    expect(calls.stripeEventsUpdateEq).toHaveBeenCalled()
  })

  it("does not fail delivery when Stripe references a missing local profile", async () => {
    const { admin, calls } = createAdminSupabaseStub({
      subscriptionsUpsertError: {
        code: "23503",
        message:
          'insert or update on table "subscriptions" violates foreign key constraint "subscriptions_user_id_fkey"',
      },
    })
    createSupabaseAdminClientMock.mockReturnValue(admin)

    constructEventMock.mockReturnValue({
      id: "evt_orphan_subscription",
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_orphan",
          status: "active",
          customer: "cus_orphan",
          current_period_end: 1_900_000_000,
          cancel_at: null,
          canceled_at: null,
          metadata: {
            user_id: "missing-profile",
            planName: "Organization",
            plan_tier: "organization",
          },
        },
      },
    })

    const response = await runWebhook()
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toMatchObject({ received: true })
    expect(calls.subscriptionsUpsert).toHaveBeenCalledTimes(1)
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "Skipping Stripe webhook record for missing profile",
      expect.objectContaining({
        table: "subscriptions",
        userId: "missing-profile",
        stripeId: "sub_orphan",
      }),
    )
  })

  it("increments monthly installment metadata and enables cancel-at-period-end on limit", async () => {
    const { admin, calls } = createAdminSupabaseStub({ existingActiveSubscription: false })
    createSupabaseAdminClientMock.mockReturnValue(admin)

    calls.subscriptionsRetrieve.mockResolvedValue({
      id: "sub_accel_invoice",
      customer: "cus_invoice",
      status: "active",
      cancel_at_period_end: false,
      current_period_end: 1_900_000_000,
      metadata: {
        kind: "accelerator",
        user_id: "user_invoice",
        accelerator_billing: "monthly",
        accelerator_installment_limit: "10",
        accelerator_installments_paid: "9",
      },
    })

    calls.subscriptionsUpdate.mockResolvedValue({
      id: "sub_accel_invoice",
      customer: "cus_invoice",
      status: "active",
      cancel_at_period_end: true,
      current_period_end: 1_900_000_000,
      metadata: {
        kind: "accelerator",
        user_id: "user_invoice",
        accelerator_billing: "monthly",
        accelerator_installment_limit: "10",
        accelerator_installments_paid: "10",
      },
    })

    constructEventMock.mockReturnValue({
      id: "evt_invoice_cycle",
      type: "invoice.paid",
      data: {
        object: {
          id: "in_cycle",
          billing_reason: "subscription_cycle",
          subscription: "sub_accel_invoice",
        },
      },
    })

    const response = await runWebhook()

    expect(response.status).toBe(200)
    expect(calls.subscriptionsRetrieve).toHaveBeenCalledWith("sub_accel_invoice")
    expect(calls.subscriptionsUpdate).toHaveBeenCalledWith(
      "sub_accel_invoice",
      expect.objectContaining({
        cancel_at_period_end: true,
        metadata: expect.objectContaining({
          accelerator_installment_limit: "10",
          accelerator_installments_paid: "10",
        }),
      }),
    )
    expect(calls.subscriptionsUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user_invoice",
        stripe_subscription_id: "sub_accel_invoice",
        metadata: expect.objectContaining({
          accelerator_installments_paid: "10",
        }),
      }),
      expect.objectContaining({ onConflict: "user_id,stripe_subscription_id" }),
    )
  })

  it("does not progress installments for non-cycle invoices", async () => {
    const { admin, calls } = createAdminSupabaseStub({ existingActiveSubscription: false })
    createSupabaseAdminClientMock.mockReturnValue(admin)

    calls.subscriptionsRetrieve.mockResolvedValue({
      id: "sub_accel_manual",
      customer: "cus_manual",
      status: "active",
      cancel_at_period_end: false,
      current_period_end: 1_900_000_000,
      metadata: {
        kind: "accelerator",
        user_id: "user_manual",
        accelerator_billing: "monthly",
        accelerator_installment_limit: "10",
        accelerator_installments_paid: "2",
      },
    })

    constructEventMock.mockReturnValue({
      id: "evt_invoice_manual",
      type: "invoice.paid",
      data: {
        object: {
          id: "in_manual",
          billing_reason: "manual",
          subscription: "sub_accel_manual",
        },
      },
    })

    const response = await runWebhook()

    expect(response.status).toBe(200)
    expect(calls.subscriptionsRetrieve).toHaveBeenCalledWith("sub_accel_manual")
    expect(calls.subscriptionsUpdate).not.toHaveBeenCalled()
    expect(calls.subscriptionsUpsert).not.toHaveBeenCalled()
  })
})


describe("Stripe subscription status normalization", () => {
  it.each(["unpaid", "paused", "unknown"])("does not grant trial access for %s", (status) => {
    expect(toStatus(status)).toBe("incomplete")
  })
  it.each(["active", "trialing", "past_due", "canceled", "incomplete", "incomplete_expired"])("preserves %s", (status) => {
    expect(toStatus(status)).toBe(status)
  })
})
