import { execFileSync } from "node:child_process"
import { randomUUID } from "node:crypto"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), send: vi.fn(), user: vi.fn() }))
vi.mock("server-only", () => ({}))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ rpc: mocks.rpc }) }))
vi.mock("@/lib/email/resend", () => ({ canSendResendEmail: () => true, sendResendEmail: mocks.send }))
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({ auth: { getUser: mocks.user } }) }))
vi.mock("@/lib/organization/active-org-cookie", () => ({ writeActiveOrganizationCookie: vi.fn() }))
import { handleGuestFiscalProfile } from "@/features/fiscal-sponsorship/server/guest-profile"
import { handleGuestFiscalRecovery } from "@/features/fiscal-sponsorship/server/guest-recovery"
import { handleGuestFiscalSession, handleGuestFiscalSubmission } from "@/features/fiscal-sponsorship/server/guest-submission"
import { handleGuestFiscalDraft } from "@/features/fiscal-sponsorship/server/guest-draft"
import { dispatchFiscalGuestEmails } from "@/features/fiscal-sponsorship/server/guest-email-dispatch"
import { handleGuestFiscalEmailVerification } from "@/features/fiscal-sponsorship/server/guest-email-proof"
import { handleGuestFiscalFollowup } from "@/features/fiscal-sponsorship/server/guest-followup"
import { guestSubmissionInput } from "@/features/fiscal-sponsorship/lib/guest-submission-input"
import { buildFiscalSponsorshipApplicationDraft } from "@/features/fiscal-sponsorship/lib/application-draft"
import { pickGuestFiscalDraft } from "@/features/fiscal-sponsorship/lib/guest-draft"

// Run only inside the existing disposable PostgreSQL RLS harness. Never read
// .env/database URLs; no network Supabase/Auth/email service is used by this test.
const enabled = process.env.FISCAL_STORAGE_TEST === "ephemeral"
function sql(source: string) {
  if (!enabled || !/^5[6-9]\d{3}$|^60\d{3}$/.test(process.env.FISCAL_STORAGE_TEST_PORT ?? "")) throw new Error("Ephemeral harness required")
  return execFileSync(process.env.FISCAL_STORAGE_TEST_PSQL!, ["-X", "-h", "/tmp", "-p", process.env.FISCAL_STORAGE_TEST_PORT!, "-U", "postgres", "-d", "postgres", "-qAt", "-v", "ON_ERROR_STOP=1"], { input: source, encoding: "utf8" }).trim()
}
function quote(value: unknown) {
  if (value === null) return "NULL"
  const raw = typeof value === "object" ? JSON.stringify(value) : String(value)
  return "'" + raw.replaceAll("'", "''") + "'"
}
let cookie = ""
function request(body: unknown) {
  return new Request("https://coach.test/api/public/fiscal-sponsorship/applications", { method: "POST", headers: {
    "content-type": "application/json", origin: "https://coach.test", cookie,
  }, body: JSON.stringify(body) })
}

