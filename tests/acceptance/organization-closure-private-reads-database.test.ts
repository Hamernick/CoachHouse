import { spawn } from "node:child_process"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { databaseUrl, createClosureDatabaseHarness } from "./organization-closure-database-helpers"
const { clients, query, hold, queued } = createClosureDatabaseHarness(spawn)
const owner = (sql: string, actor=1) => `begin; set local role authenticated; set local request.jwt.claim.sub='10000000-0000-4000-8000-${String(actor).padStart(12,"0")}'; ${sql}; commit`
const service = (sql:string)=>`begin; set local role service_role; ${sql}; commit`
const counts = "select public.fixture_private_read_counts()"
const expiry = "update public.organization_closures set requested_at=now()-interval '721 hours',export_until=now()-interval '1 hour' where org_id=public.fixture_form_id(1)"
const aiRead = "select public.read_workspace_ai_run(public.fixture_form_id(1801),public.fixture_form_id(1),public.fixture_form_id(1))"
describe.skipIf(!databaseUrl)("private organization read expiry",()=>{
 beforeEach(async()=>{
  const result=await query("begin; set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001'; select public.fixture_closure_private_reads(); commit")
  expect(result.code,result.stderr).toBe(0)
 })
 afterEach(()=>{for(const child of clients) child.kill("SIGTERM")})
 it("finishes admitted readers across14 canonical stores before closure",async()=>{
  const active=await query(owner(counts));expect(active.code,active.stderr).toBe(0)
  expect(Object.values(JSON.parse(active.stdout)).every(n=>Number(n)>0)).toBe(true)
  const release=await hold("set local role authenticated; set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001'; "+counts)
  const closing=await queued("select public.fixture_closure('request',600,0)->>'state'")
  await release();expect((await closing.result).stdout.trim()).toBe("closing")
  const permitted=await query(owner(counts));expect(permitted.code,permitted.stderr).toBe(0)
  expect(JSON.parse(permitted.stdout)).toEqual(JSON.parse(active.stdout))
 })
 it("denies busy reads without deadlock while another organization's reads remain",async()=>{
  const release=await hold("select public.fixture_closure('request',600,0)")
  const result=await query(owner(counts));expect(result.code,result.stderr).toBe(0)
  expect(Object.values(JSON.parse(result.stdout)).every(n=>n===0)).toBe(true)
  const other=await query(owner("select count(*) from public.organization_document_files where org_id=public.fixture_form_id(2)",2))
  expect(other.code,other.stderr).toBe(0);expect(other.stdout.trim()).toBe("1")
  await release()
 })
 it("fixed expiry denies canonical records and keeps underlying evidence",async()=>{
  expect((await query("select public.fixture_closure('request',600,0); "+expiry)).code).toBe(0)
  const result=await query(owner(counts));expect(result.code,result.stderr).toBe(0)
  expect(Object.values(JSON.parse(result.stdout)).every(n=>n===0)).toBe(true)
  expect((await query("select count(*) from public.organization_document_files where org_id=public.fixture_form_id(1)")).stdout.trim()).toBe("1")
 })
 it("locks settled AI projection before closure and denies expired projection without blocking cost recovery",async()=>{
  const release=await hold("set local role service_role; "+aiRead)
  const closing=await queued("select public.fixture_closure('request',600,0)->>'state'")
  await release();expect((await closing.result).stdout.trim()).toBe("closing")
  expect((await query(service(aiRead))).stdout).toContain("Private result")
  expect((await query(expiry)).code).toBe(0)
  expect((await query(service(aiRead))).stdout.trim()).toBe("")
  const recovery=await query(service("select public.recover_workspace_ai_runs(public.fixture_form_id(1))"))
  expect(recovery.code,recovery.stderr).toBe(0)
 })
 it("uses wall-clock expiry across already-open private and AI read transactions",async()=>{
  expect((await query("select public.fixture_closure('request',600,0); update public.organization_closures set requested_at=now()-interval '720 hours'+interval '350 milliseconds',export_until=now()+interval '350 milliseconds' where org_id=public.fixture_form_id(1)")).code).toBe(0)
  const result=await query(service(aiRead+"; select pg_sleep(0.4); "+aiRead))
  expect(result.code,result.stderr).toBe(0)
  expect(result.stdout.match(/Private result/g)).toHaveLength(1)
 })
 it.each(["repeatable read","serializable"])("denies %s private/AI snapshot reads",async isolation=>{
  const result=await query(`begin isolation level ${isolation}; set local role authenticated; set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001'; ${counts}; set local role service_role; ${aiRead}; commit`)
  expect(result.code,result.stderr).toBe(0)
  expect(Object.values(JSON.parse(result.stdout.trim())).every(n=>n===0)).toBe(true)
 })
 it("keeps staff-host fiscal ownership independent from a closing linked applicant",async()=>{
  const setup=await query("insert into auth.users values(public.fixture_form_id(14),'synthetic@example.org',now()) on conflict(id) do nothing; insert into public.profiles(id,role,email,full_name) values(public.fixture_form_id(14),'member','synthetic@example.org','Applicant') on conflict(id) do nothing; insert into public.organizations(user_id,profile,public_slug,updated_at) values(public.fixture_form_id(14),'{\"name\":\"Applicant\"}','applicant',now()) on conflict(user_id) do nothing; update public.fiscal_guest_submissions set claimed_user_id=public.fixture_form_id(14),claimed_org_id=public.fixture_form_id(14),claimed_at=now() where id=public.fixture_form_id(2101); select public.organization_closure_command(public.fixture_form_id(14),public.fixture_form_id(14),'request',public.fixture_form_id(2404),0); update public.organization_closures set requested_at=now()-interval '721 hours',export_until=now()-interval '1 hour' where org_id=public.fixture_form_id(14)")
  expect(setup.code,setup.stderr).toBe(0)
  const read="select public.read_linked_fiscal_application(public.fixture_form_id(2101))"
  const active=await query(owner(read,14));expect(active.code,active.stderr).toBe(0);expect(active.stdout).toContain("projectName")
  expect((await query("select public.fixture_closure('request',600,0); "+expiry)).code).toBe(0)
  const closed=await query(owner(read,14));expect(closed.code,closed.stderr).toBe(0);expect(closed.stdout.trim()).toBe("")
 })
 it("serializes link admission and caps expiry to the fixed database deadline",async()=>{
  const deadline="select public.organization_storage_link_deadline(public.fixture_form_id(1),900)"
  const release=await hold("set local role service_role; "+deadline)
  const closing=await queued("select public.fixture_closure('request',600,0)->>'state'")
  await release();expect((await closing.result).stdout.trim()).toBe("closing")
  expect((await query("update public.organization_closures set requested_at=now()-interval '720 hours'+interval '10 seconds',export_until=now()+interval '10 seconds' where org_id=public.fixture_form_id(1)")).code).toBe(0)
  const result=await query(service(deadline));expect(result.code,result.stderr).toBe(0)
  const window=JSON.parse(result.stdout)
  expect(Date.parse(window.expiresAt)-Date.parse(window.serverNow)).toBeGreaterThan(0)
  expect(Date.parse(window.expiresAt)-Date.parse(window.serverNow)).toBeLessThanOrEqual(10000)
  const repeatable=await query("begin isolation level repeatable read; set local role service_role; "+deadline+"; commit")
  expect(repeatable.code,repeatable.stderr).toBe(0);expect(repeatable.stdout.trim()).toBe("")
  expect((await query(expiry)).code).toBe(0)
  expect((await query(service(deadline))).stdout.trim()).toBe("")
 })
 it("keeps personal program reads independent of a different closed organization",async()=>{
  expect((await query("select public.fixture_closure('request',600,0); "+expiry)).code).toBe(0)
  const result=await query(owner("select public.program_closure_read_window(public.fixture_form_id(3))"))
  expect(result.code,result.stderr).toBe(0);expect(result.stdout.trim()).toBe("t")
 })
})
