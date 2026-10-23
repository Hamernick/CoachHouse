import { buildFiscalSponsorshipApplicationDraft, type FiscalSponsorshipApplicationDraft } from "./application-draft"
import { guestDraftResponseSchema, guestDraftSchema, pickGuestFiscalDraft, type GuestFiscalDraft } from "./guest-draft"

import { GuestDraftRecovery, pickGuestRecoveryDraft } from "./guest-draft-recovery"

type Phase = "preview" | "loading" | "ready" | "saving" | "error" | "conflict" | "expired" | "invalid" | "submitted"
type SaveRequest = { operation: "save"; version: number; requestId: string; draft: GuestFiscalDraft }
export type GuestDraftState = {
  phase: Phase; draft: FiscalSponsorshipApplicationDraft; dirty: boolean;
  saved: boolean; localBackup: boolean; expiresAt: string | null; reference: string | null; error: string | null;
}
const emptyDraft = () => buildFiscalSponsorshipApplicationDraft({ data: { projectId: "", projectName: "", applicantName: "" } })
const fingerprint = (draft: FiscalSponsorshipApplicationDraft) => JSON.stringify(pickGuestFiscalDraft(draft))

class DraftRequestError extends Error {
  constructor(readonly status: number) { super("draft_request_failed") }
}

// One serialized writer per mounted form; optional recovery stays in this tab.
export class GuestDraftController {
  private state: GuestDraftState
  private listeners = new Set<() => void>()
  private version: number | null = null
  private baseline = ""
  private pending: SaveRequest | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private request: AbortController | null = null
  private epoch = 0
  private active = false
  private recoveryLoaded = false
  private recovering = false

