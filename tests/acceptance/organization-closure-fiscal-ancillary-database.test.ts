import { spawn } from "node:child_process"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { createClosureDatabaseHarness, databaseUrl } from "./organization-closure-database-helpers"

const { clients, query, hold, queued } = createClosureDatabaseHarness(spawn)
const writes = [
  ["intake settings", "insert into public.fiscal_guest_intake_settings(org_id,system_actor_id) values(public.fixture_form_id(1),public.fixture_form_id(1)) on conflict(singleton) do update set org_id=excluded.org_id"],
  ["submission", "update public.fiscal_guest_submissions set email_verified_at=now() where id=public.fixture_form_id(1801)"],
  ["reviewer", "update public.fiscal_project_reviewers set assigned_at=clock_timestamp() where project_id=public.fixture_form_id(1401) and user_id=public.fixture_form_id(1)"],
  ["proof", "update public.fiscal_guest_email_proofs set expires_at=now()+interval '2 days' where job_id=public.fixture_form_id(1811)"],
  ["session", "insert into public.fiscal_guest_verified_sessions values(repeat('5',64),public.fixture_form_id(1801),now()+interval '2 days') on conflict(key_hash,submission_id) do update set expires_at=excluded.expires_at"],
  ["profile import", "insert into public.fiscal_guest_profile_imports(submission_id,user_id,request_id,request_hash) values(public.fixture_form_id(1801),public.fixture_form_id(14),public.fixture_form_id(1841),'synthetic')"],
  ["revision", "insert into public.fiscal_guest_application_revisions(submission_id,request_id,request_hash,previous_application) values(public.fixture_form_id(1801),public.fixture_form_id(1841),'synthetic','{}')"],
  ["organization link", "insert into public.fiscal_application_organization_links(submission_id,org_id,applicant_user_id,actor_id,basis,request_id,request_hash) values(public.fixture_form_id(1801),public.fixture_form_id(14),public.fixture_form_id(14),public.fixture_form_id(1),'staff_confirmed_owner',public.fixture_form_id(1841),'synthetic')"],
  ["guest delivery", "update public.fiscal_guest_email_outbox set attempts=attempts+1 where id=public.fixture_form_id(1811)"],
  ["staff delivery", "update public.fiscal_staff_email_outbox set attempts=attempts+1 where event_id=public.fixture_form_id(1821)"],
  ["guest intake transaction", "select public.fixture_fiscal_guest_submit()"],
] as const
const service = (sql: string) => `set local role service_role; set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001'; ${sql}`
const effect = (sql: string) => query(`begin; ${service(sql)}; commit`)
const request = "select public.fixture_closure('request',600,0)"
const guestClaim = "select public.claim_fiscal_guest_emails_v4()"
const staffClaim = "select public.claim_fiscal_staff_emails_v2()"
const sendAllowed = "select public.fiscal_guest_email_send_allowed(id,lease_token) from public.fiscal_guest_email_outbox where id=public.fixture_form_id(1811)"
const guestFinish = (success: boolean) => `select public.finish_fiscal_guest_email(id,lease_token,'synthetic-provider',${success}) from public.fiscal_guest_email_outbox where id=public.fixture_form_id(1811)`

