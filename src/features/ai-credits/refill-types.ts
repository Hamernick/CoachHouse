import { z } from "zod"
export const REFILL_CONSENT_VERSION = "refill-v1"
export const refillInputSchema = z.strictObject({ organizationId: z.uuid(), id: z.uuid(), pack: z.string().min(1).max(100),
  threshold: z.number().int().min(1).max(1000000), monthlyPacks: z.number().int().min(1).max(10), consent: z.literal(true), consentVersion: z.literal(REFILL_CONSENT_VERSION) })
export type RefillInput = z.infer<typeof refillInputSchema>
export const refillViewSchema = z.object({
  setup: z.object({ id: z.uuid(), status: z.enum(["setup","enabled","paused","disabled"]), credits: z.number(), amount: z.number(), currency: z.string(), threshold: z.number(), monthlyCap: z.number(), paymentLabel: z.string().nullable(), expiresAt: z.string() }).nullable(),
  used: z.number(), resetAt: z.string(),
  pending: z.object({ id: z.uuid(), state: z.string(), amount: z.number(), currency: z.string(), canRetry: z.boolean(), canCancel: z.boolean() }).nullable(),
})
export type AiCreditRefill = z.infer<typeof refillViewSchema> & { canConfigure: boolean }
export function creditMoney(amount: number, currency: string) {
  const format = new Intl.NumberFormat(undefined, { style: "currency", currency })
  return format.format(amount / 10 ** (format.resolvedOptions().maximumFractionDigits ?? 2))
}
export function refillConsent(terms: { credits: number; amount: number; currency: string; threshold: number; monthlyCap: number }) {
  return `I authorize charging my saved card ${creditMoney(terms.amount, terms.currency)} for ${terms.credits.toLocaleString()} credits when available credits fall below ${terms.threshold.toLocaleString()}, up to ${creditMoney(terms.monthlyCap, terms.currency)} per calendar month (UTC), including pending refills. I can disable future refills at any time. A refill already processing may finish.`
}
