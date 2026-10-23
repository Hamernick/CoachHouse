import { z } from "zod"
import type { FiscalSponsorshipApplicationDraft } from "./application-draft"
import { guestDraftRequestSchema, guestDraftSchema, type GuestFiscalDraft } from "./guest-draft"

export const GUEST_DRAFT_RECOVERY_KEY = "coachhouse:fiscal-guest-draft:tab:v1"
const RECOVERY_LIFETIME_MS = 7 * 86400 * 1000
const MAX_RECOVERY_LENGTH = 256 * 1024
const saveRequestSchema = guestDraftRequestSchema.options[1]
const envelope = z.object({
  format: z.literal(1), recoveryExpiresAt: z.number().int().positive(),
  draft: z.unknown(), version: z.number().int().min(0).max(2147483646).nullable(),
  baseline: z.string().max(65536), pending: saveRequestSchema.nullable(),
  expiresAt: z.string().datetime({ offset: true }).nullable(),
}).strict()

export type GuestDraftRecoverySnapshot = {
  draft: GuestFiscalDraft
  version: number | null
  baseline: string
  pending: z.infer<typeof saveRequestSchema> | null
  expiresAt: string | null
}
type RecoveryStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">

function parseRecoveryDraft(value: unknown): GuestFiscalDraft {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid_recovery")
  for (const [key, answer] of Object.entries(value)) {
    if (!Object.hasOwn(guestDraftSchema.shape, key) || typeof answer !== "string" || answer.length > 65536) {
      throw new Error("invalid_recovery")
    }
    const result = guestDraftSchema.shape[key as keyof GuestFiscalDraft].safeParse(answer)
    // Keep an overlong text answer so shortening it never requires retyping it.
    // Invalid enum values and unknown/internal fields are never restored.
    if (!result.success && result.error.issues.some((issue) => issue.code !== "too_big")) {
      throw new Error("invalid_recovery")
    }
  }
  return value as GuestFiscalDraft
}

export function pickGuestRecoveryDraft(draft: FiscalSponsorshipApplicationDraft): GuestFiscalDraft {
  return parseRecoveryDraft(Object.fromEntries(Object.keys(guestDraftSchema.shape)
    .map((key) => [key, draft[key as keyof FiscalSponsorshipApplicationDraft]])))
}

// Same-tab recovery only: no localStorage, tokens, account IDs or internal data.
// Storage is resolved lazily so server rendering and blocked storage remain safe.
export class GuestDraftRecovery {
  private deadline: number | null = null
  constructor(private storage: () => RecoveryStorage = () => window.sessionStorage) {}

  read(): GuestDraftRecoverySnapshot | null {
    try {
      const raw = this.storage().getItem(GUEST_DRAFT_RECOVERY_KEY)
      if (!raw) return null
      if (raw.length > MAX_RECOVERY_LENGTH) throw new Error("invalid_recovery")
      const value = envelope.parse(JSON.parse(raw))
      if (value.recoveryExpiresAt <= Date.now() || value.recoveryExpiresAt > Date.now() + RECOVERY_LIFETIME_MS) {
        throw new Error("expired_recovery")
      }
      const draft = parseRecoveryDraft(value.draft)
      if (value.baseline) parseRecoveryDraft(JSON.parse(value.baseline))
      this.deadline = value.recoveryExpiresAt
      return { draft, version: value.version, baseline: value.baseline, pending: value.pending, expiresAt: value.expiresAt }
    } catch { this.clear(); return null }
  }

  write(snapshot: GuestDraftRecoverySnapshot): boolean {
    try {
      this.deadline ??= Date.now() + RECOVERY_LIFETIME_MS
      if (this.deadline <= Date.now()) { this.clear(); return false }
      const draft = parseRecoveryDraft(snapshot.draft)
      const raw = JSON.stringify({ ...snapshot, draft, format: 1, recoveryExpiresAt: this.deadline })
      if (raw.length > MAX_RECOVERY_LENGTH) { this.clear(); return false }
      this.storage().setItem(GUEST_DRAFT_RECOVERY_KEY, raw)
      return true
    } catch { this.clear(); return false }
  }

  clear() {
    this.deadline = null
    try { this.storage().removeItem(GUEST_DRAFT_RECOVERY_KEY) } catch { /* Storage may be blocked. */ }
  }
}
