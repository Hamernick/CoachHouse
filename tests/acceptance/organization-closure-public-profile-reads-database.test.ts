import { spawn } from "node:child_process"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { databaseUrl, createClosureDatabaseHarness } from "./organization-closure-database-helpers"
const { clients, query, hold, queued } = createClosureDatabaseHarness(spawn)
const read = "select public.filter_public_organization_ids(array[public.fixture_form_id(1),public.fixture_form_id(2)])"
const flags = "select is_public,is_public_roadmap from public.organizations where user_id=public.fixture_form_id(1)"
const service = (sql: string) => `begin; set local role service_role; ${sql}; commit`
describe.skipIf(!databaseUrl)("public organization closure admission", () => {
 beforeEach(async () => {
  const result=await query("begin; set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001'; select public.fixture_closure_calendar(); update public.organizations set is_public=true,is_public_roadmap=true; commit")
  expect(result.code,result.stderr).toBe(0)
 })
 afterEach(() => { for (const child of clients) child.kill("SIGTERM") })
 it("holds admitted public projections before atomic withdrawal",async () => {
  const release=await hold(`set local role service_role; ${read}`)
  const closing=await queued("select public.fixture_closure('request',600,0)->>'state'")
  await release()
  expect((await closing.result).stdout.trim()).toBe("closing")
  expect((await query(flags)).stdout.trim()).toBe("f|f")
 })
 it("denies closing/busy organization but preserves independent public organizations",async () => {
  const release=await hold("select public.fixture_closure('request',600,0)")
  const busy=await query(service(read))
  expect(busy.code,busy.stderr).toBe(0)
  expect(busy.stdout).not.toContain("000000000001")
  expect(busy.stdout).toContain("000000000002")
  await release()
  const closed=await query(service(read))
  expect(closed.stdout).not.toContain("000000000001")
 })
 it("cannot revive public flags on cancel, but permits explicit new profile publication",async () => {
  expect((await query("select public.fixture_closure('request',600,0); select public.fixture_closure('cancel',601,1)")).code).toBe(0)
  expect((await query(flags)).stdout.trim()).toBe("f|f")
  expect((await query("update public.organizations set is_public=true where user_id=public.fixture_form_id(1)")).code).toBe(0)
  expect((await query(service(read))).stdout).toContain("000000000001")
  expect((await query(flags)).stdout.trim()).toBe("t|f")
 })
 it("rolls publication withdrawal back with a later shutdown failure",async () => {
  const result=await query("begin; create function public.fixture_reject_shutdown() returns trigger language plpgsql as $$ begin raise exception 'synthetic shutdown failure'; end $$; create trigger zzz_fixture_reject after insert or update on public.organization_closures for each row execute function public.fixture_reject_shutdown(); select public.fixture_closure('request',600,0); commit")
  expect(result.code).not.toBe(0)
  expect(result.stderr).toContain("synthetic shutdown failure")
  expect((await query(flags)).stdout.trim()).toBe("t|t")
  expect((await query("select count(*) from public.organization_closures; select count(*) from public.organization_closure_operations")).stdout.trim()).toBe("0\n0")
 })
 it("private owner reads expire by wall-clock inside an open transaction",async () => {
  expect((await query("select public.fixture_closure('request',600,0); update public.organization_closures set requested_at=now()-interval '720 hours'+interval '300 milliseconds',export_until=now()+interval '300 milliseconds' where org_id=public.fixture_form_id(1)")).code).toBe(0)
  const result=await query("begin; set local role authenticated; set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001'; select count(*) from public.organizations where user_id=public.fixture_form_id(1); select pg_sleep(0.35); select count(*) from public.organizations where user_id=public.fixture_form_id(1); commit")
  expect(result.code,result.stderr).toBe(0)
  expect(result.stdout.trim()).toBe("1\n\n0")
 })
 it("does not turn export-window admission into private owner/outsider access",async () => {
  expect((await query("select public.fixture_closure('request',600,0)")).code).toBe(0)
  const result=await query("set role authenticated; set request.jwt.claim.sub='10000000-0000-4000-8000-000000000006'; select count(*) from public.organizations where user_id=public.fixture_form_id(1)")
  expect(result.code,result.stderr).toBe(0)
  expect(result.stdout.trim()).toBe("0")
 })
 it.each(["repeatable read","serializable"])("fails closed for %s snapshots",async isolation => {
  const result=await query(`begin isolation level ${isolation}; set local role service_role; ${read}; set local role authenticated; set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001'; select count(*) from public.organizations; commit`)
  expect(result.code,result.stderr).toBe(0)
  expect(result.stdout.trim()).toBe("{}\n0")
 })
})