  constructor(private enabled: boolean, private transport: typeof fetch = fetch, private recovery?: GuestDraftRecovery) {
    this.state = { phase: enabled ? "loading" : "preview", draft: emptyDraft(), dirty: false,
      saved: false, localBackup: false, expiresAt: null, reference: null, error: null }
  }
  getSnapshot = () => this.state
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  private set(patch: Partial<GuestDraftState>) {
    this.state = { ...this.state, ...patch }
    if (this.enabled && this.recovery) {
      if (this.state.phase === "submitted") {
        this.recovery.clear()
        this.state.localBackup = false
      } else if (this.state.dirty || this.state.saved || this.recovering) {
        try {
          this.state.localBackup = this.recovery.write({
            draft: pickGuestRecoveryDraft(this.state.draft), version: this.version,
            baseline: this.baseline, pending: this.pending, expiresAt: this.state.expiresAt,
          })
        } catch { this.recovery.clear(); this.state.localBackup = false }
      } else {
        this.recovery.clear()
        this.state.localBackup = false
      }
    }
    this.listeners.forEach((listener) => listener())
  }
  private clearTimer() { if (this.timer) clearTimeout(this.timer); this.timer = null }
  stop() { this.active = false; this.epoch++; this.clearTimer(); this.request?.abort(); this.request = null }
  async start() {
    if (this.active) return
    this.active = true
    if (!this.enabled) return
    if (!this.recoveryLoaded) {
      this.recoveryLoaded = true
      const recovered = this.recovery?.read()
      if (recovered) {
        this.version = recovered.version
        this.baseline = recovered.baseline
        this.pending = recovered.pending
        this.recovering = true
        this.set({ draft: { ...emptyDraft(), ...recovered.draft }, dirty: true, saved: false,
          expiresAt: recovered.expiresAt, localBackup: true })
      }
    }
    if (this.pending && !this.recovering) { this.set({ phase: "error" }); await this.save(); return }
    await this.load(false)
  }
  private async post(path: string, body: object, signal: AbortSignal) {
    // Native browser fetch rejects a controller instance as its receiver.
    const transport = this.transport
    const response = await transport(`/api/public/fiscal-sponsorship/${path}`, {
      method: "POST", credentials: "same-origin", cache: "no-store", signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]),
      headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    })
    if (!response.ok && response.status !== 409) throw new DraftRequestError(response.status)
    return response.json() as Promise<unknown>
  }
  private fail(error: unknown) {
    const status = error instanceof DraftRequestError ? error.status : 0
    this.set({ phase: status === 401 ? "expired" : "error", error: status === 429
      ? "Saving is paused. Wait a minute, then retry. Your answers are still here."
      : status === 401 ? "Your draft session expired. Your answers are still here."
        : this.state.localBackup ? "Your answers are backed up in this tab. Retry to save online."
          : "We couldn’t confirm your draft was saved. Keep this page open and retry." })
  }
  private submitted(reference: string) {
    this.pending = null
    this.set({ phase: "submitted", dirty: false, saved: false, reference, error: null })
  }
  private async load(discard: boolean) {
    if (!this.active || !this.enabled || this.request) return
    const epoch = this.epoch
    const request = this.request = new AbortController()
    this.set({ phase: "loading", error: null })
    try {
      await this.post("session", {}, request.signal)
      const result = guestDraftResponseSchema.parse(await this.post("draft", { operation: "read" }, request.signal))
      if (!this.active || epoch !== this.epoch) return
      if (result.state === "submitted") { this.submitted(result.reference); return }
      if (result.state === "expired") throw new DraftRequestError(401)
      if (result.state !== "draft") throw new DraftRequestError(409)
      const restored = { ...emptyDraft(), ...result.draft }
      // A failed initial read or expired session can leave unsaved local edits.
      // Never replace those with a different server draft without confirmation.
      const remoteFingerprint = fingerprint(restored)
      const sameBaseline = this.version === result.version && this.baseline === remoteFingerprint
      const pendingCommitted = this.pending !== null && result.version === this.pending.version + 1
        && remoteFingerprint === fingerprint({ ...emptyDraft(), ...this.pending.draft })
      if (this.state.dirty && !discard && result.version > 0
        && remoteFingerprint !== JSON.stringify(pickGuestRecoveryDraft(this.state.draft))
        && !sameBaseline && !pendingCommitted) {
        this.set({ phase: "conflict", error: null }); return
      }
      this.version = result.version
      this.baseline = remoteFingerprint
      if (discard || !sameBaseline || pendingCommitted) this.pending = null
      this.recovering = false
      const draft = discard || !this.state.dirty ? restored : this.state.draft
      const valid = guestDraftSchema.safeParse(pickGuestRecoveryDraft(draft)).success
      this.set({ phase: valid ? "ready" : "invalid", draft,
        dirty: this.pending !== null || JSON.stringify(pickGuestRecoveryDraft(draft)) !== this.baseline,
        saved: result.version > 0, expiresAt: result.expiresAt,
        error: valid ? null : "An answer is too long to save. Shorten it before leaving this page." })
    } catch (error) { if (this.active && epoch === this.epoch) this.fail(error) }
    finally {
      if (epoch === this.epoch) { this.request = null; this.schedule() }
    }
  }
  edit<K extends keyof FiscalSponsorshipApplicationDraft>(field: K, value: FiscalSponsorshipApplicationDraft[K]) {
    if (["loading", "submitted"].includes(this.state.phase)) return
    const draft = { ...this.state.draft, [field]: value }
    let dirty = true
    try { dirty = this.pending !== null || fingerprint(draft) !== this.baseline }
    catch { this.set({ draft, dirty: true, phase: this.enabled ? "invalid" : "preview", error: "An answer is too long to save. Shorten it before leaving this page." }); this.clearTimer(); return }
    const phase = this.state.phase === "invalid" ? this.version === null ? "error" : "ready" : this.state.phase
    this.set({ draft, dirty, phase, error: phase === "ready" ? null : this.state.error })
    this.schedule()
  }
  private schedule() {
    this.clearTimer()
    if (this.active && this.enabled && this.state.phase === "ready" && this.state.dirty && !this.request) {
      this.timer = setTimeout(() => { void this.save() }, 1000)
    }
  }
  async save() {
    if (!this.active || !this.enabled || this.request || this.version === null
      || ["conflict", "expired", "invalid", "submitted", "loading"].includes(this.state.phase)) return
    this.clearTimer()
    if (!this.pending && !this.state.dirty) return
    this.pending ??= { operation: "save", version: this.version, requestId: crypto.randomUUID(), draft: pickGuestFiscalDraft(this.state.draft) }
    const pending = this.pending
    const epoch = this.epoch
    const request = this.request = new AbortController()
    this.set({ phase: "saving", error: null })
    try {
      const result = guestDraftResponseSchema.parse(await this.post("draft", pending, request.signal))
      if (!this.active || epoch !== this.epoch) return
      if (result.state === "submitted") { this.submitted(result.reference); return }
      if (result.state === "conflict") { this.set({ phase: "conflict" }); return }
      if (result.state === "expired") throw new DraftRequestError(401)
      this.version = result.version
      this.baseline = fingerprint({ ...emptyDraft(), ...result.draft })
      this.pending = null
      let dirty = true
      try { dirty = fingerprint(this.state.draft) !== this.baseline }
      catch { this.set({ phase: "invalid", dirty: true, error: "An answer is too long to save. Shorten it before leaving this page." }); return }
      this.set({ phase: "ready", dirty, saved: true, expiresAt: result.expiresAt })
    } catch (error) { if (this.active && epoch === this.epoch) this.fail(error) }
    finally { if (epoch === this.epoch) { this.request = null; this.schedule() } }
  }
  async retry() {
    if (this.recovering || this.state.phase === "expired" || this.version === null) await this.load(false)
    else await this.save()
  }
  async flush() {
    if (this.state.phase === "saving") {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => { unsubscribe(); resolve() }, 12000)
        const unsubscribe = this.subscribe(() => {
          if (this.state.phase !== "saving") { clearTimeout(timer); unsubscribe(); resolve() }
        })
      })
    }
    if (this.state.phase === "ready" && this.state.dirty) await this.save()
    return this.state.phase === "ready" && !this.state.dirty
  }
  acceptSubmission(reference: string) { this.clearTimer(); this.submitted(reference) }
  expireSession() { this.clearTimer(); this.set({ phase: "expired", dirty: true, error: "Your draft session expired. Your answers are still here." }) }
  // Caller must ask before discarding local answers (including ambiguous writes).
  async reloadSaved() { await this.load(true) }
}