describe.skipIf(!databaseUrl)("closure fiscal guest and delivery serialization", () => {
  beforeEach(async () => {
    const reset = await query("begin; set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001'; select public.fixture_closure_fiscal_ancillary(); commit")
    expect(reset.code, reset.stderr).toBe(0)
  })
  afterEach(() => { for (const child of clients) child.kill("SIGTERM") })
  it.each(writes)("finishes admitted %s before closure", async (_name, sql) => {
    const release = await hold(service(sql))
    const closing = await queued(request)
    await release()
    const result = await closing.result
    expect(result.code, result.stderr).toBe(0)
  })
  it.each(writes)("rejects %s during and after closure", async (name, sql) => {
    const release = await hold(request)
    if (name.includes("delivery") || name === "guest intake transaction") {
      const writing = await queued(`begin; ${service(sql)}; commit`)
      await release()
      expect((await writing.result).code).not.toBe(0)
    } else {
      const busy = await effect(sql)
      expect(busy.code).not.toBe(0)
      expect(busy.stderr).toContain("Organization is changing; retry document edit")
      await release()
    }
    const closed = await effect(sql)
    expect(closed.code).not.toBe(0)
    expect(closed.stderr).toContain(name.includes("delivery") ? "Fiscal delivery permanently suppressed" : "Organization unavailable")
  })
  it("rechecks proof exchange after its tuple wait", async () => {
    const release = await hold("select 1 from public.fiscal_guest_email_proofs where job_id=public.fixture_form_id(1811) for update")
    const exchanging = await queued(`begin; ${service("select public.verify_fiscal_guest_email(repeat('7',64),repeat('c',64),now()+interval '1 day')")}; commit`)
    expect((await query(request)).code).toBe(0)
    await release()
    const result = await exchanging.result
    expect(result.code).not.toBe(0)
    expect(result.stderr).toContain("Organization unavailable")
    expect((await query("select consumed_at is null from public.fiscal_guest_email_proofs where job_id=public.fixture_form_id(1811); select count(*) from public.fiscal_guest_verified_sessions where key_hash=repeat('c',64)")).stdout.trim()).toBe("t\n0")
  })
  it("preserves recovery's uniform response without queuing closed-host mail", async () => {
    const release = await hold(request)
    const response = await effect("select public.fixture_fiscal_recovery()")
    expect(response.code, response.stderr).toBe(0)
    await release()
    expect((await effect("select public.fixture_fiscal_recovery()")).code).toBe(0)
    expect((await query("select count(*) from public.fiscal_guest_email_outbox where kind='applicant_recovery'")).stdout.trim()).toBe("0")
  })
  it.each([["guest", guestClaim], ["staff", staffClaim]])("serializes %s claims with shutdown", async (name, claim) => {
    const release = await hold(service(claim))
    const closing = await queued(request)
    await release()
    expect((await closing.result).code).toBe(0)
    const allowed = await effect(name === "guest" ? sendAllowed : "select public.fiscal_staff_email_send_allowed(event_id,lease_token) from public.fiscal_staff_email_outbox where event_id=public.fixture_form_id(1821)")
    expect(allowed.code, allowed.stderr).toBe(0)
    expect(allowed.stdout.trim()).toBe("f")
  })
  it.each([true, false])("records a late leased completion (%s) without reviving retry", async success => {
    expect((await effect(guestClaim)).code).toBe(0)
    const release = await hold(request)
    const finishing = await queued(`begin; ${service(guestFinish(success))}; commit`)
    await release()
    const result = await finishing.result
    expect(result.code, result.stderr).toBe(0)
    expect(result.stdout.trim()).toBe("t")
    expect((await query("select status,closure_suppressed_at is not null,lease_token is null from public.fiscal_guest_email_outbox where id=public.fixture_form_id(1811)")).stdout.trim()).toBe(`${success ? "sent" : "failed"}|t|t`)
    expect((await query("select public.fixture_closure('cancel',601,1)")).code).toBe(0)
    expect((await effect(sendAllowed)).stdout.trim()).toBe("f")
    expect((await effect(guestClaim)).stdout).not.toContain("000000001811")
  })
  it("keeps a late failed staff send terminal after cancellation", async () => {
    expect((await effect(staffClaim)).code).toBe(0)
    expect((await query(request)).code).toBe(0)
    const finished = await effect("select public.finish_fiscal_staff_email(event_id,lease_token,null,false) from public.fiscal_staff_email_outbox where event_id=public.fixture_form_id(1821)")
    expect(finished.code, finished.stderr).toBe(0)
    expect(finished.stdout.trim()).toBe("t")
    expect((await query("select public.fixture_closure('cancel',601,1)")).code).toBe(0)
    expect((await query("select status from public.fiscal_staff_email_outbox where event_id=public.fixture_form_id(1821)")).stdout.trim()).toBe("failed")
    expect((await effect(staffClaim)).stdout).not.toContain("000000001821")
  })
  it("rejects links into a closing applicant without stopping staff-owned work", async () => {
    expect((await query("select public.organization_closure_command(public.fixture_form_id(14),public.fixture_form_id(14),'request',public.fixture_form_id(1860),0)")).code).toBe(0)
    const link = await effect(writes[7][1])
    expect(link.code).not.toBe(0)
    expect(link.stderr).toContain("Organization unavailable")
    expect((await effect(writes[1][1])).code).toBe(0)
    expect((await effect("select public.fixture_fiscal_recovery()")).code).toBe(0)
    expect((await query("select count(*) from public.fiscal_application_organization_links; select count(*) from public.fiscal_guest_email_outbox where kind='applicant_recovery'")).stdout.trim()).toBe("0\n1")
  })
  it("keeps another host's worker claims available after closure", async () => {
    expect((await query(request)).code).toBe(0)
    const claims = await effect(`${guestClaim}; ${staffClaim}`)
    expect(claims.code, claims.stderr).toBe(0)
    expect(claims.stdout).toContain("000000001812")
    expect(claims.stdout).toContain("000000001822")
    expect(claims.stdout).not.toContain("000000001811")
    expect(claims.stdout).not.toContain("000000001821")
  })
})