// Provider boundaries are captured. Application handlers, validation, proof
// signing, SQL functions, RLS and the actual migrated storage run together.
describe.skipIf(!enabled)("connected fiscal application storage", () => {
 beforeAll(() => {
  vi.stubEnv("FISCAL_GUEST_INTAKE_ENABLED", "true")
  vi.stubEnv("FISCAL_GUEST_EMAILS_ENABLED", "true")
  vi.stubEnv("FISCAL_GUEST_RISK_SECRET", "test-risk-".repeat(4))
  vi.stubEnv("FISCAL_GUEST_LINK_SECRET", "ephemeral-link-secret-at-least-32-characters")
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://coach.test")
  vi.stubEnv("HCAPTCHA_SECRET_KEY", "fixture-secret")
  vi.stubEnv("NEXT_PUBLIC_HCAPTCHA_SITE_KEY", "fixture-key")
  vi.stubEnv("VERCEL", "")
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url !== "https://api.hcaptcha.com/siteverify") throw new Error("Unexpected network attempt")
    return Response.json({ success: true })
  }))
  mocks.rpc.mockImplementation(async (name: string, args: Record<string, unknown> = {}) => {
    if (!/^[a-z_]+$/.test(name) || Object.keys(args).some((key) => !/^p_[a-z_]+$/.test(key))) throw new Error("Invalid fixture RPC")
    try {
      const result = sql(`set role service_role; select to_jsonb(public.${name}(${Object.entries(args).map(([key, value]) => `${key} => ${quote(value)}`).join(",")}));`)
      return { data: result ? JSON.parse(result) : null, error: null }
    } catch { return { data: null, error: { message: "fixture_rpc_failed" } } }
  })
  mocks.send.mockImplementation(async () => ({ ok: true, id: randomUUID() }))
  mocks.user.mockResolvedValue({ data: { user: null }, error: null })
  sql(`insert into public.platform_staff_members(user_id,access_level) values('10000000-0000-0000-0000-000000000002','coach') on conflict do nothing;
    update public.fiscal_guest_email_outbox set status='failed'; update public.fiscal_staff_email_outbox set status='failed';`)
 })
 afterAll(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })
 it("saves, resumes, submits once, verifies and resubmits corrections on the same project", async () => {
  const session = await handleGuestFiscalSession(request({}))
  expect(session.status).toBe(200)
  cookie = session.headers.get("set-cookie")!.split(";")[0]
  const draft = buildFiscalSponsorshipApplicationDraft({ data: { projectId: "", projectName: "Garden", applicantName: "" } })
  Object.assign(draft, {
    applicantFirstName: "Test", applicantLastName: "Applicant", primaryEmail: "connected@example.test",
    mailingStreetAddress: "1 Test Street", mailingCity: "Chicago", mailingState: "IL", mailingPostalCode: "60601",
    legalEntityType: "individual", projectName: "Connected garden", projectDescription: "Grow food",
    projectDurationType: "ongoing_multi_year", publicBenefit: "Food for neighbors", prospectiveFundingSources: "Donations",
    fundraisingGoalDollars: "1000", fundraisingGoalPeriod: "monthly", operatesOutsideUnitedStates: "no",
    engagesInLobbying: "no", hasLegalComplianceFinancialConcerns: "no",
  })
  const initial = await handleGuestFiscalDraft(request({ operation: "read" }))
  expect(initial.status).toBe(200)
  const initialState = await initial.json()
  const saved = await handleGuestFiscalDraft(request({ operation: "save", version: initialState.version, requestId: randomUUID(), draft: pickGuestFiscalDraft(draft) }))
  expect(saved.status).toBe(200)
  expect(await (await handleGuestFiscalDraft(request({ operation: "read" }))).json()).toMatchObject({ state: "draft", draft: { projectName: "Connected garden" } })
  const payload = guestSubmissionInput(draft,"captured-captcha")
  expect(payload.success).toBe(true)
  if (!payload.success) return
  const sent = await handleGuestFiscalSubmission(request(payload.data))
  expect(sent.status).toBe(201)
  const { reference } = await sent.json()
  const repeated = await handleGuestFiscalSubmission(request(payload.data))
  expect(await repeated.json()).toEqual({ ok: true, reference })
  const projectId = sql(`select project_id from public.fiscal_guest_submissions where id=${quote(reference)};`)
  expect(sql(`select count(*) from public.notifications where metadata->>'projectId'=${quote(projectId)};`)).toBe("2")
  const counts = () => sql(`select json_build_array((select count(*) from public.organization_projects),(select count(*) from public.fiscal_guest_email_outbox),(select count(*) from public.fiscal_staff_email_outbox));`)
  expect(await (await handleGuestFiscalDraft(request({ operation: "read" }))).json()).toEqual({ state: "submitted", reference })
  expect((await handleGuestFiscalFollowup(request({ operation: "read", reference }))).status).toBe(403)
  await dispatchFiscalGuestEmails()
  const receipt = mocks.send.mock.calls.map(([mail]) => mail).find((mail) => mail.to === "connected@example.test")
  expect(receipt).toBeDefined()
  const token = receipt.text.match(/#verify=([^\s]+)/)[1]
  expect((await handleGuestFiscalEmailVerification(request({ token }))).status).toBe(200)
  expect(await (await handleGuestFiscalFollowup(request({ operation: "read", reference }))).json()).toMatchObject({ status: "submitted", application: null })
  // Reviewer transition fixtures are exercised separately by the workflow suite.
  sql(`update public.fiscal_sponsorship_applications set status='needs_info',review_notes='Describe the donors.' where project_id=${quote(projectId)};
    insert into public.fiscal_sponsorship_events(org_id,project_id,application_id,event_type,summary)
    select org_id,project_id,id,'application_needs_info','Updates requested' from public.fiscal_sponsorship_applications where project_id=${quote(projectId)};`)
  const corrections = await handleGuestFiscalFollowup(request({ operation: "read", reference }))
  expect(corrections.status).toBe(200)
  const current = await corrections.json()
  expect(current).toMatchObject({ status: "needs_info", reviewNote: "Describe the donors." })
  const update = { operation: "resubmit", reference, requestId: randomUUID(), version: current.version, application: { ...current.application, prospectiveFundingSources: "Local individual donors" } }
  expect((await handleGuestFiscalFollowup(request(update))).status).toBe(200)
  const after = counts()
  expect((await handleGuestFiscalFollowup(request(update))).status).toBe(200)
  expect(counts()).toBe(after)
  expect(sql(`select project_id from public.fiscal_guest_submissions where id=${quote(reference)};`)).toBe(projectId)
  expect(sql(`select count(*) from public.fiscal_guest_submissions where contact_email='connected@example.test';`)).toBe("1")
  // Account-free submission remains valid before optional profile saving.
  expect((await handleGuestFiscalProfile(request({ operation: "preview", reference }))).status).toBe(401)
  const userId = randomUUID()
  sql(`insert into auth.users values(${quote(userId)},'connected@example.test',now()); insert into public.profiles(id,email) values(${quote(userId)},'connected@example.test');`)
  mocks.user.mockResolvedValue({ data: { user: { id: userId, email_confirmed_at: new Date().toISOString() } }, error: null })
  const preview = await handleGuestFiscalProfile(request({ operation: "preview", reference }))
  expect(preview.status).toBe(200)
  const profile = await preview.json()
  const selection = { operation: "save", reference, requestId: randomUUID(), version: profile.version, fields: { name: "My garden" } }
  expect(await (await handleGuestFiscalProfile(request(selection))).json()).toEqual({ state: "linked" })
  expect(await (await handleGuestFiscalProfile(request(selection))).json()).toEqual({ state: "linked" })
  expect(JSON.parse(sql(`select profile from public.organizations where user_id=${quote(userId)};`))).toEqual({ name: "My garden" })
  expect(sql(`select is_public from public.organizations where user_id=${quote(userId)};`)).toBe("f")
  expect(sql(`select org_id from public.organization_projects where id=${quote(projectId)};`)).toBe("10000000-0000-0000-0000-000000000001")
  // A new browser recovers through a fresh email, without changing its account claim.
  cookie = ""
  expect((await handleGuestFiscalFollowup(request({ operation: "read", reference }))).status).toBe(403)
  const recoveredSession = await handleGuestFiscalSession(request({}))
  cookie = recoveredSession.headers.get("set-cookie")!.split(";")[0]
  expect((await handleGuestFiscalRecovery(request({ reference, email: "connected@example.test", requestId: randomUUID(), captchaToken: "captured-captcha" }))).status).toBe(202)
  await dispatchFiscalGuestEmails(); await dispatchFiscalGuestEmails()
  const recovery = mocks.send.mock.calls.map(([mail]) => mail).find((mail) => mail.subject === "Your application access link")
  expect(recovery).toBeDefined()
  expect((await handleGuestFiscalEmailVerification(request({ token: recovery.text.match(/#verify=([^\s]+)/)[1] }))).status).toBe(200)
  expect(await (await handleGuestFiscalFollowup(request({ operation: "read", reference }))).json()).toMatchObject({ status: "submitted", application: null })
 })
})
